import json
from collections import defaultdict
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from api.deps import get_current_user
from api.payments import get_wallet
from database.session import get_db
from models.ledger import EntryDirection, LedgerEntry, Transaction, TransactionStatus
from models.user import User

router = APIRouter()


def _parse_metadata(raw: str | None) -> dict:
    if not raw:
        return {}
    try:
        return json.loads(raw)
    except Exception:
        return {}


def _extract_counterparty(txn: Transaction) -> str:
    metadata = _parse_metadata(txn.transaction_metadata)
    if isinstance(metadata.get("recipient_mobile"), str) and metadata["recipient_mobile"].strip():
        return metadata["recipient_mobile"].strip()
    if isinstance(metadata.get("target_type"), str) and metadata["target_type"].strip():
        return metadata["target_type"].strip()
    return txn.transaction_type or "GENERIC"


def _wallet_tx_rows(db: Session, wallet_id: str, start: datetime | None = None):
    query = db.query(LedgerEntry, Transaction).join(
        Transaction, LedgerEntry.transaction_id == Transaction.id
    ).filter(
        LedgerEntry.account_id == wallet_id,
    )
    if start:
        query = query.filter(Transaction.posted_date >= start)
    return query.order_by(Transaction.posted_date.desc()).all()


@router.get("/merchant-kpis")
def merchant_kpis(
    days: int = 30,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if days <= 0:
        days = 30
    start = datetime.utcnow() - timedelta(days=days)
    wallet = get_wallet(db, current_user.id)
    rows = _wallet_tx_rows(db, wallet.id, start=start)

    inflow = 0
    outflow = 0
    tx_count = 0
    total_volume = 0
    outgoing_counterparties: dict[str, int] = defaultdict(int)

    for entry, txn in rows:
        if txn.status != TransactionStatus.COMPLETED:
            continue
        tx_count += 1
        amount = abs(int(entry.amount))
        total_volume += amount
        if entry.direction == EntryDirection.DEBIT:
            inflow += amount
        else:
            outflow += amount
            outgoing_counterparties[_extract_counterparty(txn)] += amount

    avg_ticket = int(total_volume / tx_count) if tx_count else 0
    top_counterparties = sorted(outgoing_counterparties.items(), key=lambda item: item[1], reverse=True)[:5]
    counterparty_total = sum(outgoing_counterparties.values()) or 1

    return {
        "window_days": days,
        "transaction_count": tx_count,
        "inflow_inr": inflow / 100,
        "outflow_inr": outflow / 100,
        "net_inr": (inflow - outflow) / 100,
        "avg_ticket_inr": avg_ticket / 100,
        "top_counterparties": [
            {
                "name": name,
                "amount_inr": amount / 100,
                "share_percent": round((amount / counterparty_total) * 100, 2),
            }
            for name, amount in top_counterparties
        ],
    }


@router.get("/peak-windows")
def peak_windows(
    days: int = 30,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if days <= 0:
        days = 30
    start = datetime.utcnow() - timedelta(days=days)
    wallet = get_wallet(db, current_user.id)
    rows = _wallet_tx_rows(db, wallet.id, start=start)

    by_hour: dict[int, dict[str, int]] = defaultdict(lambda: {"count": 0, "volume": 0})
    by_day: dict[int, dict[str, int]] = defaultdict(lambda: {"count": 0, "volume": 0})

    for entry, txn in rows:
        if txn.status != TransactionStatus.COMPLETED:
            continue
        hour = txn.posted_date.hour
        day = txn.posted_date.weekday()  # Monday=0
        amount = abs(int(entry.amount))

        by_hour[hour]["count"] += 1
        by_hour[hour]["volume"] += amount
        by_day[day]["count"] += 1
        by_day[day]["volume"] += amount

    hour_windows = [
        {"hour": hour, "count": data["count"], "volume_inr": data["volume"] / 100}
        for hour, data in by_hour.items()
    ]
    day_names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    day_windows = [
        {"day": day_names[day], "count": data["count"], "volume_inr": data["volume"] / 100}
        for day, data in by_day.items()
    ]

    top_hours = sorted(hour_windows, key=lambda item: item["count"], reverse=True)[:3]
    top_days = sorted(day_windows, key=lambda item: item["count"], reverse=True)[:3]

    return {
        "window_days": days,
        "top_hours": top_hours,
        "top_days": top_days,
        "hour_distribution": sorted(hour_windows, key=lambda item: item["hour"]),
        "day_distribution": day_windows,
    }


@router.get("/security-score")
def security_score(
    days: int = 30,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if days <= 0:
        days = 30
    start = datetime.utcnow() - timedelta(days=days)
    wallet = get_wallet(db, current_user.id)
    rows = _wallet_tx_rows(db, wallet.id, start=start)

    all_user_txns = db.query(Transaction).filter(
        Transaction.user_id == current_user.id,
        Transaction.posted_date >= start,
    ).all()

    completed = [t for t in all_user_txns if t.status == TransactionStatus.COMPLETED]
    failed = [t for t in all_user_txns if t.status == TransactionStatus.FAILED]
    total_considered = len(completed) + len(failed)
    failed_ratio = (len(failed) / total_considered) if total_considered else 0.0

    odd_hour_count = 0
    high_value_count = 0
    completed_entry_count = 0
    outgoing_counterparties: dict[str, int] = defaultdict(int)
    outgoing_total = 0

    for entry, txn in rows:
        if txn.status != TransactionStatus.COMPLETED:
            continue
        completed_entry_count += 1
        if txn.posted_date.hour < 5:
            odd_hour_count += 1
        if abs(int(entry.amount)) >= 200000:  # >= 2,000 INR
            high_value_count += 1
        if entry.direction == EntryDirection.CREDIT:
            amount = abs(int(entry.amount))
            cp = _extract_counterparty(txn)
            outgoing_counterparties[cp] += amount
            outgoing_total += amount

    odd_ratio = (odd_hour_count / completed_entry_count) if completed_entry_count else 0.0
    high_value_ratio = (high_value_count / completed_entry_count) if completed_entry_count else 0.0
    top_counterparty_share = (max(outgoing_counterparties.values()) / outgoing_total) if outgoing_total else 0.0

    score = 100.0
    score -= failed_ratio * 40.0
    score -= odd_ratio * 20.0
    score -= high_value_ratio * 15.0
    if top_counterparty_share > 0.5:
        score -= min(20.0, (top_counterparty_share - 0.5) * 60.0)
    score = max(0.0, round(score, 2))

    if score >= 80:
        band = "LOW_RISK"
    elif score >= 55:
        band = "MEDIUM_RISK"
    else:
        band = "HIGH_RISK"

    reasons = []
    if failed_ratio > 0.1:
        reasons.append("High failed transaction ratio in the selected window.")
    if odd_ratio > 0.2:
        reasons.append("Large proportion of transactions are during 00:00-05:00.")
    if high_value_ratio > 0.3:
        reasons.append("High-value transaction density is elevated.")
    if top_counterparty_share > 0.5:
        reasons.append("Outgoing volume concentration is high for a single counterparty.")
    if not reasons:
        reasons.append("No major risk anomalies detected.")

    return {
        "window_days": days,
        "score": score,
        "risk_band": band,
        "signals": {
            "failed_ratio": round(failed_ratio, 4),
            "odd_hour_ratio": round(odd_ratio, 4),
            "high_value_ratio": round(high_value_ratio, 4),
            "top_counterparty_share": round(top_counterparty_share, 4),
        },
        "reasons": reasons,
    }

