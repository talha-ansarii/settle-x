import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Enum, ForeignKey, Integer, String

from database.session import Base


class ProviderPaymentStatus(str, enum.Enum):
    CREATED = "CREATED"
    AUTHORIZED = "AUTHORIZED"
    CAPTURED = "CAPTURED"
    FAILED = "FAILED"
    REFUNDED = "REFUNDED"


class ReconciliationStatus(str, enum.Enum):
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class ProviderTransaction(Base):
    __tablename__ = "provider_transactions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id"), index=True, nullable=False)
    provider = Column(String, index=True, nullable=False, default="DEMO_PAY")
    provider_order_id = Column(String, unique=True, index=True, nullable=False)
    provider_payment_id = Column(String, unique=True, index=True, nullable=True)
    amount_paise = Column(Integer, nullable=False)
    currency = Column(String, nullable=False, default="INR")
    status = Column(Enum(ProviderPaymentStatus), nullable=False, default=ProviderPaymentStatus.CREATED)
    idempotency_key = Column(String, unique=True, index=True, nullable=True)
    metadata = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class ProviderWebhookLog(Base):
    __tablename__ = "provider_webhook_logs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    provider = Column(String, index=True, nullable=False, default="DEMO_PAY")
    event_type = Column(String, index=True, nullable=False)
    event_id = Column(String, unique=True, index=True, nullable=True)
    signature_valid = Column(Boolean, nullable=False, default=False)
    processed = Column(Boolean, nullable=False, default=False)
    payload = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class ReconciliationRun(Base):
    __tablename__ = "reconciliation_runs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    provider = Column(String, index=True, nullable=False, default="DEMO_PAY")
    status = Column(Enum(ReconciliationStatus), nullable=False, default=ReconciliationStatus.RUNNING)
    total_records = Column(Integer, nullable=False, default=0)
    matched_records = Column(Integer, nullable=False, default=0)
    mismatched_records = Column(Integer, nullable=False, default=0)
    details = Column(String, nullable=True)
    started_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    completed_at = Column(DateTime, nullable=True)


class ReconciliationMismatch(Base):
    __tablename__ = "reconciliation_mismatches"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    run_id = Column(String(36), ForeignKey("reconciliation_runs.id"), index=True, nullable=False)
    provider = Column(String, index=True, nullable=False, default="DEMO_PAY")
    provider_order_id = Column(String, index=True, nullable=False)
    local_status = Column(String, nullable=False)
    provider_status = Column(String, nullable=False)
    local_amount_paise = Column(Integer, nullable=False, default=0)
    provider_amount_paise = Column(Integer, nullable=False, default=0)
    reason = Column(String, nullable=False)
    resolved = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
