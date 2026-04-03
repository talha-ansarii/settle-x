from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.declarative import declarative_base

from core.config import settings

import os

db_url = settings.DATABASE_URL
# Fix Neon DB / SQLAlchemy 2.0+ compatibility issue
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)

# Vercel functions have a read-only filesystem except for /tmp
if os.environ.get("VERCEL") == "1" and db_url.startswith("sqlite"):
    db_url = "sqlite:////tmp/msme_local.db"

connect_args = {"check_same_thread": False} if db_url.startswith("sqlite") else {}
engine = create_engine(
    db_url, connect_args=connect_args
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# Dependency for FastAPI
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
