from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from datetime import timedelta, datetime, date
from typing import Any
import requests
import secrets

from app.core.database import get_db
from app.core.config import settings
from app.core.security import get_password_hash, verify_password, create_access_token, create_refresh_token, verify_token
from app.models.models import User, UserBackupLog, TradingAccount, Deal, PositionOpen, AccountSyncState, ShareLink, ConnectionEvent
from app.schemas.schemas import UserCreate, UserResponse, Token, AISettingsUpdate
from app.api.deps import get_current_user

router = APIRouter()

@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register_user(user_in: UserCreate, db: Session = Depends(get_db)) -> Any:
    """Register a new user."""
    # Check if email already exists
    db_user = db.query(User).filter(User.email == user_in.email).first()
    if db_user:
        raise HTTPException(
            status_code=400,
            detail="A user with this email address already exists in the system.",
        )
    
    hashed_password = get_password_hash(user_in.password)
    user = User(
        email=user_in.email,
        hashed_password=hashed_password,
        full_name=user_in.full_name,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)) -> Any:
    """OAuth2 compatible token login, retrieve an access token for future requests."""
    user = db.query(User).filter(User.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect email or password"
        )
    elif not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user"
        )
    
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    refresh_token_expires = timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    
    return {
        "access_token": create_access_token(user.id, expires_delta=access_token_expires),
        "refresh_token": create_refresh_token(user.id, expires_delta=refresh_token_expires),
        "token_type": "bearer",
    }


@router.post("/refresh", response_model=Token)
def refresh_token(refresh_token: str, db: Session = Depends(get_db)) -> Any:
    """Refresh access token using refresh token."""
    user_id_str = verify_token(refresh_token, expected_type="refresh")
    if user_id_str is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )
        
    user_id = int(user_id_str)
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user",
        )
        
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    new_refresh_token_expires = timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    
    return {
        "access_token": create_access_token(user.id, expires_delta=access_token_expires),
        "refresh_token": create_refresh_token(user.id, expires_delta=new_refresh_token_expires),
        "token_type": "bearer",
    }


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)) -> Any:
    """Get current user profile settings."""
    return current_user


@router.put("/ai-settings", response_model=UserResponse)
def update_ai_settings(
    settings_in: AISettingsUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """Update current user's AI summary settings."""
    current_user.ai_provider = settings_in.ai_provider
    current_user.ai_api_key = settings_in.ai_api_key
    current_user.ai_model = settings_in.ai_model
    current_user.ai_base_url = settings_in.ai_base_url
    db.commit()
    db.refresh(current_user)
    return current_user


@router.get("/config")
def get_auth_config() -> Any:
    """Get public auth configuration settings."""
    return {
        "google_client_id": settings.GOOGLE_CLIENT_ID
    }


@router.post("/google-login", response_model=Token)
def google_login(payload: dict, db: Session = Depends(get_db)) -> Any:
    """Authenticate user using a Google ID token."""
    id_token = payload.get("credential")
    if not id_token:
        raise HTTPException(status_code=400, detail="Missing Google credential token")
        
    # Verify token via Google API
    try:
        response = requests.get(
            "https://oauth2.googleapis.com/tokeninfo",
            params={"id_token": id_token},
            timeout=5
        )
        if not response.ok:
            raise HTTPException(status_code=400, detail="Invalid Google token")
        token_info = response.json()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to contact Google verification service: {str(e)}")
        
    # Extract claims
    email = token_info.get("email")
    name = token_info.get("name", "Google User")
    if not email:
        raise HTTPException(status_code=400, detail="Email not provided by Google account")
        
    # Find or create user
    user = db.query(User).filter(User.email == email).first()
    if not user:
        # Generate a random password for user creation (they won't use it anyway)
        random_pass = secrets.token_hex(16)
        hashed_password = get_password_hash(random_pass)
        # For Google Users, username is email prefix
        username_val = email.split("@")[0]
        # Check if username exists, if so append random characters
        exist_user = db.query(User).filter(User.email == email).first()
        user = User(
            email=email,
            hashed_password=hashed_password,
            full_name=name,
            is_active=True
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
        
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    refresh_token_expires = timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    
    return {
        "access_token": create_access_token(user.id, expires_delta=access_token_expires),
        "refresh_token": create_refresh_token(user.id, expires_delta=refresh_token_expires),
        "token_type": "bearer",
    }


@router.get("/backup")
def download_backup(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """Export all user configuration and trading data as a single JSON download."""
    def to_dict(model_instance):
        if model_instance is None:
            return None
        d = {}
        for column in model_instance.__table__.columns:
            val = getattr(model_instance, column.name)
            if isinstance(val, (datetime, date)):
                d[column.name] = val.isoformat()
            else:
                d[column.name] = val
        return d

    def serialize_list(query_result):
        return [to_dict(item) for item in query_result]

    # Query all user's data
    user_accounts = db.query(TradingAccount).filter(TradingAccount.user_id == current_user.id).all()
    account_ids = [acc.id for acc in user_accounts]

    deals = db.query(Deal).filter(Deal.account_id.in_(account_ids)).all() if account_ids else []
    positions = db.query(PositionOpen).filter(PositionOpen.account_id.in_(account_ids)).all() if account_ids else []
    sync_states = db.query(AccountSyncState).filter(AccountSyncState.account_id.in_(account_ids)).all() if account_ids else []
    share_links = db.query(ShareLink).filter(ShareLink.account_id.in_(account_ids)).all() if account_ids else []
    conn_events = db.query(ConnectionEvent).filter(ConnectionEvent.account_id.in_(account_ids)).all() if account_ids else []

    backup_payload = {
        "backup_version": "1.0",
        "exported_at": datetime.utcnow().isoformat(),
        "user": {
            "email": current_user.email,
            "full_name": current_user.full_name,
            "ai_provider": current_user.ai_provider,
            "ai_api_key": current_user.ai_api_key,
            "ai_model": current_user.ai_model,
            "ai_base_url": current_user.ai_base_url,
        },
        "trading_accounts": serialize_list(user_accounts),
        "deals": serialize_list(deals),
        "positions_open": serialize_list(positions),
        "sync_states": serialize_list(sync_states),
        "share_links": serialize_list(share_links),
        "connection_events": serialize_list(conn_events)
    }

    # Log the backup event in database
    log_entry = UserBackupLog(user_id=current_user.id, backup_at=datetime.utcnow())
    db.add(log_entry)
    db.commit()

    # Return as JSON response with headers to trigger browser download
    headers = {
        "Content-Disposition": f"attachment; filename=thankhun_jornal_backup_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.json"
    }
    return JSONResponse(content=backup_payload, headers=headers)


@router.get("/backup/status")
def get_backup_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """Retrieve the timestamp of the last database backup for the user."""
    last_log = db.query(UserBackupLog).filter(UserBackupLog.user_id == current_user.id).order_by(UserBackupLog.backup_at.desc()).first()
    if last_log:
        return {"last_backup_at": last_log.backup_at.isoformat()}
    return {"last_backup_at": None}
