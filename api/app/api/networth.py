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
