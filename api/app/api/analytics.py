from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Any
import secrets

from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.models import User, TradingAccount, ShareLink, Deal, PositionOpen
from app.schemas.schemas import (
    DashboardStats,
    EquityCurvePoint,
    CalendarPnlDay,
    DealResponse,
    ShareLinkCreate,
    ShareLinkResponse,
    PositionResponse
)
from app.services.analytics import AnalyticsService

router = APIRouter()

# Helper to verify account ownership
def get_owned_account(account_id: int, user: User, db: Session) -> TradingAccount:
    account = db.query(TradingAccount).filter(
        TradingAccount.id == account_id,
        TradingAccount.user_id == user.id
    ).first()
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Trading account not found"
        )
    return account


@router.get("/{account_id}/dashboard", response_model=DashboardStats)
def get_dashboard(
    account_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """Get summarized dashboard statistics for a trading account."""
    account = get_owned_account(account_id, current_user, db)
    return AnalyticsService.calculate_dashboard_stats(db, account)


@router.get("/{account_id}/equity-curve", response_model=List[EquityCurvePoint])
def get_equity_curve(
    account_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """Get the equity/balance growth curve history."""
    account = get_owned_account(account_id, current_user, db)
    return AnalyticsService.get_equity_curve(db, account.id)


@router.get("/{account_id}/calendar", response_model=List[CalendarPnlDay])
def get_calendar(
    account_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """Get daily trading profit calendar."""
    account = get_owned_account(account_id, current_user, db)
    return AnalyticsService.get_calendar_pnl(db, account.id)


@router.get("/{account_id}/trades", response_model=List[DealResponse])
def get_trades(
    account_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """Get closed trades list (deals)."""
    account = get_owned_account(account_id, current_user, db)
    trades = db.query(Deal).filter(
        Deal.account_id == account.id,
        Deal.type.in_(["buy", "sell"]),
        Deal.entry_type == "out"
    ).order_by(Deal.execution_time.desc()).all()
    return trades


@router.get("/{account_id}/positions", response_model=List[PositionResponse])
def get_positions(
    account_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """Get current open positions for a trading account."""
    account = get_owned_account(account_id, current_user, db)
    positions = db.query(PositionOpen).filter(
        PositionOpen.account_id == account.id
    ).order_by(PositionOpen.opened_time.desc()).all()
    return positions


@router.get("/all/ai-summary")
def get_all_accounts_ai_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """Get AI analysis of all combined trading portfolios."""
    summary_text = AnalyticsService.generate_combined_ai_summary(db, current_user.id)
    return {"summary": summary_text}


@router.get("/{account_id}/ai-summary")
def get_ai_summary(
    account_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """Get AI analysis of trading behavior."""
    account = get_owned_account(account_id, current_user, db)
    summary_text = AnalyticsService.generate_ai_summary(db, account.id)
    return {"summary": summary_text}


# ==================== Share Link Management ====================

@router.post("/{account_id}/share", response_model=ShareLinkResponse)
def create_share_link(
    account_id: int,
    share_in: ShareLinkCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """Create or update a public sharing link for an account."""
    account = get_owned_account(account_id, current_user, db)
    
    # Check if a link already exists
    existing = db.query(ShareLink).filter(ShareLink.account_id == account.id).first()
    if existing:
        existing.is_active = True
        existing.show_balance = share_in.show_balance
        existing.show_magic = share_in.show_magic
        existing.show_comment = share_in.show_comment
        db.commit()
        db.refresh(existing)
        return existing
        
    slug = share_in.slug or f"share-{secrets.token_hex(6)}"
    
    # Check if slug is unique
    existing_slug = db.query(ShareLink).filter(ShareLink.slug == slug).first()
    if existing_slug:
        slug = f"share-{secrets.token_hex(8)}"
        
    db_share = ShareLink(
        account_id=account.id,
        slug=slug,
        show_balance=share_in.show_balance,
        show_magic=share_in.show_magic,
        show_comment=share_in.show_comment
    )
    db.add(db_share)
    db.commit()
    db.refresh(db_share)
    return db_share


@router.delete("/{account_id}/share", status_code=status.HTTP_204_NO_CONTENT)
def revoke_share_link(
    account_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> None:
    """Disable public sharing link."""
    account = get_owned_account(account_id, current_user, db)
    share = db.query(ShareLink).filter(ShareLink.account_id == account.id).first()
    if share:
        share.is_active = False
        db.commit()
    return None
