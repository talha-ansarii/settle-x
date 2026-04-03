import json
from passlib.context import CryptContext
from sqlalchemy.orm import Session
from database.session import SessionLocal, engine, Base
from database.migrations import ensure_bond_catalog_columns
from models import *

# Ensure tables are built natively
Base.metadata.create_all(bind=engine)
ensure_bond_catalog_columns(engine)

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
            
        default_bonds = [
            {
                "name": "SettleX Rapid Treasury Bond",
                "isin": "INE0SETX0001",
                "credit_rating": "AAA",
                "apy_rate": 15.0,
                "ytm_rate": 14.75,
                "maturity_seconds": 60,
                "face_value_paise": 10000,
            },
            {
                "name": "Sovereign SDL 91D (Simulated)",
                "isin": "INE0SDL91D01",
                "credit_rating": "AAA",
                "apy_rate": 7.25,
                "ytm_rate": 7.1,
                "maturity_seconds": 86400,
                "face_value_paise": 100000,
            },
            {
                "name": "PSU Credit Note (Simulated)",
                "isin": "INE0PSUCRD01",
                "credit_rating": "AA+",
                "apy_rate": 8.5,
                "ytm_rate": 8.62,
                "maturity_seconds": 172800,
                "face_value_paise": 50000,
            },
        ]
        bonds_to_seed = config.get("bonds") or default_bonds
        for b in bonds_to_seed:
            if db.query(Bond).filter(Bond.isin == b["isin"]).first():
                continue
            db.add(
                Bond(
                    name=b["name"],
                    isin=b["isin"],
                    credit_rating=b["credit_rating"],
                    apy_rate=float(b["apy_rate"]),
                    ytm_rate=float(b["ytm_rate"]),
                    maturity_seconds=int(b["maturity_seconds"]),
                    face_value_paise=int(b["face_value_paise"]),
                    is_active=True,
                )
            )
            db.commit()
            
        accounts = config.get("accounts") or []
        if not accounts:
            print(
                "[INFO] No accounts in seedconfig.json — only bonds/system are seeded.\n"
                "       Create real users via the app (OTP), then set a transaction PIN on Payments.\n"
                "       First Main Wallet access grants a welcome balance (see get_wallet in api/payments.py).\n"
                "       Optional: add your mobiles under \"accounts\" with pin + starting_balance_paise to seed funded users."
            )
        for acc in accounts:
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
