from fastapi import APIRouter, Depends, HTTPException, Header, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

from app.core.database import get_db
from app.models.models import (
    TradingAccount,
    AccountCredentials,
    AccountSyncState,
    Deal,
    PositionOpen,
    BalanceOperation,
    DailyEquitySnapshot,
    ConnectionEvent
)

router = APIRouter()

# ==================== Ingest Request Schemas ====================
class EADealSchema(BaseModel):
    ticket: str
    order_ticket: Optional[str] = None
    position_ticket: Optional[str] = None
    symbol: Optional[str] = None
    volume: float
    type: str  # buy, sell, balance, credit, etc.
    entry_type: Optional[str] = None  # in, out, inout
    price: float
    commission: float = 0.0
    swap: float = 0.0
    profit: float = 0.0
    magic: Optional[int] = None
    comment: Optional[str] = None
    execution_time: datetime  # ISO 8601 string or epoch


class EAPositionSchema(BaseModel):
    ticket: str
    symbol: str
    volume: float
    type: str  # buy, sell
    price_open: float
    price_current: float
    sl: float = 0.0
    tp: float = 0.0
    commission: float = 0.0
    swap: float = 0.0
    profit: float = 0.0
    magic: Optional[int] = None
    comment: Optional[str] = None
    opened_time: datetime


class EABootstrapPayload(BaseModel):
    account_number: str
    broker_name: str
    server_name: str
    account_name: str
    currency: str = "USD"
    leverage: int = 100
    balance: float
    equity: float
    deals: List[EADealSchema]


class EASnapshotPayload(BaseModel):
    balance: float
    equity: float
    profit: float
    positions: List[EAPositionSchema]


class EADealsPayload(BaseModel):
    deals: List[EADealSchema]


# ==================== Dependency: Authenticate Publisher Token ====================
def verify_publisher_token(
    x_publisher_token: str = Header(..., alias="X-Publisher-Token"),
    db: Session = Depends(get_db)
) -> TradingAccount:
    """Verifies that the request has a valid publisher token and returns the TradingAccount."""
    creds = db.query(AccountCredentials).filter(
        AccountCredentials.publisher_token == x_publisher_token
    ).first()
    
    if not creds:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid publisher token"
        )
        
    return creds.account


# ==================== Helper: Record Daily Snapshot ====================
def record_daily_snapshot(db: Session, account_id: int, balance: float, equity: float, profit: float):
    """Saves or updates the equity snapshot for the current day."""
    today = datetime.utcnow().date()
    snapshot = db.query(DailyEquitySnapshot).filter(
        DailyEquitySnapshot.account_id == account_id,
        DailyEquitySnapshot.date == today
    ).first()
    
    if snapshot:
        snapshot.balance = balance
        snapshot.equity = equity
        snapshot.floating_profit = profit
    else:
        snapshot = DailyEquitySnapshot(
            account_id=account_id,
            date=today,
            balance=balance,
            equity=equity,
            floating_profit=profit
        )
        db.add(snapshot)
    db.commit()


# ==================== Ingest Endpoints ====================

