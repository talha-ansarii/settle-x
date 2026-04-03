from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine


def ensure_bond_catalog_columns(engine: Engine):
    """Adds bond catalog / holding lineage columns that may be missing from the DB."""
    inspector = inspect(engine)
    tables = inspector.get_table_names()
    if "bonds" not in tables or "bond_holdings" not in tables:
        return

    bond_cols = {c["name"] for c in inspector.get_columns("bonds")}
    hold_cols = {c["name"] for c in inspector.get_columns("bond_holdings")}

    with engine.begin() as conn:
        if "isin" not in bond_cols:
            conn.execute(text("ALTER TABLE bonds ADD COLUMN isin VARCHAR NOT NULL DEFAULT ''"))
        if "credit_rating" not in bond_cols:
            conn.execute(text("ALTER TABLE bonds ADD COLUMN credit_rating VARCHAR NOT NULL DEFAULT 'NR'"))
        if "ytm_rate" not in bond_cols:
            conn.execute(text("ALTER TABLE bonds ADD COLUMN ytm_rate FLOAT NOT NULL DEFAULT 0"))
        if "face_value_paise" not in bond_cols:
            conn.execute(text("ALTER TABLE bonds ADD COLUMN face_value_paise INTEGER NOT NULL DEFAULT 10000"))

        if "units" not in hold_cols:
            conn.execute(text("ALTER TABLE bond_holdings ADD COLUMN units INTEGER NOT NULL DEFAULT 1"))
        if "cost_basis_paise" not in hold_cols:
            conn.execute(text("ALTER TABLE bond_holdings ADD COLUMN cost_basis_paise INTEGER NOT NULL DEFAULT 0"))
        if "realized_interest_paise" not in hold_cols:
            conn.execute(text("ALTER TABLE bond_holdings ADD COLUMN realized_interest_paise INTEGER NOT NULL DEFAULT 0"))
        if "origin_holding_id" not in hold_cols:
            conn.execute(text("ALTER TABLE bond_holdings ADD COLUMN origin_holding_id VARCHAR"))

        conn.execute(
            text(
                """
                UPDATE bonds
                SET
                  isin = CASE
                    WHEN isin IS NULL OR TRIM(isin) = '' THEN 'IN' || UPPER(SUBSTR(REPLACE(id, '-', ''), 1, 10))
                    ELSE isin
                  END,
                  credit_rating = CASE
                    WHEN credit_rating IS NULL OR TRIM(credit_rating) = '' THEN 'AAA'
                    ELSE credit_rating
                  END,
                  ytm_rate = CASE WHEN ytm_rate IS NULL OR ytm_rate <= 0 THEN apy_rate ELSE ytm_rate END,
                  face_value_paise = CASE WHEN face_value_paise IS NULL OR face_value_paise <= 0 THEN 10000 ELSE face_value_paise END
                WHERE isin IS NULL OR TRIM(isin) = ''
                   OR ytm_rate IS NULL OR ytm_rate <= 0
                   OR face_value_paise IS NULL OR face_value_paise <= 0
                   OR credit_rating IS NULL OR TRIM(credit_rating) = ''
                """
            )
        )

        rows = conn.execute(
            text(
                """
                SELECT bh.id, bh.principal_paise, COALESCE(b.face_value_paise, 10000) AS fv
                FROM bond_holdings bh
                JOIN bonds b ON b.id = bh.bond_id
                WHERE bh.cost_basis_paise IS NULL OR bh.cost_basis_paise = 0
                   OR bh.units IS NULL OR bh.units <= 0
                """
            )
        ).fetchall()

        for hid, principal, fv in rows:
            safe_fv = max(1, int(fv))
            units = max(1, int(principal) // safe_fv)
            conn.execute(
                text(
                    """
                    UPDATE bond_holdings
                    SET cost_basis_paise = :principal, units = :units
                    WHERE id = :hid
                    """
                ),
                {"principal": principal, "units": units, "hid": hid},
            )


def ensure_sqlite_legacy_columns(engine: Engine):
    """Adds newly introduced columns for local SQLite DBs without full Alembic migration."""
    if not str(engine.url).startswith("sqlite"):
        return

    inspector = inspect(engine)
    existing_columns = {col["name"] for col in inspector.get_columns("transactions")}

    with engine.begin() as conn:
        if "transaction_type" not in existing_columns:
            conn.execute(
                text("ALTER TABLE transactions ADD COLUMN transaction_type VARCHAR NOT NULL DEFAULT 'GENERIC'")
            )
        if "transaction_metadata" not in existing_columns:
            conn.execute(
                text("ALTER TABLE transactions ADD COLUMN transaction_metadata VARCHAR")
            )

