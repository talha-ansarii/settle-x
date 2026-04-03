"""
One-time migration to add missing columns to bond_holdings on Neon.
Run:  python migrate_holdings.py
"""
from sqlalchemy import text, inspect
from database.session import engine
from models import *  # ensure all models registered

inspector = inspect(engine)
tables = inspector.get_table_names()
print(f"Tables found: {tables}")

if "bond_holdings" in tables:
    hold_cols = {c["name"] for c in inspector.get_columns("bond_holdings")}
    print(f"Existing bond_holdings columns: {hold_cols}")
    
    migrations = {
        "units":                    "ALTER TABLE bond_holdings ADD COLUMN units INTEGER NOT NULL DEFAULT 1",
        "cost_basis_paise":         "ALTER TABLE bond_holdings ADD COLUMN cost_basis_paise INTEGER NOT NULL DEFAULT 0",
        "realized_interest_paise":  "ALTER TABLE bond_holdings ADD COLUMN realized_interest_paise INTEGER NOT NULL DEFAULT 0",
        "origin_holding_id":        "ALTER TABLE bond_holdings ADD COLUMN origin_holding_id VARCHAR(36)",
    }
    
    with engine.begin() as conn:
        for col_name, ddl in migrations.items():
            if col_name not in hold_cols:
                conn.execute(text(ddl))
                print(f"  🔧 Added column '{col_name}' to bond_holdings")
            else:
                print(f"  ✓  Column '{col_name}' already exists")
    
    print("\n🎉 bond_holdings migration complete!")
else:
    print("❌ bond_holdings table does not exist yet")
