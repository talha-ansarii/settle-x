import json
from datetime import datetime
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel

from database.session import get_db
from models.user import User
from models.bonds import (
    Bond,
    BondHolding,
    HoldingStatus,
    BondEvent,
    BondEventType,
    BondRiskProfile,
    RiskTier,
    BondRecommendation,
    BondRecommendationAudit,
)
from models.ledger import LedgerAccount, AccountType, Transaction, TransactionStatus, LedgerEntry, EntryDirection
from api.deps import get_current_user
from api.payments import get_wallet, calculate_balance
from core.http import api_error
from core.transaction_types import TransactionTypes

router = APIRouter()

def get_optimal_bond(db: Session, amount_paise: int):
    # Currently hardcoded to extract the benchmark active bond as requested by the AI orchestrator spec
    bond = db.query(Bond).filter(Bond.is_active == True).first()
    if not bond:
        api_error(404, "NO_ACTIVE_BONDS", "No active Treasury bonds available.")
    return bond

def get_bond_portfolio_wallet(db: Session, user_id: str) -> LedgerAccount:
    """Provisions a distinct Investment Asset wallet representing aggregate tied principal."""
    wallet = db.query(LedgerAccount).filter(
        LedgerAccount.user_id == user_id, 
        LedgerAccount.name == "Bond Portfolio",
        LedgerAccount.account_type == AccountType.ASSET
    ).first()
    if not wallet:
        wallet = LedgerAccount(user_id=user_id, name="Bond Portfolio", account_type=AccountType.ASSET)
        db.add(wallet)
        db.commit()
        db.refresh(wallet)
    return wallet


def get_system_reserve_wallet(db: Session) -> LedgerAccount:
    """Ensures a system equity reserve exists for interest settlement offsets."""
    wallet = db.query(LedgerAccount).filter(
        LedgerAccount.name == "System Reserve",
        LedgerAccount.account_type == AccountType.EQUITY,
        LedgerAccount.is_system == True
    ).first()
    if wallet:
        return wallet

    sys_user = db.query(User).filter(User.mobile_number == "0000000000").first()
    if not sys_user:
        sys_user = User(mobile_number="0000000000", business_name="Central Bank Reserve")
        db.add(sys_user)
        db.commit()
        db.refresh(sys_user)

    wallet = LedgerAccount(
        user_id=sys_user.id,
        name="System Reserve",
        account_type=AccountType.EQUITY,
        is_system=True
    )
    db.add(wallet)
    db.commit()
    db.refresh(wallet)
    return wallet


def calculate_accrued_interest_paise(holding: BondHolding, bond: Bond, now: datetime | None = None) -> int:
    current_time = now or datetime.utcnow()
    end_time = holding.transferred_or_matured_at or current_time
    duration_held_seconds = (end_time - holding.acquired_at).total_seconds()
    effective_seconds = max(0, min(duration_held_seconds, bond.maturity_seconds))
    fraction = effective_seconds / bond.maturity_seconds if bond.maturity_seconds > 0 else 0
    total_yield_paise = holding.principal_paise * (bond.apy_rate / 100.0)
    return int(round(total_yield_paise * fraction))


def append_bond_event(
    db: Session,
    holding_id: str,
    user_id: str,
    event_type: BondEventType,
    amount_paise: int,
    metadata: dict | None = None
):
    event = BondEvent(
        holding_id=holding_id,
        user_id=user_id,
        event_type=event_type,
        amount_paise=amount_paise,
        event_metadata=json.dumps(metadata) if metadata else None
    )
    db.add(event)


def _clamp(value: float, low: int = 0, high: int = 100) -> int:
    return max(low, min(high, int(round(value))))