@router.post("/bootstrap", status_code=status.HTTP_200_OK)
def bootstrap_account(
    payload: EABootstrapPayload,
    account: TradingAccount = Depends(verify_publisher_token),
    db: Session = Depends(get_db)
):
    """
    Initial setup/sync for the account. Overwrites existing history for this account.
    """
    # 1. Update account master details
    account.balance = payload.balance
    account.equity = payload.equity
    # Only update currency if the current database currency is not already a cent currency
    curr_upper = (account.currency or "").upper()
    is_current_cent = curr_upper in ["USC", "USDC", "EURC", "GBPC", "USCENT", "EURCENT", "CENT"] or curr_upper.endswith("CENT")
    if not is_current_cent:
        account.currency = payload.currency
    account.leverage = payload.leverage
    account.status = "active_publisher_ea"
    account.connection_type = "publisher_ea"
    
    # 2. Clear old deals, open positions, and balance operations to start fresh
    db.query(Deal).filter(Deal.account_id == account.id).delete()
    db.query(PositionOpen).filter(PositionOpen.account_id == account.id).delete()
    db.query(BalanceOperation).filter(BalanceOperation.account_id == account.id).delete()
    
    # 3. Add all historical deals
    last_ticket = None
    last_exec_time = None
    
    for deal_in in payload.deals:
        # Create Deal entry
        db_deal = Deal(
            account_id=account.id,
            ticket=deal_in.ticket,
            order_ticket=deal_in.order_ticket,
            position_ticket=deal_in.position_ticket,
            symbol=deal_in.symbol,
            volume=deal_in.volume,
            type=deal_in.type,
            entry_type=deal_in.entry_type,
            price=deal_in.price,
            commission=deal_in.commission,
            swap=deal_in.swap,
            profit=deal_in.profit,
            magic=deal_in.magic,
            comment=deal_in.comment,
            execution_time=deal_in.execution_time
        )
        db.add(db_deal)
        
        # If it's a balance operation (deposit/withdrawal), add to balance operations table
        if deal_in.type in ["balance", "credit"] or (deal_in.symbol is None and deal_in.profit != 0):
            op_type = "deposit" if deal_in.profit >= 0 else "withdrawal"
            db_op = BalanceOperation(
                account_id=account.id,
                ticket=deal_in.ticket,
                type=op_type,
                amount=deal_in.profit,
                comment=deal_in.comment,
                timestamp=deal_in.execution_time
            )
            db.add(db_op)

        # Track the last ticket for cursor
        if last_exec_time is None or deal_in.execution_time > last_exec_time:
            last_exec_time = deal_in.execution_time
            last_ticket = deal_in.ticket
            
    # 4. Update sync state cursor
    sync_state = db.query(AccountSyncState).filter(AccountSyncState.account_id == account.id).first()
    if not sync_state:
        sync_state = AccountSyncState(account_id=account.id)
        db.add(sync_state)
        
    sync_state.last_deal_ticket = last_ticket
    sync_state.last_successful_sync_time = datetime.utcnow()
    sync_state.last_sync_time = datetime.utcnow()
    sync_state.last_error_message = None
    
    # 5. Log Connection Event
    event = ConnectionEvent(
        account_id=account.id,
        event_type="info",
        message=f"Account bootstrapped successfully with {len(payload.deals)} deals."
    )
    db.add(event)
    
    db.commit()
    
    # 6. Record Daily Snapshot
    record_daily_snapshot(db, account.id, payload.balance, payload.equity, 0.0)
    
    return {"status": "success", "message": "Bootstrap completed successfully", "last_deal_ticket": last_ticket}


@router.post("/snapshot", status_code=status.HTTP_200_OK)
def ingest_snapshot(
    payload: EASnapshotPayload,
    account: TradingAccount = Depends(verify_publisher_token),
    db: Session = Depends(get_db)
):
    """
    Updates the current balance, equity, and open positions snapshot.
    """
    # 1. Update account details
    account.balance = payload.balance
    account.equity = payload.equity
    account.profit = payload.profit
    account.status = "active_publisher_ea"
    account.connection_type = "publisher_ea"
    
    # 2. Clear old open positions
    db.query(PositionOpen).filter(PositionOpen.account_id == account.id).delete()
    
    # 3. Add current open positions
    for pos_in in payload.positions:
        db_pos = PositionOpen(
            account_id=account.id,
            ticket=pos_in.ticket,
            symbol=pos_in.symbol,
            volume=pos_in.volume,
            type=pos_in.type,
            price_open=pos_in.price_open,
            price_current=pos_in.price_current,
            sl=pos_in.sl,
            tp=pos_in.tp,
            commission=pos_in.commission,
            swap=pos_in.swap,
            profit=pos_in.profit,
            magic=pos_in.magic,
            comment=pos_in.comment,
            opened_time=pos_in.opened_time
        )
        db.add(db_pos)
        
    # 4. Update sync state
    sync_state = db.query(AccountSyncState).filter(AccountSyncState.account_id == account.id).first()
    if sync_state:
        sync_state.last_successful_sync_time = datetime.utcnow()
        sync_state.last_sync_time = datetime.utcnow()
        
    db.commit()
    
    # 5. Record daily snapshot
    record_daily_snapshot(db, account.id, payload.balance, payload.equity, payload.profit)
    
    return {"status": "success", "message": f"Snapshot updated with {len(payload.positions)} open positions"}


