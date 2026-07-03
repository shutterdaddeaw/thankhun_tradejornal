from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Any

from app.core.database import get_db
from app.models.models import ShareLink, Deal, TradingAccount, PositionOpen
from app.schemas.schemas import DashboardStats, EquityCurvePoint, DealResponse, PositionResponse
from app.services.analytics import AnalyticsService

router = APIRouter()

def get_active_share_link(slug: str, db: Session) -> ShareLink:
    share = db.query(ShareLink).filter(
        ShareLink.slug == slug,
        ShareLink.is_active == True
    ).first()
    
    if not share or not share.account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Public portfolio page not found or is no longer shared"
        )
    return share


@router.get("/{slug}", response_model=DashboardStats)
def get_public_dashboard(slug: str, db: Session = Depends(get_db)) -> Any:
    """Retrieve public portfolio statistics."""
    share = get_active_share_link(slug, db)
    stats = AnalyticsService.calculate_dashboard_stats(db, share.account)
    
    # Hide details if share settings restrict them
    if not share.show_balance:
        # Obfuscate balance/equity by scaling or setting to zero/hiding
        # The simplest standard way is setting to 0.0 or keeping percentage only
        stats.balance = 0.0
        stats.equity = 0.0
        stats.floating_profit = 0.0
        
    return stats


@router.get("/{slug}/equity-curve", response_model=List[EquityCurvePoint])
def get_public_equity_curve(slug: str, db: Session = Depends(get_db)) -> Any:
    """Retrieve public portfolio equity curve."""
    share = get_active_share_link(slug, db)
    curve = AnalyticsService.get_equity_curve(db, share.account_id)
    
    # Obfuscate actual dollar values if show_balance is False, showing normalized equity curve (growth %)
    if not share.show_balance and curve:
        # Normalize curve to start at 100 or show 0
        first_bal = curve[0].balance if curve[0].balance > 0 else 1.0
        for pt in curve:
            pt.balance = ((pt.balance - first_bal) / first_bal) * 100.0  # Convert to percent growth
            pt.equity = ((pt.equity - first_bal) / first_bal) * 100.0
            pt.floating_profit = 0.0
            
    return curve


@router.get("/{slug}/trades", response_model=List[DealResponse])
def get_public_trades(slug: str, db: Session = Depends(get_db)) -> Any:
    """Retrieve public portfolio closed trades."""
    share = get_active_share_link(slug, db)
    trades = db.query(Deal).filter(
        Deal.account_id == share.account_id,
        Deal.type.in_(["buy", "sell"]),
        Deal.entry_type == "out"
    ).order_by(Deal.execution_time.desc()).all()
    
    # Filter comments / magic numbers based on settings
    processed_trades = []
    for t in trades:
        t_data = DealResponse.model_validate(t)
        if not share.show_magic:
            t_data.magic = None
        if not share.show_comment:
            t_data.comment = None
        processed_trades.append(t_data)
        
    return processed_trades


@router.get("/{slug}/positions", response_model=List[PositionResponse])
def get_public_positions(slug: str, db: Session = Depends(get_db)) -> Any:
    """Retrieve public portfolio open positions."""
    share = get_active_share_link(slug, db)
    positions = db.query(PositionOpen).filter(
        PositionOpen.account_id == share.account_id
    ).order_by(PositionOpen.opened_time.desc()).all()
    
    processed_positions = []
    for p in positions:
        p_data = PositionResponse.model_validate(p)
        if not share.show_magic:
            p_data.magic = None
        if not share.show_comment:
            p_data.comment = None
        if not share.show_balance:
            p_data.volume = 0.0
            p_data.profit = 0.0
            p_data.swap = 0.0
            p_data.commission = 0.0
        processed_positions.append(p_data)
        
    return processed_positions
