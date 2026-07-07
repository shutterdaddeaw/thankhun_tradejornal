"""
snapshot_service.py
Calculates daily net worth snapshot per user and upserts into net_worth_snapshots table.
Runs automatically at midnight (Asia/Bangkok) via APScheduler.
"""
import logging
from datetime import date, datetime
import pytz

from sqlalchemy.orm import Session
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy import insert, select, and_

from app.core.database import SessionLocal
from app.models.models import (
    User, TradingAccount, StockCashBalance, StockHolding,
    CryptoHolding, NetWorthSnapshot, DailyEquitySnapshot
)
from app.api.utils import get_usd_thb_rate

logger = logging.getLogger(__name__)

BKK = pytz.timezone("Asia/Bangkok")

CENT_CURRENCIES = {"USC", "USC"}  # cent account currencies


def _is_cent(currency: str) -> bool:
    return currency.upper() in ("USC", "EURC")


def take_snapshot_for_user(db: Session, user_id: int, snap_date: date = None) -> dict:
    """
    Calculate and upsert a net worth snapshot for one user,
    including individual account-level DailyEquitySnapshots.
    snap_date defaults to today (Bangkok timezone).
    Returns the snapshot dict.
    """
    if snap_date is None:
        snap_date = datetime.now(BKK).date()

    rate = get_usd_thb_rate()

    accounts = db.query(TradingAccount).filter(
        TradingAccount.user_id == user_id
    ).all()

    # ── Forex USD ──────────────────────────────────────────────────────────
    forex_usd = 0.0
    for acc in accounts:
        if not acc.account_type or acc.account_type == "forex":
            bal = acc.balance / 100 if _is_cent(acc.currency) else acc.balance
            forex_usd += bal

    # ── Stock USD (THB → USD) ───────────────────────────────────────────────
    stock_usd = 0.0
    for acc in accounts:
        if acc.account_type == "stock":
            # cash
            cash_row = db.query(StockCashBalance).filter(
                StockCashBalance.account_id == acc.id
            ).first()
            cash = cash_row.cash_balance if cash_row else 0.0

            # holdings market value
            holdings = db.query(StockHolding).filter(
                StockHolding.account_id == acc.id
            ).all()
            market_value = sum(h.volume * h.current_price for h in holdings)
            val = cash + market_value
            if acc.currency != "USD":
                val = val / rate
            stock_usd += val

    # ── Crypto USD ─────────────────────────────────────────────────────────
    crypto_usd = 0.0
    for acc in accounts:
        if acc.account_type == "crypto":
            holdings = db.query(CryptoHolding).filter(
                CryptoHolding.account_id == acc.id
            ).all()
            crypto_usd += sum(h.value_usd for h in holdings)

    # ── Individual Account Snapshots ──
    for acc in accounts:
        if not acc.account_type or acc.account_type == "forex":
            acc_eq = acc.equity
            acc_bal = acc.balance
        elif acc.account_type == "stock":
            cash_row = db.query(StockCashBalance).filter(StockCashBalance.account_id == acc.id).first()
            cash = cash_row.cash_balance if cash_row else 0.0
            holdings = db.query(StockHolding).filter(StockHolding.account_id == acc.id).all()
            market_value = sum(h.volume * h.current_price for h in holdings)
            acc_eq = cash + market_value
            if acc.currency != "USD":
                acc_eq = acc_eq / rate
            acc_bal = acc_eq
        elif acc.account_type == "crypto":
            holdings = db.query(CryptoHolding).filter(CryptoHolding.account_id == acc.id).all()
            acc_eq = sum(h.value_usd for h in holdings)
            acc_bal = acc_eq
        else:
            continue

        existing_eq = db.query(DailyEquitySnapshot).filter(
            and_(
                DailyEquitySnapshot.account_id == acc.id,
                DailyEquitySnapshot.date == snap_date
            )
        ).first()
        if existing_eq:
            existing_eq.equity = acc_eq
            existing_eq.balance = acc_bal
        else:
            new_eq = DailyEquitySnapshot(
                account_id=acc.id,
                date=snap_date,
                balance=acc_bal,
                equity=acc_eq
            )
            db.add(new_eq)

    # ── Upsert NetWorthSnapshot ─────────────────────────────────────────────
    # Use merge pattern (works for both SQLite and PostgreSQL)
    existing = db.query(NetWorthSnapshot).filter(
        and_(
            NetWorthSnapshot.user_id == user_id,
            NetWorthSnapshot.date == snap_date
        )
    ).first()

    if existing:
        existing.forex_usd = forex_usd
        existing.stock_usd = stock_usd
        existing.crypto_usd = crypto_usd
        existing.usd_thb_rate = rate
    else:
        snap = NetWorthSnapshot(
            user_id=user_id,
            date=snap_date,
            forex_usd=forex_usd,
            stock_usd=stock_usd,
            crypto_usd=crypto_usd,
            usd_thb_rate=rate,
        )
        db.add(snap)

    db.commit()
    logger.info(f"Snapshot saved: user={user_id} date={snap_date} forex={forex_usd:.2f} stock={stock_usd:.2f} crypto={crypto_usd:.2f}")

    return {
        "user_id": user_id,
        "date": str(snap_date),
        "forex_usd": forex_usd,
        "stock_usd": stock_usd,
        "crypto_usd": crypto_usd,
        "usd_thb_rate": rate,
    }


def take_snapshot_all_users():
    """Triggered by APScheduler at midnight. Snapshots all active users."""
    db = SessionLocal()
    try:
        users = db.query(User).filter(User.is_active == True).all()
        logger.info(f"[Snapshot Cron] Taking snapshot for {len(users)} users")
        for user in users:
            try:
                take_snapshot_for_user(db, user.id)
            except Exception as e:
                logger.error(f"[Snapshot Cron] Error for user {user.id}: {e}")
    finally:
        db.close()
