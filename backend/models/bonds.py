import uuid
import enum
from datetime import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey, Integer, Enum, Boolean, Float
from database.session import Base

class Bond(Base):
    __tablename__ = "bonds"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False)
    apy_rate = Column(Float, nullable=False) # e.g. 5.5 = 5.5% APY
    maturity_seconds = Column(Integer, nullable=False) # For demo hacking, seconds instead of days
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class HoldingStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    TRANSFERRED = "TRANSFERRED"
    MATURED = "MATURED"
    SETTLED = "SETTLED"

class BondHolding(Base):
    __tablename__ = "bond_holdings"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    bond_id = Column(String(36), ForeignKey("bonds.id"), index=True, nullable=False)
    user_id = Column(String(36), ForeignKey("users.id"), index=True, nullable=False)
    principal_paise = Column(Integer, nullable=False) # They can hold fractional chunks of a generalized bond
    
    acquired_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    # Allows us to definitively lock time logic when the user mathematically stops accumulating interest on this block!
    transferred_or_matured_at = Column(DateTime, nullable=True) 
    status = Column(Enum(HoldingStatus), default=HoldingStatus.ACTIVE)


class BondEventType(str, enum.Enum):
    PURCHASED = "PURCHASED"
    TRANSFER_OUT = "TRANSFER_OUT"
    TRANSFER_IN = "TRANSFER_IN"
    MATURED = "MATURED"
    REDEEMED = "REDEEMED"
    SETTLED = "SETTLED"


class BondEvent(Base):
    __tablename__ = "bond_events"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    holding_id = Column(String(36), ForeignKey("bond_holdings.id"), index=True, nullable=False)
    user_id = Column(String(36), ForeignKey("users.id"), index=True, nullable=False)
    event_type = Column(Enum(BondEventType), nullable=False)
    amount_paise = Column(Integer, nullable=False, default=0)
    event_metadata = Column("metadata", String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class RiskTier(str, enum.Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"


class BondRiskProfile(Base):
    __tablename__ = "bond_risk_profiles"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    bond_id = Column(String(36), ForeignKey("bonds.id"), unique=True, index=True, nullable=False)
    issuer_type = Column(String, nullable=False, default="GOVERNMENT_SIMULATED")
    safety_score = Column(Integer, nullable=False, default=80)  # 0-100
    liquidity_score = Column(Integer, nullable=False, default=70)  # 0-100
    risk_tier = Column(Enum(RiskTier), nullable=False, default=RiskTier.LOW)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class RecommendationStatus(str, enum.Enum):
    GENERATED = "GENERATED"
    ACCEPTED = "ACCEPTED"
    REJECTED = "REJECTED"


class BondRecommendation(Base):
    __tablename__ = "bond_recommendations"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id"), index=True, nullable=False)
    recommended_bond_id = Column(String(36), ForeignKey("bonds.id"), index=True, nullable=False)
    requested_amount_paise = Column(Integer, nullable=False)
    recommended_allocation_paise = Column(Integer, nullable=False)
    expected_apy = Column(Float, nullable=False)
    safety_score = Column(Integer, nullable=False)
    liquidity_score = Column(Integer, nullable=False)
    ranking_score = Column(Float, nullable=False)
    status = Column(Enum(RecommendationStatus), nullable=False, default=RecommendationStatus.GENERATED)
    policy_version = Column(String, nullable=False, default="v1")
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class BondRecommendationAudit(Base):
    __tablename__ = "bond_recommendation_audits"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    recommendation_id = Column(String(36), ForeignKey("bond_recommendations.id"), unique=True, index=True, nullable=False)
    user_id = Column(String(36), ForeignKey("users.id"), index=True, nullable=False)
    input_snapshot = Column(String, nullable=False)  # JSON
    candidate_snapshot = Column(String, nullable=False)  # JSON
    decision_snapshot = Column(String, nullable=False)  # JSON
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
