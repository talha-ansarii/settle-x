import json
from passlib.context import CryptContext
from sqlalchemy.orm import Session
from database.session import SessionLocal, engine, Base
from models import *

# Ensure tables are built natively
Base.metadata.create_all(bind=engine)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def run_seed():
    db = SessionLocal()
    try:
        with open("seedconfig.json", "r") as f:
            config = json.load(f)
            
        print("\n=== Initiating Database Ledger Seeding ===")
        
        # Establish the System Equity Account to offset the generated money 
        # (This preserves strict double-entry mathematical integrity)
        system_wallet = db.query(LedgerAccount).filter(LedgerAccount.is_system == True).first()
        if not system_wallet:
            sys_user = db.query(User).filter(User.mobile_number == "0000000000").first()
            if not sys_user:
                sys_user = User(mobile_number="0000000000", business_name="Central Bank Reserve")
                db.add(sys_user)
                db.commit()
                db.refresh(sys_user)
                
            system_wallet = LedgerAccount(user_id=sys_user.id, name="System Reserve", account_type=AccountType.EQUITY, is_system=True)
            db.add(system_wallet)
            db.commit()
            db.refresh(system_wallet)
            
        # Ensure benchmark Treasury Bond is alive
        benchmark_bond = db.query(Bond).filter(Bond.name == "SettleX Rapid Treasury Bond").first()
        if not benchmark_bond:
            # Setting extremely aggressive short maturity strictly for demonstration capabilities
            benchmark_bond = Bond(name="SettleX Rapid Treasury Bond", apy_rate=15.0, maturity_seconds=60)
            db.add(benchmark_bond)
            db.commit()
            
        for acc in config.get("accounts", []):
            mobile = acc["mobile_number"]
            # Check if user already exists
            user = db.query(User).filter(User.mobile_number == mobile).first()
            if user:
                print(f"[SKIP] User {mobile} already exists inside the network.")
                continue
                
            # Create user and encrypt their standard testing PIN
            hashed_pin = pwd_context.hash(str(acc["pin"]))
            user = User(
                mobile_number=mobile,
                business_name=acc["business_name"],
                transaction_pin_hash=hashed_pin
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            
            # Standardize the wallet hook
            wallet = LedgerAccount(
                user_id=user.id,
                name="Main Wallet",
                account_type=AccountType.ASSET
            )
            db.add(wallet)
            db.commit()
            db.refresh(wallet)
            
            # Map starting balancing funds flawlessly via DB transactions avoiding direct mutations
            amt = acc["starting_balance_paise"]
            if amt > 0:
                txn = Transaction(
                    user_id=user.id,
                    description="Seed Initialization Funding",
                    status=TransactionStatus.COMPLETED
                )
                db.add(txn)
                db.flush() # Secure native ID
                
                # Target decrease upon System Reserve
                credit_entry = LedgerEntry(
                    transaction_id=txn.id,
                    account_id=system_wallet.id,
                    direction=EntryDirection.CREDIT,
                    amount=amt
                )
                db.add(credit_entry)
                
                # Target Asset augment on local user Wallet
                debit_entry = LedgerEntry(
                    transaction_id=txn.id,
                    account_id=wallet.id,
                    direction=EntryDirection.DEBIT,
                    amount=amt
                )
                db.add(debit_entry)
                
                db.commit()
                
            print(f"[SUCCESS] Bootstrapped: +91 {mobile} | '{acc['business_name']}' | Auth PIN: {acc['pin']} | Avail. Bal: ₹{amt/100}")
            
    except Exception as e:
        print(f"Failed to seed: {e}")
        db.rollback()
    finally:
        db.close()
        print("=== Database Seed Offline ===\n")

if __name__ == "__main__":
    run_seed()
