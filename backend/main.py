from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database.session import engine, Base
from database.migrations import ensure_sqlite_legacy_columns
from core.config import settings

from api.auth import router as auth_router
from api.payments import router as payments_router
from api.checkout import router as checkout_router
from api.admin import router as admin_router
from api.bonds import router as bonds_router
from api.compliance import router as compliance_router
from api.analytics import router as analytics_router
from api.intelligence import router as intelligence_router
from api.gateway import router as gateway_router

# Import all models to ensure SQLAlchemy binds their schema definitions natively
from models import *

# Initialize database tables locally (sqlite)
Base.metadata.create_all(bind=engine)
ensure_sqlite_legacy_columns(engine)

app = FastAPI(title=settings.PROJECT_NAME)

# CORS config
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # For dev only, restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routing
app.include_router(auth_router, prefix=f"{settings.API_V1_STR}/auth", tags=["Authentication"])
app.include_router(payments_router, prefix=f"{settings.API_V1_STR}/payments", tags=["Payments & Ledger"])
app.include_router(checkout_router, prefix=f"{settings.API_V1_STR}/checkout", tags=["Tokenized Checkout"])
app.include_router(admin_router, prefix=f"{settings.API_V1_STR}/admin", tags=["SettleX Core Admin"])
app.include_router(bonds_router, prefix=f"{settings.API_V1_STR}/bonds", tags=["Treasury Bonds Framework"])
app.include_router(compliance_router, prefix=f"{settings.API_V1_STR}/compliance", tags=["GST Compliance"])
app.include_router(analytics_router, prefix=f"{settings.API_V1_STR}/analytics", tags=["Merchant Analytics"])
app.include_router(intelligence_router, prefix=f"{settings.API_V1_STR}/intelligence", tags=["Consumer Intelligence"])
app.include_router(gateway_router, prefix=f"{settings.API_V1_STR}/gateway", tags=["Payment Gateway & Reconciliation"])

@app.get("/")
def read_root():
    return {"message": "MSME Intelligence Platform API is running."}

@app.get("/api/v1/health")
def health_check():
    return {
        "status": "ok",
        "services": {
            "database": "ok",
        },
        "version": "1.0.0"
    }
