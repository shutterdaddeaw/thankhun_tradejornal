from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
import secrets
from typing import List, Any

from app.core.database import get_db
from app.api.deps import get_current_user
from app.core.security import encrypt_password
from app.models.models import User, TradingAccount, AccountCredentials, AccountSyncState
from app.schemas.schemas import TradingAccountCreate, TradingAccountResponse, TradingAccountUpdate

router = APIRouter()

@router.post("/", response_model=TradingAccountResponse, status_code=status.HTTP_201_CREATED)
def create_account(
    account_in: TradingAccountCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """Create a new MT5 trading account tracking profile."""
    # Check if this account number already exists for this user
    existing = db.query(TradingAccount).filter(
        TradingAccount.user_id == current_user.id,
        TradingAccount.account_number == account_in.account_number
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Trading account {account_in.account_number} is already added to this profile."
        )

    # Create account profile
    db_account = TradingAccount(
        user_id=current_user.id,
        account_number=account_in.account_number,
        broker_name=account_in.broker_name,
        server_name=account_in.server_name or "",
        account_name=account_in.account_name,
        currency=account_in.currency,
        account_type=account_in.account_type or "forex",
        leverage=account_in.leverage,
        connection_type=account_in.connection_type,
        status="active_account_sync" if (account_in.account_type in ("stock", "crypto")) else "pending_verify"
    )
    db.add(db_account)
    db.commit()
    db.refresh(db_account)

    # Generate unique Publisher Token for EA connection
    pub_token = f"JT-{secrets.token_hex(16).upper()}"
    
    # Encrypt investor password if provided
    encrypted_pw = None
    if account_in.investor_password:
        encrypted_pw = encrypt_password(account_in.investor_password)

    # Create credentials entry
    db_creds = AccountCredentials(
        account_id=db_account.id,
        investor_password_encrypted=encrypted_pw,
        publisher_token=pub_token
    )
    db.add(db_creds)

    # Initialize sync state
    db_sync_state = AccountSyncState(
        account_id=db_account.id,
        last_deal_ticket=None
    )
    db.add(db_sync_state)
    
    db.commit()
    db.refresh(db_account)
    
    # Embed the publisher token into response so user can configure the EA
    response = TradingAccountResponse.model_validate(db_account)
    response.publisher_token = pub_token
    return response


@router.get("/", response_model=List[TradingAccountResponse])
def get_accounts(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """Retrieve all linked trading accounts for the current user."""
    accounts = db.query(TradingAccount).filter(TradingAccount.user_id == current_user.id).all()
    
    response_list = []
    for acc in accounts:
        resp = TradingAccountResponse.model_validate(acc)
        # Include token from credentials if it exists
        if acc.credentials:
            resp.publisher_token = acc.credentials.publisher_token
        response_list.append(resp)
        
    return response_list


@router.get("/{account_id}", response_model=TradingAccountResponse)
def get_account(
    account_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """Get details of a specific trading account."""
    account = db.query(TradingAccount).filter(
        TradingAccount.id == account_id,
        TradingAccount.user_id == current_user.id
    ).first()
    
    if not account:
        raise HTTPException(status_code=404, detail="Trading account not found")
        
    resp = TradingAccountResponse.model_validate(account)
    if account.credentials:
        resp.publisher_token = account.credentials.publisher_token
    return resp


@router.patch("/{account_id}", response_model=TradingAccountResponse)
def update_account(
    account_id: int,
    account_in: TradingAccountUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """Update trading account configuration."""
    account = db.query(TradingAccount).filter(
        TradingAccount.id == account_id,
        TradingAccount.user_id == current_user.id
    ).first()
    
    if not account:
        raise HTTPException(status_code=404, detail="Trading account not found")
        
    update_data = account_in.model_dump(exclude_unset=True)
    
    if "investor_password" in update_data:
        pw = update_data.pop("investor_password")
        if pw:
            account.credentials.investor_password_encrypted = encrypt_password(pw)
            
    for field, val in update_data.items():
        setattr(account, field, val)
        
    db.commit()
    db.refresh(account)
    
    resp = TradingAccountResponse.model_validate(account)
    if account.credentials:
        resp.publisher_token = account.credentials.publisher_token
    return resp


@router.delete("/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_account(
    account_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> None:
    """Delete a trading account and all associated data."""
    account = db.query(TradingAccount).filter(
        TradingAccount.id == account_id,
        TradingAccount.user_id == current_user.id
    ).first()
    
    if not account:
        raise HTTPException(status_code=404, detail="Trading account not found")
        
    db.delete(account)
    db.commit()
    return None