@router.post("/deals", status_code=status.HTTP_200_OK)
def ingest_deals(
    payload: EADealsPayload,
    account: TradingAccount = Depends(verify_publisher_token),
    db: Session = Depends(get_db)
):
    """
    Adds new deals incrementally.
    """
    account.status = "active_publisher_ea"
    account.connection_type = "publisher_ea"
    
    if not payload.deals:
        return {"status": "success", "message": "No new deals provided"}
        
    last_ticket = None
    last_exec_time = None
    added_count = 0
    
    for deal_in in payload.deals:
        # Check if deal already exists to prevent duplicate key errors
        existing = db.query(Deal).filter(
            Deal.account_id == account.id,
            Deal.ticket == deal_in.ticket
        ).first()
        
        if existing:
            continue
            
        db_deal = Deal(
            account_id=account.id,
            ticket=deal_in.ticket,
            order_ticket=deal_in.order_ticket,
            position_ticket=deal_in.position_ticket,
            symbol=deal_in.symbol,
            volume=deal_in.volume,
            type=deal_in.type,
            entry_type=deal_in.entry_type,
            price=deal_in.price,
            commission=deal_in.commission,
            swap=deal_in.swap,
            profit=deal_in.profit,
            magic=deal_in.magic,
            comment=deal_in.comment,
            execution_time=deal_in.execution_time
        )
        db.add(db_deal)
        added_count += 1
        
        # If it's a balance operation, record it
        if deal_in.type in ["balance", "credit"] or (deal_in.symbol is None and deal_in.profit != 0):
            op_type = "deposit" if deal_in.profit >= 0 else "withdrawal"
            db_op = BalanceOperation(
                account_id=account.id,
                ticket=deal_in.ticket,
                type=op_type,
                amount=deal_in.profit,
                comment=deal_in.comment,
                timestamp=deal_in.execution_time
            )
            db.add(db_op)

        if last_exec_time is None or deal_in.execution_time > last_exec_time:
            last_exec_time = deal_in.execution_time
            last_ticket = deal_in.ticket
            
    # Update cursor
    sync_state = db.query(AccountSyncState).filter(AccountSyncState.account_id == account.id).first()
    if sync_state:
        if last_ticket:
            sync_state.last_deal_ticket = last_ticket
        sync_state.last_successful_sync_time = datetime.utcnow()
        sync_state.last_sync_time = datetime.utcnow()
        
    db.commit()
    
    return {"status": "success", "message": f"Successfully processed {added_count} new deals", "last_deal_ticket": sync_state.last_deal_ticket if sync_state else None}


@router.post("/heartbeat", status_code=status.HTTP_200_OK)
def ingest_heartbeat(
    account: TradingAccount = Depends(verify_publisher_token),
    db: Session = Depends(get_db)
):
    """
    Heartbeat endpoint to verify connection status.
    """
    account.status = "active_publisher_ea"
    account.connection_type = "publisher_ea"
    
    sync_state = db.query(AccountSyncState).filter(AccountSyncState.account_id == account.id).first()
    if sync_state:
        sync_state.last_successful_sync_time = datetime.utcnow()
        sync_state.last_sync_time = datetime.utcnow()
        
    event = ConnectionEvent(
        account_id=account.id,
        event_type="publisher_heartbeat",
        message="Publisher EA heartbeat received."
    )
    db.add(event)
    db.commit()
    
    return {"status": "success", "message": "Heartbeat acknowledged"}
