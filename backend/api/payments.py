from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy.sql import func
from passlib.context import CryptContext

from database.session import get_db
from models.user import User
from models.ledger import LedgerAccount, AccountType, Transaction, LedgerEntry, EntryDirection, TransactionStatus
from schemas.payments import PinSetup, TransferRequest
from api.deps import get_current_user
from core.http import api_error

router = APIRouter()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def get_wallet(db: Session, user_id: str) -> LedgerAccount:
    """Gets or securely provisions a Main Wallet Asset account for a user."""
    wallet = db.query(LedgerAccount).filter(
        LedgerAccount.user_id == user_id, 
        LedgerAccount.name == "Main Wallet",
        LedgerAccount.account_type == AccountType.ASSET
    ).first()

    # Backward compatibility for older seeded wallets.
    if not wallet:
        wallet = db.query(LedgerAccount).filter(
            LedgerAccount.user_id == user_id,
            LedgerAccount.name == "SettleX Main Wallet",
            LedgerAccount.account_type == AccountType.ASSET
        ).first()
        if wallet:
            wallet.name = "Main Wallet"
            db.commit()
            db.refresh(wallet)
    
    if not wallet:
        wallet = LedgerAccount(user_id=user_id, name="Main Wallet", account_type=AccountType.ASSET)
        db.add(wallet)
        # Give them some mock test funds if it's a new wallet for testing
        db.commit()
        db.refresh(wallet)
        
        # Inject 50,000 INR natively to test network
        txn = Transaction(user_id=user_id, description="Welcome Bonus Initialization", status=TransactionStatus.COMPLETED)
        db.add(txn)
        db.commit()
        db.refresh(txn)
        
        entry = LedgerEntry(transaction_id=txn.id, account_id=wallet.id, direction=EntryDirection.DEBIT, amount=5000000)
        db.add(entry)
        db.commit()
        
    return wallet

def calculate_balance(db: Session, account_id: str) -> int:
    """Calculates active balance mapping Asset properties natively."""
    debits = db.query(func.sum(LedgerEntry.amount)).filter(
        LedgerEntry.account_id == account_id, 
        LedgerEntry.direction == EntryDirection.DEBIT
    ).scalar() or 0
    
    credits = db.query(func.sum(LedgerEntry.amount)).filter(
        LedgerEntry.account_id == account_id, 
        LedgerEntry.direction == EntryDirection.CREDIT
    ).scalar() or 0
    
    # Asset definition: Debits increase, Credits decrease
    return debits - credits

@router.post("/setup-pin")
def setup_pin(payload: PinSetup, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    hashed_pin = pwd_context.hash(payload.pin)
    current_user.transaction_pin_hash = hashed_pin
    db.commit()
    return {"message": "Transaction PIN activated securely."}

@router.get("/balance")
def get_balance(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    wallet = get_wallet(db, current_user.id)
    balance_paise = calculate_balance(db, wallet.id)
    return {
        "wallet_id": wallet.id,
        "balance_paise": balance_paise,
        "balance_inr": balance_paise / 100,
        "pin_set": current_user.transaction_pin_hash is not None
    }

@router.post("/transfer")
def execute_transfer(payload: TransferRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    # 0. Formatting
    recipient_num = payload.recipient_mobile.replace("+91", "").replace(" ", "")
    if current_user.mobile_number == recipient_num:
        api_error(400, "SELF_TRANSFER_BLOCKED", "Cannot transfer to yourself.")
    
    if payload.amount_paise <= 0:
         api_error(400, "INVALID_AMOUNT", "Invalid transfer amount.")
    
    # 1. Idempotency Check
    existing_txn = db.query(Transaction).filter(Transaction.idempotency_key == payload.idempotency_key).first()
    if existing_txn:
        if existing_txn.status == TransactionStatus.COMPLETED:
            return {"message": "Payment already processed", "transaction_id": existing_txn.id, "status": existing_txn.status}
        if existing_txn.status == TransactionStatus.FAILED:
            # Allow safe retries after a failed internal attempt.
            db.query(LedgerEntry).filter(LedgerEntry.transaction_id == existing_txn.id).delete()
            db.delete(existing_txn)
            db.commit()
        else:
            return {"message": "Payment already processed", "transaction_id": existing_txn.id, "status": existing_txn.status}
        
    # 2. PIN Validation
    if not current_user.transaction_pin_hash:
        api_error(403, "PIN_NOT_SET", "Transaction PIN is not set.")
    if not pwd_context.verify(payload.pin, current_user.transaction_pin_hash):
        api_error(403, "INVALID_PIN", "Invalid PIN.")
        
    # 3. Recipient Check
    recipient = db.query(User).filter(User.mobile_number == recipient_num).first()
    if not recipient:
        api_error(404, "RECIPIENT_NOT_FOUND", "Recipient is not registered on SettleX network.")
        
    # 4. Balance Verification
    sender_wallet = get_wallet(db, current_user.id)
    sender_balance = calculate_balance(db, sender_wallet.id)
    
    if sender_balance < payload.amount_paise:
        api_error(400, "INSUFFICIENT_BALANCE", "Insufficient Wallet Balance.")
        
    # 5. Execute Double Entry Ledger Logic
    recipient_wallet = get_wallet(db, recipient.id)
    
    try:
        txn = Transaction(
            user_id=current_user.id, 
            idempotency_key=payload.idempotency_key,
            description=f"P2P Transfer to {recipient_num}",
            status=TransactionStatus.PENDING
        )
        db.add(txn)
        db.flush() # flush to get txn ID before entries
        
        # We decrease sender asset via CREDIT
        credit_entry = LedgerEntry(
            transaction_id=txn.id,
            account_id=sender_wallet.id,
            direction=EntryDirection.CREDIT,
            amount=payload.amount_paise
        )
        # We increase recipient asset via DEBIT
        debit_entry = LedgerEntry(
            transaction_id=txn.id,
            account_id=recipient_wallet.id,
            direction=EntryDirection.DEBIT,
            amount=payload.amount_paise
        )
        db.add(credit_entry)
        db.add(debit_entry)
        txn.status = TransactionStatus.COMPLETED
        
        db.commit()
    except Exception as e:
        db.rollback()
        failed_txn = Transaction(
            user_id=current_user.id,
            idempotency_key=payload.idempotency_key,
            description=f"P2P Transfer to {recipient_num}",
            status=TransactionStatus.FAILED
        )
        db.add(failed_txn)
        db.commit()
        api_error(500, "LEDGER_TXN_FAILED", "Ledger transaction failed.", reason=str(e))
        
    return {
        "message": "Transfer Successful",
        "transaction_id": txn.id,
        "amount_inr": payload.amount_paise / 100
    }

@router.get("/transactions")
def get_transactions(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    wallet = get_wallet(db, current_user.id)
    
    entries = db.query(LedgerEntry, Transaction).join(
        Transaction, LedgerEntry.transaction_id == Transaction.id
    ).filter(
        LedgerEntry.account_id == wallet.id
    ).order_by(Transaction.posted_date.desc()).all()
    
    results = []
    for entry, txn in entries:
        results.append({
            "id": txn.id,
            "description": txn.description,
            "direction": entry.direction.value, # DEBIT (Money Received via Asset Increase), CREDIT (Money Sent via Asset Decrease)
            "amount_inr": entry.amount / 100,
            "status": txn.status.value,
            "date": txn.posted_date.isoformat()
        })
    return {"transactions": results}
