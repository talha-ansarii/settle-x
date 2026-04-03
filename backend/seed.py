"""
Seed script — migrates missing columns, then upserts bonds from seedconfig.json.
Usage:  python seed.py
"""
import json
from sqlalchemy import text, inspect
from database.session import SessionLocal, engine, Base
from models.bonds import Bond

# Ensure all NEW tables are created (won't touch existing ones)
Base.metadata.create_all(bind=engine)


def migrate_bonds_table():
    """Add any columns from the Bond model that are missing in the DB."""
    inspector = inspect(engine)
    existing_cols = {col["name"] for col in inspector.get_columns("bonds")}

    # Columns that may have been added to the model after initial table creation
    migrations = {
        "isin":             "ALTER TABLE bonds ADD COLUMN isin VARCHAR NOT NULL DEFAULT ''",
        "credit_rating":    "ALTER TABLE bonds ADD COLUMN credit_rating VARCHAR NOT NULL DEFAULT 'NR'",
        "ytm_rate":         "ALTER TABLE bonds ADD COLUMN ytm_rate FLOAT NOT NULL DEFAULT 0.0",
        "face_value_paise": "ALTER TABLE bonds ADD COLUMN face_value_paise INTEGER NOT NULL DEFAULT 10000",
    }

    with engine.begin() as conn:
        for col_name, ddl in migrations.items():
            if col_name not in existing_cols:
                conn.execute(text(ddl))
                print(f"  🔧 Migrated: added column '{col_name}' to bonds table")
            else:
                print(f"  ✓  Column '{col_name}' already exists")


def seed():
    with open("seedconfig.json", "r") as f:
        config = json.load(f)

    db = SessionLocal()
    try:
        for bond_data in config.get("bonds", []):
            existing = db.query(Bond).filter(Bond.isin == bond_data["isin"]).first()
            if existing:
                for key, value in bond_data.items():
                    setattr(existing, key, value)
                print(f"  ✏️  Updated: {bond_data['name']} ({bond_data['isin']})")
            else:
                bond = Bond(**bond_data)
                db.add(bond)
                print(f"  ✅ Created: {bond_data['name']} ({bond_data['isin']})")

        db.commit()
        print(f"\n🎉 Seeded {len(config.get('bonds', []))} bond(s) successfully.")
    except Exception as e:
        db.rollback()
        print(f"❌ Seed failed: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    print("--- Step 1: Migrate missing columns ---")
    migrate_bonds_table()
    print("\n--- Step 2: Seed bond data ---")
    seed()
