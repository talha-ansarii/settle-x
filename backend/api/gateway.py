import json
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, Header
from sqlalchemy.orm import Session

from api.deps import get_current_user
from core.config import settings
from core.http import api_error
from database.session import get_db
from models.provider import (
    ProviderPaymentStatus,
    ProviderTransaction,
    ProviderWebhookLog,
    ReconciliationMismatch,
    ReconciliationRun,
    ReconciliationStatus,
)
from models.user import User
from schemas.gateway import CreateProviderOrderRequest, ProviderWebhookRequest

router = APIRouter()


def _to_provider_status(status: str) -> ProviderPaymentStatus:
    normalized = (status or "").strip().upper()
    mapping = {
        "CREATED": ProviderPaymentStatus.CREATED,
        "AUTHORIZED": ProviderPaymentStatus.AUTHORIZED,
        "CAPTURED": ProviderPaymentStatus.CAPTURED,
        "FAILED": ProviderPaymentStatus.FAILED,
        "REFUNDED": ProviderPaymentStatus.REFUNDED,
    }
    if normalized in mapping:
        return mapping[normalized]
    api_error(400, "INVALID_PROVIDER_STATUS", f"Unsupported provider status: {status}")
    raise RuntimeError("unreachable")


@router.post("/create-order")
def create_order(
    payload: CreateProviderOrderRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if payload.amount_paise <= 0:
        api_error(400, "INVALID_AMOUNT", "amount_paise must be greater than zero.")

    if payload.idempotency_key:
        existing = db.query(ProviderTransaction).filter(
            ProviderTransaction.idempotency_key == payload.idempotency_key
        ).first()
        if existing:
            return {
                "provider_order_id": existing.provider_order_id,
                "provider": existing.provider,
                "status": existing.status.value,
                "amount_inr": existing.amount_paise / 100,
                "idempotent_replay": True,
            }

    provider_order_id = f"demo_ord_{uuid.uuid4().hex[:16]}"
    record = ProviderTransaction(
        user_id=current_user.id,
        provider=payload.provider,
        provider_order_id=provider_order_id,
        amount_paise=payload.amount_paise,
        status=ProviderPaymentStatus.CREATED,
        idempotency_key=payload.idempotency_key,
        metadata=json.dumps(payload.metadata) if payload.metadata else None,
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    return {
        "provider_order_id": record.provider_order_id,
        "provider": record.provider,
        "status": record.status.value,
        "amount_inr": record.amount_paise / 100,
        "idempotent_replay": False,
    }


@router.post("/webhook")
def ingest_webhook(
    payload: ProviderWebhookRequest,
    db: Session = Depends(get_db),
    x_webhook_signature: str | None = Header(default=None),
):
    signature_secret = settings.PAYMENT_WEBHOOK_SECRET or settings.SECRET_KEY
    signature_valid = x_webhook_signature == signature_secret

    webhook = ProviderWebhookLog(
        provider=payload.provider,
        event_type=payload.event_type,
        event_id=payload.event_id,
        signature_valid=signature_valid,
        processed=False,
        payload=json.dumps(payload.model_dump()),
    )
    db.add(webhook)
    db.flush()

    if not signature_valid:
        db.commit()
        api_error(401, "INVALID_WEBHOOK_SIGNATURE", "Webhook signature validation failed.")

    tx = db.query(ProviderTransaction).filter(
        ProviderTransaction.provider_order_id == payload.provider_order_id
    ).first()
    if not tx:
        webhook.processed = True
        db.add(webhook)
        db.commit()
        api_error(404, "PROVIDER_ORDER_NOT_FOUND", "Provider order does not exist.")

    tx.status = _to_provider_status(payload.status)
    if payload.provider_payment_id:
        tx.provider_payment_id = payload.provider_payment_id
    tx.amount_paise = payload.amount_paise
    webhook.processed = True
    db.add(tx)
    db.add(webhook)
    db.commit()

    return {"message": "Webhook processed.", "provider_order_id": tx.provider_order_id, "status": tx.status.value}


@router.post("/reconcile-run")
def run_reconciliation(
    provider: str = "DEMO_PAY",
    db: Session = Depends(get_db),
):
    run = ReconciliationRun(provider=provider, status=ReconciliationStatus.RUNNING)
    db.add(run)
    db.flush()

    rows = db.query(ProviderTransaction).filter(ProviderTransaction.provider == provider).all()
    total = len(rows)
    matched = 0
    mismatched = 0

    try:
        for row in rows:
            provider_status = row.status.value
            provider_amount = row.amount_paise
            metadata = {}
            if row.metadata:
                try:
                    metadata = json.loads(row.metadata)
                except Exception:
                    metadata = {}

            # Demo simulation hooks to surface reconciliation mismatches.
            if isinstance(metadata.get("force_provider_status"), str):
                provider_status = metadata["force_provider_status"].strip().upper()
            if isinstance(metadata.get("force_provider_amount_paise"), int):
                provider_amount = int(metadata["force_provider_amount_paise"])

            local_status = row.status.value
            local_amount = row.amount_paise
            is_match = provider_status == local_status and provider_amount == local_amount

            if is_match:
                matched += 1
                continue

            mismatched += 1
            reason_parts = []
            if provider_status != local_status:
                reason_parts.append("status_mismatch")
            if provider_amount != local_amount:
                reason_parts.append("amount_mismatch")
            reason = ",".join(reason_parts) if reason_parts else "unknown_mismatch"

            db.add(
                ReconciliationMismatch(
                    run_id=run.id,
                    provider=provider,
                    provider_order_id=row.provider_order_id,
                    local_status=local_status,
                    provider_status=provider_status,
                    local_amount_paise=local_amount,
                    provider_amount_paise=provider_amount,
                    reason=reason,
                    resolved=False,
                )
            )

        run.total_records = total
        run.matched_records = matched
        run.mismatched_records = mismatched
        run.status = ReconciliationStatus.COMPLETED
        run.details = json.dumps({"note": "demo reconciliation complete"})
        run.completed_at = datetime.utcnow()
        db.add(run)
        db.commit()
    except Exception as e:
        db.rollback()
        run.status = ReconciliationStatus.FAILED
        run.details = json.dumps({"error": str(e)})
        run.completed_at = datetime.utcnow()
        db.add(run)
        db.commit()
        api_error(500, "RECONCILIATION_FAILED", "Reconciliation run failed.", reason=str(e))

    return {
        "run_id": run.id,
        "provider": run.provider,
        "status": run.status.value,
        "total_records": run.total_records,
        "matched_records": run.matched_records,
        "mismatched_records": run.mismatched_records,
        "completed_at": run.completed_at.isoformat() if run.completed_at else None,
    }


@router.get("/reconcile-runs")
def list_reconciliation_runs(
    provider: str = "DEMO_PAY",
    limit: int = 10,
    db: Session = Depends(get_db),
):
    if limit <= 0:
        limit = 10
    runs = (
        db.query(ReconciliationRun)
        .filter(ReconciliationRun.provider == provider)
        .order_by(ReconciliationRun.started_at.desc())
        .limit(limit)
        .all()
    )
    return {
        "runs": [
            {
                "run_id": r.id,
                "provider": r.provider,
                "status": r.status.value,
                "total_records": r.total_records,
                "matched_records": r.matched_records,
                "mismatched_records": r.mismatched_records,
                "started_at": r.started_at.isoformat(),
                "completed_at": r.completed_at.isoformat() if r.completed_at else None,
            }
            for r in runs
        ]
    }


@router.get("/mismatches")
def list_reconciliation_mismatches(
    provider: str = "DEMO_PAY",
    unresolved_only: bool = True,
    db: Session = Depends(get_db),
):
    query = db.query(ReconciliationMismatch).filter(ReconciliationMismatch.provider == provider)
    if unresolved_only:
        query = query.filter(ReconciliationMismatch.resolved == False)
    mismatches = query.order_by(ReconciliationMismatch.created_at.desc()).limit(50).all()
    return {
        "mismatches": [
            {
                "id": m.id,
                "run_id": m.run_id,
                "provider_order_id": m.provider_order_id,
                "local_status": m.local_status,
                "provider_status": m.provider_status,
                "local_amount_inr": m.local_amount_paise / 100,
                "provider_amount_inr": m.provider_amount_paise / 100,
                "reason": m.reason,
                "resolved": m.resolved,
                "created_at": m.created_at.isoformat(),
            }
            for m in mismatches
        ]
    }

