"""
networth.py  —  Net Worth Snapshot API
GET  /v1/networth/snapshots?year=2025&month=7   → daily snapshots for month
POST /v1/networth/snapshot                       → manual trigger (current user)
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_, extract
from datetime import date, datetime
import calendar

from app.core.database import get_db
from app.api.auth import get_current_user
from app.models.models import User, NetWorthSnapshot
from app.services.snapshot_service import take_snapshot_for_user

router = APIRouter()


@router.get("/snapshots")
def get_networth_snapshots(
    year: int = Query(default=None),
    month: int = Query(default=None, ge=1, le=12),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Return daily net worth snapshots for the given month.
    Defaults to current month (Bangkok time).
    Fills missing days with None so the frontend can show gaps.
    """
    import pytz
    bkk = pytz.timezone("Asia/Bangkok")
    now_bkk = datetime.now(bkk)

    year = year or now_bkk.year
    month = month or now_bkk.month

    rows = db.query(NetWorthSnapshot).filter(
        and_(
            NetWorthSnapshot.user_id == current_user.id,
            extract("year", NetWorthSnapshot.date) == year,
            extract("month", NetWorthSnapshot.date) == month,
        )
    ).order_by(NetWorthSnapshot.date).all()

    # Build a date→row map
    row_map = {r.date: r for r in rows}

    # Fill every day of the month (null if no data)
    days_in_month = calendar.monthrange(year, month)[1]
    result = []
    for day in range(1, days_in_month + 1):
        d = date(year, month, day)
        r = row_map.get(d)
        result.append({
            "date": str(d),
            "day": day,
            "forex_usd": r.forex_usd if r else None,
            "stock_usd": r.stock_usd if r else None,
            "crypto_usd": r.crypto_usd if r else None,
            "total_usd": (r.forex_usd + r.stock_usd + r.crypto_usd) if r else None,
            "usd_thb_rate": r.usd_thb_rate if r else None,
        })

    return {
        "year": year,
        "month": month,
        "days": result,
        "has_data": len(rows) > 0,
    }


@router.post("/snapshot")
def trigger_snapshot(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Manually trigger a snapshot for the current user (today's date)."""
    result = take_snapshot_for_user(db, current_user.id)
    return {"status": "ok", "snapshot": result}


@router.get("/daily-portfolios")
def get_daily_portfolios(
    year: int = Query(default=None),
    month: int = Query(default=None, ge=1, le=12),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Return daily equity snapshots for each individual account of the user.
    Grouped by day of the month, formatted for Recharts.
    """
    import pytz
    from app.models.models import DailyEquitySnapshot, TradingAccount, StockCashBalance, StockHolding, CryptoHolding
    from app.api.utils import get_usd_thb_rate
    from app.services.snapshot_service import _is_cent
    
    bkk = pytz.timezone("Asia/Bangkok")
    now_bkk = datetime.now(bkk)

    year = year or now_bkk.year
    month = month or now_bkk.month

    # 1. Fetch all accounts of this user
    accounts = db.query(TradingAccount).filter(TradingAccount.user_id == current_user.id).all()
    account_ids = [a.id for a in accounts]

    if not account_ids:
        return {"year": year, "month": month, "days": [], "accounts": []}

    # 2. Fetch all existing daily equity snapshots for these accounts in the selected month
    snapshots = db.query(DailyEquitySnapshot).filter(
        and_(
            DailyEquitySnapshot.account_id.in_(account_ids),
            extract("year", DailyEquitySnapshot.date) == year,
            extract("month", DailyEquitySnapshot.date) == month,
        )
    ).order_by(DailyEquitySnapshot.date).all()

    # Build map of (date, account_id) -> equity (converting cent accounts to USD)
    snap_map = {}
    account_dict = {a.id: a for a in accounts}
    for s in snapshots:
        acc = account_dict.get(s.account_id)
        val = s.equity
        if acc and _is_cent(acc.currency or ""):
            val = val / 100.0
        snap_map[(s.date, s.account_id)] = val

    # 3. For any stock/crypto account that does not have historical snapshots, 
    # we backfill past days with their current equity so the chart isn't empty!
    rate = get_usd_thb_rate()
    for acc in accounts:
        # Calculate current equity in USD
        if acc.account_type == "stock":
            cash_row = db.query(StockCashBalance).filter(StockCashBalance.account_id == acc.id).first()
            cash = cash_row.cash_balance if cash_row else 0.0
            holdings = db.query(StockHolding).filter(StockHolding.account_id == acc.id).all()
            market_value = sum(h.volume * h.current_price for h in holdings)
            curr_eq = cash + market_value
            if acc.currency != "USD":
                curr_eq = curr_eq / rate
        elif acc.account_type == "crypto":
            holdings = db.query(CryptoHolding).filter(CryptoHolding.account_id == acc.id).all()
            curr_eq = sum(h.value_usd for h in holdings)
        else: # Forex
            curr_eq = acc.equity / 100 if _is_cent(acc.currency) else acc.equity

        # Fill map for every day of the month if missing
        days_in_month = calendar.monthrange(year, month)[1]
        for day in range(1, days_in_month + 1):
            d = date(year, month, day)
            # If day is in the past/present relative to today
            if d <= now_bkk.date():
                if (d, acc.id) not in snap_map:
                    try:
                        new_snap = DailyEquitySnapshot(
                            account_id=acc.id,
                            date=d,
                            balance=curr_eq,
                            equity=curr_eq
                        )
                        db.add(new_snap)
                        db.commit()
                        snap_map[(d, acc.id)] = curr_eq
                    except Exception:
                        db.rollback()
                        snap_map[(d, acc.id)] = curr_eq # Fallback to in-memory

    # 4. Format days for Recharts
    days_in_month = calendar.monthrange(year, month)[1]
    result_days = []
    
    for day in range(1, days_in_month + 1):
        d = date(year, month, day)
        day_dict = {
            "date": str(d),
            "day": day
        }
        has_any_data = False
        for acc_id in account_ids:
            eq_val = snap_map.get((d, acc_id))
            if eq_val is not None:
                day_dict[f"acc_{acc_id}"] = round(eq_val, 2)
                has_any_data = True
            else:
                day_dict[f"acc_{acc_id}"] = None
                
        if d <= now_bkk.date():
            result_days.append(day_dict)

    # Return account metadata
    account_metadata = [{
        "id": acc.id,
        "key": f"acc_{acc.id}",
        "account_name": acc.account_name,
        "account_type": acc.account_type or "forex",
        "currency": acc.currency or "USD",
        "broker_name": acc.broker_name
    } for acc in accounts]

    return {
        "year": year,
        "month": month,
        "days": result_days,
        "accounts": account_metadata
    }