def get_or_create_risk_profile(db: Session, bond: Bond) -> BondRiskProfile:
    profile = db.query(BondRiskProfile).filter(BondRiskProfile.bond_id == bond.id).first()
    if profile:
        return profile

    # Heuristic defaults for demo environments where a risk feed is not integrated yet.
    duration_penalty = min(40, bond.maturity_seconds / 30)
    safety_score = _clamp(95 - duration_penalty - max(0, bond.apy_rate - 12))
    liquidity_score = _clamp(90 - min(45, bond.maturity_seconds / 45))

    if safety_score >= 80:
        tier = RiskTier.LOW
    elif safety_score >= 60:
        tier = RiskTier.MEDIUM
    else:
        tier = RiskTier.HIGH

    profile = BondRiskProfile(
        bond_id=bond.id,
        issuer_type="GOVERNMENT_SIMULATED",
        safety_score=safety_score,
        liquidity_score=liquidity_score,
        risk_tier=tier,
    )
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile


class RecommendRequest(BaseModel):
    amount_paise: int
    min_safety_score: int = 70
    min_liquidity_score: int = 50
    max_maturity_seconds: int | None = None


@router.post("/recommend")
def recommend_bond(
    payload: RecommendRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if payload.amount_paise <= 0:
        api_error(400, "INVALID_AMOUNT", "amount_paise must be greater than zero.")

    active_bonds = db.query(Bond).filter(Bond.is_active == True).all()
    if not active_bonds:
        api_error(404, "NO_ACTIVE_BONDS", "No active Treasury bonds available.")

    candidates = []
    excluded = []

    for bond in active_bonds:
        profile = get_or_create_risk_profile(db, bond)
        reasons = []
        if profile.safety_score < payload.min_safety_score:
            reasons.append(f"safety_score<{payload.min_safety_score}")
        if profile.liquidity_score < payload.min_liquidity_score:
            reasons.append(f"liquidity_score<{payload.min_liquidity_score}")
        if payload.max_maturity_seconds is not None and bond.maturity_seconds > payload.max_maturity_seconds:
            reasons.append(f"maturity_seconds>{payload.max_maturity_seconds}")

        if reasons:
            excluded.append(
                {
                    "bond_id": bond.id,
                    "bond_name": bond.name,
                    "apy": bond.apy_rate,
                    "safety_score": profile.safety_score,
                    "liquidity_score": profile.liquidity_score,
                    "reasons": reasons,
                }
            )
            continue

        # Safety first ranking; yield comes after risk controls.
        ranking_score = (
            (profile.safety_score * 0.60)
            + (profile.liquidity_score * 0.25)
            + (bond.apy_rate * 1.5)
        )
        candidates.append(
            {
                "bond": bond,
                "profile": profile,
                "ranking_score": round(ranking_score, 4),
            }
        )

    if not candidates:
        api_error(
            400,
            "NO_POLICY_COMPLIANT_BOND",
            "No bonds satisfy the current safety/liquidity policy gates.",
            excluded=excluded,
        )

    candidates.sort(
        key=lambda row: (
            row["ranking_score"],
            row["profile"].safety_score,
            row["profile"].liquidity_score,
            row["bond"].apy_rate,
        ),
        reverse=True,
    )
    selected = candidates[0]
    selected_bond: Bond = selected["bond"]
    selected_profile: BondRiskProfile = selected["profile"]
    selected_score = selected["ranking_score"]

    rec = BondRecommendation(
        user_id=current_user.id,
        recommended_bond_id=selected_bond.id,
        requested_amount_paise=payload.amount_paise,
        recommended_allocation_paise=payload.amount_paise,
        expected_apy=selected_bond.apy_rate,
        safety_score=selected_profile.safety_score,
        liquidity_score=selected_profile.liquidity_score,
        ranking_score=selected_score,
        policy_version="v1",
    )
    db.add(rec)
    db.flush()

    candidate_snapshot = []
    for row in candidates:
        candidate_snapshot.append(
            {
                "bond_id": row["bond"].id,
                "bond_name": row["bond"].name,
                "apy": row["bond"].apy_rate,
                "maturity_seconds": row["bond"].maturity_seconds,
                "safety_score": row["profile"].safety_score,
                "liquidity_score": row["profile"].liquidity_score,
                "risk_tier": row["profile"].risk_tier.value,
                "ranking_score": row["ranking_score"],
            }
        )

    audit = BondRecommendationAudit(
        recommendation_id=rec.id,
        user_id=current_user.id,
        input_snapshot=json.dumps(
            {
                "amount_paise": payload.amount_paise,
                "min_safety_score": payload.min_safety_score,
                "min_liquidity_score": payload.min_liquidity_score,
                "max_maturity_seconds": payload.max_maturity_seconds,
                "policy_version": "v1",
            }
        ),
        candidate_snapshot=json.dumps(
            {
                "included": candidate_snapshot,
                "excluded": excluded,
            }
        ),
        decision_snapshot=json.dumps(
            {
                "selected_recommendation_id": rec.id,
                "selected_bond_id": selected_bond.id,
                "selected_bond_name": selected_bond.name,
                "ranking_score": selected_score,
                "explanation": [
                    "Passed safety and liquidity policy gates.",
                    f"Safety score {selected_profile.safety_score} prioritized in ranking.",
                    f"Liquidity score {selected_profile.liquidity_score} reduced settlement risk.",
                    f"APY {selected_bond.apy_rate}% used as secondary optimization factor.",
                ],
            }
        ),
    )
    db.add(audit)
    db.commit()

    return {
        "recommendation_id": rec.id,
        "policy_version": rec.policy_version,
        "bond": {
            "id": selected_bond.id,
            "name": selected_bond.name,
            "apy": selected_bond.apy_rate,
            "maturity_seconds": selected_bond.maturity_seconds,
            "safety_score": selected_profile.safety_score,
            "liquidity_score": selected_profile.liquidity_score,
            "risk_tier": selected_profile.risk_tier.value,
            "ranking_score": selected_score,
        },
        "allocation_inr": payload.amount_paise / 100,
        "rationale": [
            "Safety-first policy gate passed.",
            "Chosen highest risk-adjusted score under active constraints.",
        ],
    }


@router.get("/recommend/{recommendation_id}/audit")
def get_recommendation_audit(
    recommendation_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rec = db.query(BondRecommendation).filter(
        BondRecommendation.id == recommendation_id,
        BondRecommendation.user_id == current_user.id
    ).first()
    if not rec:
        api_error(404, "RECOMMENDATION_NOT_FOUND", "Recommendation not found.")

    audit = db.query(BondRecommendationAudit).filter(
        BondRecommendationAudit.recommendation_id == recommendation_id,
        BondRecommendationAudit.user_id == current_user.id
    ).first()
    if not audit:
        api_error(404, "RECOMMENDATION_AUDIT_NOT_FOUND", "Recommendation audit not found.")

    return {
        "recommendation_id": rec.id,
        "policy_version": rec.policy_version,
        "input_snapshot": json.loads(audit.input_snapshot),
        "candidate_snapshot": json.loads(audit.candidate_snapshot),
        "decision_snapshot": json.loads(audit.decision_snapshot),
        "created_at": audit.created_at.isoformat(),
    }

class BuyRequest(BaseModel):
    amount_paise: int

@router.post("/buy")
def buy_bond(payload: BuyRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    target_bond = get_optimal_bond(db, payload.amount_paise)
    
    # 1. Verify Cash Balance
    cash_wallet = get_wallet(db, current_user.id)
    cash_balance = calculate_balance(db, cash_wallet.id)
    
    if cash_balance < payload.amount_paise:
        api_error(400, "INSUFFICIENT_BALANCE", "Insufficient localized Cash Wallet bounds.")
    
    # 2. Acquire Investment Bucket
    bond_wallet = get_bond_portfolio_wallet(db, current_user.id)
    
    try:
        # Create Financial Transaction Document
        txn = Transaction(
            user_id=current_user.id,
            description=f"Automated Allocation to {target_bond.name}",
            transaction_type=TransactionTypes.BOND_PURCHASE,
            transaction_metadata=json.dumps({"bond_id": target_bond.id, "amount_paise": payload.amount_paise}),
            ai_category="INVESTMENTS",
            status=TransactionStatus.PENDING
        )
        db.add(txn)
        db.flush()
        
        # Lower Cash (Asset) via CREDIT
        credit_cash = LedgerEntry(
            transaction_id=txn.id,
            account_id=cash_wallet.id,
            direction=EntryDirection.CREDIT,
            amount=payload.amount_paise
        )
        # Increase Securities (Asset) via DEBIT
        debit_bonds = LedgerEntry(
            transaction_id=txn.id,
            account_id=bond_wallet.id,
            direction=EntryDirection.DEBIT,
            amount=payload.amount_paise
        )
        
        db.add(credit_cash)
        db.add(debit_bonds)
        
        # Instantiate Fractional Ownership Log
        holding = BondHolding(
            bond_id=target_bond.id,
            user_id=current_user.id,
            principal_paise=payload.amount_paise,
            status=HoldingStatus.ACTIVE
        )
        db.add(holding)
        db.flush()
        append_bond_event(
            db=db,
            holding_id=holding.id,
            user_id=current_user.id,
            event_type=BondEventType.PURCHASED,
            amount_paise=payload.amount_paise,
            metadata={"bond_id": target_bond.id}
        )
        txn.status = TransactionStatus.COMPLETED
        
        db.commit()
    except Exception as e:
        db.rollback()
        failed_txn = Transaction(
            user_id=current_user.id,
            description=f"Automated Allocation to {target_bond.name}",
            transaction_type=TransactionTypes.BOND_PURCHASE,
            transaction_metadata=json.dumps({"bond_id": target_bond.id, "amount_paise": payload.amount_paise}),
            ai_category="INVESTMENTS",
            status=TransactionStatus.FAILED
        )
        db.add(failed_txn)
        db.commit()
        api_error(500, "BOND_PURCHASE_FAILED", "Bond purchase failed.", reason=str(e))
        
    return {"message": f"Successfully procured {payload.amount_paise/100} INR allocation inside {target_bond.name}"}


class TransferHoldingRequest(BaseModel):
    holding_id: str
    recipient_mobile: str
    idempotency_key: str | None = None


@router.post("/transfer")
def transfer_bond_holding(
    payload: TransferHoldingRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    recipient_num = payload.recipient_mobile.replace("+91", "").replace(" ", "")
    if recipient_num == current_user.mobile_number:
        api_error(400, "SELF_TRANSFER_BLOCKED", "Cannot transfer bond to yourself.")

    holding = db.query(BondHolding).filter(
        BondHolding.id == payload.holding_id,
        BondHolding.user_id == current_user.id
    ).first()
    if not holding:
        api_error(404, "HOLDING_NOT_FOUND", "Bond holding not found.")
    if holding.status != HoldingStatus.ACTIVE:
        api_error(400, "HOLDING_NOT_ACTIVE", "Only active bond holdings can be transferred.")

    recipient = db.query(User).filter(User.mobile_number == recipient_num).first()
    if not recipient:
        api_error(404, "RECIPIENT_NOT_FOUND", "Recipient is not registered on SettleX network.")

    if payload.idempotency_key:
        existing_txn = db.query(Transaction).filter(Transaction.idempotency_key == payload.idempotency_key).first()
        if existing_txn:
            return {
                "message": "Bond transfer already processed",
                "transaction_id": existing_txn.id,
                "status": existing_txn.status
            }

    sender_portfolio = get_bond_portfolio_wallet(db, current_user.id)
    recipient_portfolio = get_bond_portfolio_wallet(db, recipient.id)

    try:
        txn = Transaction(
            user_id=current_user.id,
            idempotency_key=payload.idempotency_key,
            description=f"Bond Transfer to {recipient_num}",
            transaction_type=TransactionTypes.BOND_TRANSFER,
            transaction_metadata=json.dumps(
                {"holding_id": holding.id, "recipient_mobile": recipient_num, "amount_paise": holding.principal_paise}
            ),
            ai_category="BOND_TRANSFER",
            status=TransactionStatus.PENDING
        )
        db.add(txn)
        db.flush()

        db.add(LedgerEntry(
            transaction_id=txn.id,
            account_id=sender_portfolio.id,
            direction=EntryDirection.CREDIT,
            amount=holding.principal_paise
        ))
        db.add(LedgerEntry(
            transaction_id=txn.id,
            account_id=recipient_portfolio.id,
            direction=EntryDirection.DEBIT,
            amount=holding.principal_paise
        ))

        transfer_time = datetime.utcnow()
        holding.status = HoldingStatus.TRANSFERRED
        holding.transferred_or_matured_at = transfer_time

        recipient_holding = BondHolding(
            bond_id=holding.bond_id,
            user_id=recipient.id,
            principal_paise=holding.principal_paise,
            acquired_at=transfer_time,
            status=HoldingStatus.ACTIVE
        )
        db.add(recipient_holding)
        db.flush()

        append_bond_event(
            db=db,
            holding_id=holding.id,
            user_id=current_user.id,
            event_type=BondEventType.TRANSFER_OUT,
            amount_paise=holding.principal_paise,
            metadata={"recipient_mobile": recipient_num, "recipient_holding_id": recipient_holding.id}
        )
        append_bond_event(
            db=db,
            holding_id=recipient_holding.id,
            user_id=recipient.id,
            event_type=BondEventType.TRANSFER_IN,
            amount_paise=recipient_holding.principal_paise,
            metadata={"sender_mobile": current_user.mobile_number, "source_holding_id": holding.id}
        )

        txn.status = TransactionStatus.COMPLETED
        db.commit()
    except Exception as e:
        db.rollback()
        api_error(500, "BOND_TRANSFER_FAILED", "Bond transfer failed.", reason=str(e))

    return {
        "message": "Bond transfer successful",
        "transaction_id": txn.id,
        "transferred_principal_inr": holding.principal_paise / 100
    }


class RedeemRequest(BaseModel):
    holding_id: str
    idempotency_key: str | None = None


@router.post("/redeem")
def redeem_bond_holding(
    payload: RedeemRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    holding = db.query(BondHolding).filter(
        BondHolding.id == payload.holding_id,
        BondHolding.user_id == current_user.id
    ).first()
    if not holding:
        api_error(404, "HOLDING_NOT_FOUND", "Bond holding not found.")
    if holding.status != HoldingStatus.ACTIVE and holding.status != HoldingStatus.MATURED:
        api_error(400, "HOLDING_NOT_REDEEMABLE", "Holding is not redeemable.")

    if payload.idempotency_key:
        existing_txn = db.query(Transaction).filter(Transaction.idempotency_key == payload.idempotency_key).first()
        if existing_txn:
            return {
                "message": "Bond redemption already processed",
                "transaction_id": existing_txn.id,
                "status": existing_txn.status
            }

    bond = db.query(Bond).filter(Bond.id == holding.bond_id).first()
    if not bond:
        api_error(404, "BOND_NOT_FOUND", "Linked bond was not found.")

    bond_wallet = get_bond_portfolio_wallet(db, current_user.id)
    cash_wallet = get_wallet(db, current_user.id)
    system_reserve = get_system_reserve_wallet(db)
    now = datetime.utcnow()

    accrued_interest = calculate_accrued_interest_paise(holding, bond, now)
    payout_total = holding.principal_paise + accrued_interest

    try:
        txn = Transaction(
            user_id=current_user.id,
            idempotency_key=payload.idempotency_key,
            description=f"Bond Redemption from {bond.name}",
            transaction_type=TransactionTypes.BOND_REDEMPTION,
            transaction_metadata=json.dumps(
                {"holding_id": holding.id, "bond_id": bond.id, "principal_paise": holding.principal_paise}
            ),
            ai_category="BOND_REDEMPTION",
            status=TransactionStatus.PENDING
        )
        db.add(txn)
        db.flush()

        # Release principal from bond portfolio to cash wallet.
        db.add(LedgerEntry(
            transaction_id=txn.id,
            account_id=bond_wallet.id,
            direction=EntryDirection.CREDIT,
            amount=holding.principal_paise
        ))
        db.add(LedgerEntry(
            transaction_id=txn.id,
            account_id=cash_wallet.id,
            direction=EntryDirection.DEBIT,
            amount=holding.principal_paise
        ))

        # Accrued interest is minted against system reserve.
        if accrued_interest > 0:
            db.add(LedgerEntry(
                transaction_id=txn.id,
                account_id=system_reserve.id,
                direction=EntryDirection.CREDIT,
                amount=accrued_interest
            ))
            db.add(LedgerEntry(
                transaction_id=txn.id,
                account_id=cash_wallet.id,
                direction=EntryDirection.DEBIT,
                amount=accrued_interest
            ))

        holding.status = HoldingStatus.SETTLED
        holding.transferred_or_matured_at = now
        append_bond_event(
            db=db,
            holding_id=holding.id,
            user_id=current_user.id,
            event_type=BondEventType.REDEEMED,
            amount_paise=payout_total,
            metadata={"principal_paise": holding.principal_paise, "interest_paise": accrued_interest}
        )
        append_bond_event(
            db=db,
            holding_id=holding.id,
            user_id=current_user.id,
            event_type=BondEventType.SETTLED,
            amount_paise=payout_total
        )

        txn.status = TransactionStatus.COMPLETED
        db.commit()
    except Exception as e:
        db.rollback()
        api_error(500, "BOND_REDEMPTION_FAILED", "Bond redemption failed.", reason=str(e))

    return {
        "message": "Bond redeemed successfully",
        "transaction_id": txn.id,
        "principal_inr": holding.principal_paise / 100,
        "interest_inr": accrued_interest / 100,
        "payout_inr": payout_total / 100
    }


@router.post("/settle-matured")
def settle_matured_holdings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    now = datetime.utcnow()
    active_holdings = db.query(BondHolding).filter(
        BondHolding.user_id == current_user.id,
        BondHolding.status == HoldingStatus.ACTIVE
    ).all()

    matured_ids: list[str] = []
    settled_ids: list[str] = []
    total_settlement_paise = 0

    try:
        for holding in active_holdings:
            bond = db.query(Bond).filter(Bond.id == holding.bond_id).first()
            if not bond:
                continue
            duration_held_seconds = (now - holding.acquired_at).total_seconds()
            if duration_held_seconds < bond.maturity_seconds:
                continue

            holding.status = HoldingStatus.MATURED
            holding.transferred_or_matured_at = now
            matured_ids.append(holding.id)
            append_bond_event(
                db=db,
                holding_id=holding.id,
                user_id=current_user.id,
                event_type=BondEventType.MATURED,
                amount_paise=holding.principal_paise,
                metadata={"bond_id": bond.id}
            )

            # Auto-settle matured holdings in the same call for demo readiness.
            accrued_interest = calculate_accrued_interest_paise(holding, bond, now)
            payout_total = holding.principal_paise + accrued_interest
            bond_wallet = get_bond_portfolio_wallet(db, current_user.id)
            cash_wallet = get_wallet(db, current_user.id)
            reserve_wallet = get_system_reserve_wallet(db)

            txn = Transaction(
                user_id=current_user.id,
                description=f"Maturity Settlement for {bond.name}",
                transaction_type=TransactionTypes.BOND_MATURITY_SETTLEMENT,
                transaction_metadata=json.dumps(
                    {"holding_id": holding.id, "bond_id": bond.id, "principal_paise": holding.principal_paise}
                ),
                ai_category="BOND_MATURITY_SETTLEMENT",
                status=TransactionStatus.PENDING
            )
            db.add(txn)
            db.flush()
            db.add(LedgerEntry(
                transaction_id=txn.id,
                account_id=bond_wallet.id,
                direction=EntryDirection.CREDIT,
                amount=holding.principal_paise
            ))
            db.add(LedgerEntry(
                transaction_id=txn.id,
                account_id=cash_wallet.id,
                direction=EntryDirection.DEBIT,
                amount=holding.principal_paise
            ))
            if accrued_interest > 0:
                db.add(LedgerEntry(
                    transaction_id=txn.id,
                    account_id=reserve_wallet.id,
                    direction=EntryDirection.CREDIT,
                    amount=accrued_interest
                ))
                db.add(LedgerEntry(
                    transaction_id=txn.id,
                    account_id=cash_wallet.id,
                    direction=EntryDirection.DEBIT,
                    amount=accrued_interest
                ))
            txn.status = TransactionStatus.COMPLETED

            holding.status = HoldingStatus.SETTLED
            append_bond_event(
                db=db,
                holding_id=holding.id,
                user_id=current_user.id,
                event_type=BondEventType.SETTLED,
                amount_paise=payout_total,
                metadata={"principal_paise": holding.principal_paise, "interest_paise": accrued_interest}
            )
            settled_ids.append(holding.id)
            total_settlement_paise += payout_total

        db.commit()
    except Exception as e:
        db.rollback()
        api_error(500, "MATURED_SETTLEMENT_FAILED", "Matured settlement execution failed.", reason=str(e))

    return {
        "matured_count": len(matured_ids),
        "settled_count": len(settled_ids),
        "total_settlement_inr": total_settlement_paise / 100,
        "matured_holding_ids": matured_ids,
        "settled_holding_ids": settled_ids
    }


@router.get("/events")
def get_bond_events(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    events = db.query(BondEvent).filter(
        BondEvent.user_id == current_user.id
    ).order_by(BondEvent.created_at.desc()).all()

    result = []
    for event in events:
        result.append({
            "id": event.id,
            "holding_id": event.holding_id,
            "event_type": event.event_type.value,
            "amount_inr": event.amount_paise / 100,
            "metadata": json.loads(event.event_metadata) if event.event_metadata else {},
            "created_at": event.created_at.isoformat()
        })
    return {"events": result}

@router.get("/portfolio")
def get_portfolio(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    holdings = db.query(BondHolding).filter(BondHolding.user_id == current_user.id).order_by(BondHolding.acquired_at.desc()).all()
    results = []
    
    now = datetime.utcnow()
    
    for h in holdings:
        bond = db.query(Bond).filter(Bond.id == h.bond_id).first()
        if not bond:
            continue
        
        # Calculate mathematical fraction passed
        end_time = h.transferred_or_matured_at or now
        duration_held_seconds = (end_time - h.acquired_at).total_seconds()
        
        # Absolute hard stop at maturity ceiling natively tracking segmented holds
        effective_seconds = min(duration_held_seconds, bond.maturity_seconds)
        if effective_seconds < 0: effective_seconds = 0
        
        fraction = effective_seconds / bond.maturity_seconds if bond.maturity_seconds > 0 else 0
        
        # Real-time prototype yield (Normally APY is distributed 365, but we distribute cleanly over window for visual demo impact)
        total_yield_paise = h.principal_paise * (bond.apy_rate / 100.0)
        
        accrued_paise = total_yield_paise * fraction
        
        status = h.status.value
        # Auto-flip states dynamically based on chronological threshold
        if status == "ACTIVE" and duration_held_seconds >= bond.maturity_seconds:
            status = "MATURED_PENDING_SETTLEMENT"
            
        results.append({
            "id": h.id,
            "bond_name": bond.name,
            "principal_inr": h.principal_paise / 100,
            "accrued_interest_inr": accrued_paise / 100,
            "apy": bond.apy_rate,
            "fraction_ticking": fraction,
            "status": status,
            "purchased_at": h.acquired_at.isoformat()
        })
        
    return {"holdings": results}
