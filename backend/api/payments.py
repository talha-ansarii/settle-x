from __future__ import annotations

import json
import re

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
from core.settlement import SettlementEntry, execute_settlement_transaction
from core.transaction_types import TransactionTypes

router = APIRouter()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Welcome credit in paise (₹50,000) — stored as integer paise everywhere in ledger_entries.amount
WELCOME_BONUS_PAISE = 5_000_000

# Strip sender-only interest note from bond transfer descriptions for the recipient's ledger view.
_BOND_TRANSFER_SENDER_INTEREST_SUFFIX = re.compile(
    r" \(accrued interest ₹[\d.]+ credited to your balance\)$"
)


def _transaction_view_for_user(txn: Transaction, viewer_user_id: str, description: str, metadata: dict) -> tuple[str, dict]:
    """Recipients must not see how much accrued interest was credited to the sender."""
    md = dict(metadata) if metadata else {}
    desc = description
    if txn.transaction_type == TransactionTypes.BOND_TRANSFER and str(txn.user_id) != str(viewer_user_id):
        md.pop("accrued_interest_credited_paise", None)
        md.pop("slices", None)
        desc = _BOND_TRANSFER_SENDER_INTEREST_SUFFIX.sub("", desc)
    return desc, md


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
        
        # Inject welcome balance (double-entry when System Reserve exists — mirrors seed pattern)
        txn = Transaction(
            user_id=user_id,
            description="Welcome Bonus Initialization",
            transaction_type="WELCOME_BONUS",
            transaction_metadata=json.dumps(
                {"amount_paise": WELCOME_BONUS_PAISE, "purpose": "new_main_wallet"}
            ),
            status=TransactionStatus.COMPLETED,
        )
        db.add(txn)
        db.commit()
        db.refresh(txn)

        db.add(
            LedgerEntry(
                transaction_id=txn.id,
                account_id=wallet.id,
                direction=EntryDirection.DEBIT,
                amount=WELCOME_BONUS_PAISE,
            )
        )
        system_wallet = (
            db.query(LedgerAccount)
            .filter(
                LedgerAccount.is_system == True,
                LedgerAccount.account_type == AccountType.EQUITY,
                LedgerAccount.name == "System Reserve",
            )
            .first()
        )
        if system_wallet:
            db.add(
                LedgerEntry(
                    transaction_id=txn.id,
                    account_id=system_wallet.id,
                    direction=EntryDirection.CREDIT,
                    amount=WELCOME_BONUS_PAISE,
                )
            )
        db.commit()

    return wallet


def get_bond_portfolio_ledger_account(db: Session, user_id: str) -> LedgerAccount | None:
    return (
        db.query(LedgerAccount)
        .filter(
            LedgerAccount.user_id == user_id,
            LedgerAccount.name == "Bond Portfolio",
            LedgerAccount.account_type == AccountType.ASSET,
        )
        .first()
    )


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
    
    # 1. PIN Validation
    if not current_user.transaction_pin_hash:
        api_error(403, "PIN_NOT_SET", "Transaction PIN is not set.")
    if not pwd_context.verify(payload.pin, current_user.transaction_pin_hash):
        api_error(403, "INVALID_PIN", "Invalid PIN.")
        
    # 2. Recipient Check
    recipient = db.query(User).filter(User.mobile_number == recipient_num).first()
    if not recipient:
        api_error(404, "RECIPIENT_NOT_FOUND", "Recipient is not registered on SettleX network.")
        
    # 3. Balance Verification
    sender_wallet = get_wallet(db, current_user.id)
    sender_balance = calculate_balance(db, sender_wallet.id)
    
    if sender_balance < payload.amount_paise:
        api_error(400, "INSUFFICIENT_BALANCE", "Insufficient Wallet Balance.")
        
    # 4. Execute Double Entry Ledger Logic
    recipient_wallet = get_wallet(db, recipient.id)
    
    try:
        result = execute_settlement_transaction(
            db=db,
            user_id=current_user.id, 
            description=f"P2P Transfer to +91 {recipient_num}",
            transaction_type=TransactionTypes.P2P,
            idempotency_key=payload.idempotency_key,
            metadata={
                "amount_paise": payload.amount_paise,
                "recipient_mobile": recipient_num,
                "recipient_user_id": recipient.id,
                "sender_user_id": current_user.id,
                "sender_mobile": current_user.mobile_number,
            },
            entries=[
                SettlementEntry(
                    account_id=sender_wallet.id,
                    direction=EntryDirection.CREDIT,
                    amount=payload.amount_paise
                ),
                SettlementEntry(
                    account_id=recipient_wallet.id,
                    direction=EntryDirection.DEBIT,
                    amount=payload.amount_paise
                ),
            ]
        )
        if result.idempotent_replay:
            return {
                "message": "Payment already processed",
                "transaction_id": result.transaction.id,
                "status": result.transaction.status
            }
    except Exception as e:
        api_error(500, "LEDGER_TXN_FAILED", "Ledger transaction failed.", reason=str(e))
        
    return {
        "message": "Transfer Successful",
        "transaction_id": result.transaction.id,
        "amount_inr": payload.amount_paise / 100
    }

@router.get("/transactions")
def get_transactions(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    wallet = get_wallet(db, current_user.id)
    bond_acct = get_bond_portfolio_ledger_account(db, current_user.id)
    account_ids = [wallet.id]
    if bond_acct:
        account_ids.append(bond_acct.id)

    entries = (
        db.query(LedgerEntry, Transaction)
        .join(Transaction, LedgerEntry.transaction_id == Transaction.id)
        .filter(LedgerEntry.account_id.in_(account_ids))
        .order_by(Transaction.posted_date.desc(), LedgerEntry.id.desc())
        .limit(200)
        .all()
    )

    results = []
    for entry, txn in entries:
        ledger_label = "CASH" if entry.account_id == wallet.id else "BOND_PORTFOLIO"
        raw_md = json.loads(txn.transaction_metadata) if txn.transaction_metadata else {}
        desc, md = _transaction_view_for_user(txn, current_user.id, txn.description or "", raw_md)
        results.append(
            {
                "id": txn.id,
                "description": desc,
                "transaction_type": txn.transaction_type,
                "metadata": md,
                "direction": entry.direction.value,
                "amount_inr": entry.amount / 100,
                "status": txn.status.value,
                "date": txn.posted_date.isoformat(),
                "ledger_account": ledger_label,
                "ledger_entry_id": entry.id,
            }
        )
    return {"transactions": results}
