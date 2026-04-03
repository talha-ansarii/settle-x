from datetime import datetime
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel

from database.session import get_db
from models.user import User
from models.bonds import Bond, BondHolding, HoldingStatus
from models.ledger import LedgerAccount, AccountType, Transaction, TransactionStatus, LedgerEntry, EntryDirection
from api.deps import get_current_user
from api.payments import get_wallet, calculate_balance
from core.http import api_error

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
        txn.status = TransactionStatus.COMPLETED
        
        db.commit()
    except Exception as e:
        db.rollback()
        failed_txn = Transaction(
            user_id=current_user.id,
            description=f"Automated Allocation to {target_bond.name}",
            ai_category="INVESTMENTS",
            status=TransactionStatus.FAILED
        )
        db.add(failed_txn)
        db.commit()
        api_error(500, "BOND_PURCHASE_FAILED", "Bond purchase failed.", reason=str(e))
        
    return {"message": f"Successfully procured {payload.amount_paise/100} INR allocation inside {target_bond.name}"}

@router.get("/portfolio")
def get_portfolio(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    holdings = db.query(BondHolding).filter(BondHolding.user_id == current_user.id).order_by(BondHolding.acquired_at.desc()).all()
    results = []
    
    now = datetime.utcnow()
    
    for h in holdings:
        bond = db.query(Bond).filter(Bond.id == h.bond_id).first()
        
        # Calculate mathematical fraction passed
        end_time = h.transferred_or_matured_at or now
        duration_held_seconds = (end_time - h.acquired_at).total_seconds()
        
        # Absolute hard stop at maturity ceiling natively tracking segmented holds
        effective_seconds = min(duration_held_seconds, bond.maturity_seconds)
        if effective_seconds < 0: effective_seconds = 0
        
        fraction = effective_seconds / bond.maturity_seconds
        
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
