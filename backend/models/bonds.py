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
