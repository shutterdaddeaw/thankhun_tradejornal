from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.database import Base, engine
from app.models.models import *  # noqa: F401, F403

from fastapi.staticfiles import StaticFiles
import os

# Auto-create tables on startup (especially useful for SQLite local development)
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=settings.PROJECT_NAME,
    version="1.0.0",
    description="Backend API for THANKHUN Trade Jornal - Myfxbook-style portfolio tracker"
)

# Mount static directory
static_dir = os.path.join(os.path.dirname(__file__), "static")
if not os.path.exists(static_dir):
    os.makedirs(static_dir)
app.mount("/static", StaticFiles(directory=static_dir), name="static")

# Set CORS origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify exact dashboard domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Import Routers
from app.api import auth, accounts, analytics, ingest, public, stock, crypto, utils

# Include Routers
app.include_router(auth.router, prefix="/v1/auth", tags=["Authentication"])
app.include_router(accounts.router, prefix="/v1/accounts", tags=["Accounts"])
app.include_router(analytics.router, prefix="/v1/accounts", tags=["Analytics"])
app.include_router(ingest.router, prefix="/v1/ingest/mt5/publisher", tags=["EA Ingestion"])
app.include_router(public.router, prefix="/p", tags=["Public Sharing"])
app.include_router(stock.router, prefix="/v1/stock", tags=["Stock Portfolio"])
app.include_router(crypto.router, prefix="/v1/crypto", tags=["Crypto Assets"])
app.include_router(utils.router, prefix="/v1/utils", tags=["Utilities"])

@app.get("/")
def read_root():
    return {
        "status": "online",
        "project": settings.PROJECT_NAME,
        "environment": settings.ENVIRONMENT
    }
