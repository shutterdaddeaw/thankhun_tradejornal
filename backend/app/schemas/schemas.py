from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime, date

# ==================== User Schemas ====================
class UserBase(BaseModel):
    email: EmailStr
    full_name: Optional[str] = None

class UserCreate(UserBase):
    password: str = Field(..., min_length=6)

class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    password: Optional[str] = None

class UserResponse(UserBase):
    id: int
    is_active: bool
    ai_provider: Optional[str] = "mock"
    ai_api_key: Optional[str] = None
    ai_model: Optional[str] = None
    ai_base_url: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class AISettingsUpdate(BaseModel):
    ai_provider: str
    ai_api_key: Optional[str] = None
    ai_model: Optional[str] = None
    ai_base_url: Optional[str] = None


# ==================== Token Schemas ====================
class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"

class TokenPayload(BaseModel):
    sub: Optional[int] = None
    type: Optional[str] = None


# ==================== Trading Account Schemas ====================
class TradingAccountBase(BaseModel):
    account_number: str
    broker_name: str
    server_name: str
    account_name: str
    currency: Optional[str] = "USD"
    leverage: Optional[int] = 100
    connection_type: Optional[str] = "publisher_ea"  # account_sync or publisher_ea

class TradingAccountCreate(TradingAccountBase):
    investor_password: Optional[str] = None

class TradingAccountUpdate(BaseModel):
    account_name: Optional[str] = None
    broker_name: Optional[str] = None
    server_name: Optional[str] = None
    currency: Optional[str] = None
    leverage: Optional[int] = None
    status: Optional[str] = None
    connection_type: Optional[str] = None
    investor_password: Optional[str] = None

class TradingAccountResponse(TradingAccountBase):
    id: int
    user_id: int
    balance: float
    equity: float
    profit: float
    status: str
    publisher_token: Optional[str] = None  # Returned to authorize EA setup
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ==================== Trading Data Schemas ====================
class DealResponse(BaseModel):
    id: int
    ticket: str
    order_ticket: Optional[str] = None
    position_ticket: Optional[str] = None
    symbol: Optional[str] = None
    volume: float
    type: str
    entry_type: Optional[str] = None
    price: float
    commission: float
    swap: float
    profit: float
    magic: Optional[int] = None
    comment: Optional[str] = None
    execution_time: datetime

    class Config:
        from_attributes = True


class PositionResponse(BaseModel):
    id: int
    ticket: str
    symbol: str
    volume: float
    type: str
    price_open: float
    price_current: float
    sl: float
    tp: float
    commission: float
    swap: float
    profit: float
    magic: Optional[int] = None
    comment: Optional[str] = None
    opened_time: datetime

    class Config:
        from_attributes = True


# ==================== Analytics & Share Schemas ====================
class ShareLinkBase(BaseModel):
    slug: str
    is_active: Optional[bool] = True
    show_balance: Optional[bool] = True
    show_magic: Optional[bool] = False
    show_comment: Optional[bool] = False

class ShareLinkCreate(BaseModel):
    slug: Optional[str] = None  # Auto-generated if not provided
    show_balance: Optional[bool] = True
    show_magic: Optional[bool] = False
    show_comment: Optional[bool] = False

class ShareLinkResponse(ShareLinkBase):
    id: int
    account_id: int
    created_at: datetime

    class Config:
        from_attributes = True


class EquityCurvePoint(BaseModel):
    date: date
    balance: float
    equity: float
    floating_profit: float
    transaction_type: Optional[str] = None
    transaction_amount: Optional[float] = None


class CalendarPnlDay(BaseModel):
    date: date
    profit: float
    trades_count: int


class DashboardStats(BaseModel):
    balance: float
    equity: float
    floating_profit: float
    total_profit: float
    win_rate: float
    profit_factor: float
    total_trades: int
    drawdown_pct: float
    currency: str
    account_name: str
    broker_name: str
    status: str
    connection_type: str


class ConnectionEventResponse(BaseModel):
    id: int
    event_type: str
    message: str
    timestamp: datetime

    class Config:
        from_attributes = True
