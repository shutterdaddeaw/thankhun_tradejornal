from sqlalchemy import Column, Integer, String, Boolean, Float, DateTime, ForeignKey, Date, Numeric, Text, UniqueConstraint
from sqlalchemy.orm import relationship
from datetime import datetime
from app.core.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # AI summary settings
    ai_provider = Column(String, default="mock")
    ai_api_key = Column(String, nullable=True)
    ai_model = Column(String, nullable=True)
    ai_base_url = Column(String, nullable=True)

    # Relationships
    accounts = relationship("TradingAccount", back_populates="user", cascade="all, delete-orphan")


class TradingAccount(Base):
    __tablename__ = "trading_accounts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    account_number = Column(String, index=True, nullable=False)  # MT5 Login ID
    broker_name = Column(String, nullable=False)
    server_name = Column(String, nullable=False)
    account_name = Column(String, nullable=False)
    currency = Column(String, default="USD")
    leverage = Column(Integer, default=100)
    balance = Column(Float, default=0.0)
    equity = Column(Float, default=0.0)
    profit = Column(Float, default=0.0)  # current floating profit
    status = Column(String, default="pending_verify")  # e.g., pending_verify, active_account_sync, active_publisher_ea
    connection_type = Column(String, default="publisher_ea")  # account_sync, publisher_ea
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="accounts")
    credentials = relationship("AccountCredentials", uselist=False, back_populates="account", cascade="all, delete-orphan")
    sync_state = relationship("AccountSyncState", uselist=False, back_populates="account", cascade="all, delete-orphan")
    deals = relationship("Deal", back_populates="account", cascade="all, delete-orphan")
    positions = relationship("PositionOpen", back_populates="account", cascade="all, delete-orphan")
    balance_operations = relationship("BalanceOperation", back_populates="account", cascade="all, delete-orphan")
    equity_snapshots = relationship("DailyEquitySnapshot", back_populates="account", cascade="all, delete-orphan")
    metrics = relationship("AccountMetricsDaily", back_populates="account", cascade="all, delete-orphan")
    share_links = relationship("ShareLink", back_populates="account", cascade="all, delete-orphan")
    connection_events = relationship("ConnectionEvent", back_populates="account", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("user_id", "account_number", name="uq_user_account_number"),
    )


class AccountCredentials(Base):
    __tablename__ = "account_credentials"

    id = Column(Integer, primary_key=True, index=True)
    account_id = Column(Integer, ForeignKey("trading_accounts.id"), unique=True, nullable=False)
    investor_password_encrypted = Column(String, nullable=True)
    publisher_token = Column(String, unique=True, index=True, nullable=False)  # Token used by MQL5 EA to authenticate
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    account = relationship("TradingAccount", back_populates="credentials")


class AccountSyncState(Base):
    __tablename__ = "account_sync_state"

    id = Column(Integer, primary_key=True, index=True)
    account_id = Column(Integer, ForeignKey("trading_accounts.id"), unique=True, nullable=False)
    last_sync_time = Column(DateTime, nullable=True)
    last_successful_sync_time = Column(DateTime, nullable=True)
    last_error_message = Column(Text, nullable=True)
    last_deal_ticket = Column(String, nullable=True)  # Cursor for synced deals
    sync_cursor = Column(String, nullable=True)

    # Relationships
    account = relationship("TradingAccount", back_populates="sync_state")


class SyncJob(Base):
    __tablename__ = "sync_jobs"

    id = Column(Integer, primary_key=True, index=True)
    account_id = Column(Integer, ForeignKey("trading_accounts.id"), nullable=False)
    job_type = Column(String, nullable=False)  # verify, backfill, incremental
    status = Column(String, default="queued")  # queued, running, completed, failed
    attempts = Column(Integer, default=0)
    error_log = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)


class Deal(Base):
    __tablename__ = "deals"

    id = Column(Integer, primary_key=True, index=True)
    account_id = Column(Integer, ForeignKey("trading_accounts.id"), nullable=False)
    ticket = Column(String, index=True, nullable=False)  # MT5 deal ticket number
    order_ticket = Column(String, nullable=True)
    position_ticket = Column(String, nullable=True)  # Used to group entry/exit deals
    symbol = Column(String, nullable=True)
    volume = Column(Float, nullable=False)
    type = Column(String, nullable=False)  # buy, sell, balance, credit, etc.
    entry_type = Column(String, nullable=True)  # in, out, inout
    price = Column(Float, nullable=False)
    commission = Column(Float, default=0.0)
    swap = Column(Float, default=0.0)
    profit = Column(Float, default=0.0)
    magic = Column(Integer, nullable=True)
    comment = Column(String, nullable=True)
    execution_time = Column(DateTime, index=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    account = relationship("TradingAccount", back_populates="deals")

    __table_args__ = (
        UniqueConstraint("account_id", "ticket", name="uq_account_deal_ticket"),
    )


class PositionOpen(Base):
    __tablename__ = "positions_open"

    id = Column(Integer, primary_key=True, index=True)
    account_id = Column(Integer, ForeignKey("trading_accounts.id"), nullable=False)
    ticket = Column(String, index=True, nullable=False)  # MT5 position ticket number
    symbol = Column(String, nullable=False)
    volume = Column(Float, nullable=False)
    type = Column(String, nullable=False)  # buy, sell
    price_open = Column(Float, nullable=False)
    price_current = Column(Float, nullable=False)
    sl = Column(Float, default=0.0)
    tp = Column(Float, default=0.0)
    commission = Column(Float, default=0.0)
    swap = Column(Float, default=0.0)
    profit = Column(Float, default=0.0)  # Floating profit/loss
    magic = Column(Integer, nullable=True)
    comment = Column(String, nullable=True)
    opened_time = Column(DateTime, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    account = relationship("TradingAccount", back_populates="positions")

    __table_args__ = (
        UniqueConstraint("account_id", "ticket", name="uq_account_position_ticket"),
    )


class BalanceOperation(Base):
    __tablename__ = "balance_operations"

    id = Column(Integer, primary_key=True, index=True)
    account_id = Column(Integer, ForeignKey("trading_accounts.id"), nullable=False)
    ticket = Column(String, nullable=True)  # Associated ticket if from deal
    type = Column(String, nullable=False)  # deposit, withdrawal, credit, bonus
    amount = Column(Float, nullable=False)
    comment = Column(String, nullable=True)
    timestamp = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    account = relationship("TradingAccount", back_populates="balance_operations")


class DailyEquitySnapshot(Base):
    __tablename__ = "daily_equity_snapshots"

    id = Column(Integer, primary_key=True, index=True)
    account_id = Column(Integer, ForeignKey("trading_accounts.id"), nullable=False)
    date = Column(Date, index=True, nullable=False)
    balance = Column(Float, nullable=False)
    equity = Column(Float, nullable=False)
    floating_profit = Column(Float, default=0.0)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    account = relationship("TradingAccount", back_populates="equity_snapshots")

    __table_args__ = (
        UniqueConstraint("account_id", "date", name="uq_account_snapshot_date"),
    )


class AccountMetricsDaily(Base):
    __tablename__ = "account_metrics_daily"

    id = Column(Integer, primary_key=True, index=True)
    account_id = Column(Integer, ForeignKey("trading_accounts.id"), nullable=False)
    date = Column(Date, index=True, nullable=False)
    daily_profit = Column(Float, default=0.0)
    daily_return_pct = Column(Float, default=0.0)
    drawdown_pct = Column(Float, default=0.0)
    win_rate = Column(Float, default=0.0)
    profit_factor = Column(Float, default=0.0)
    total_trades = Column(Integer, default=0)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    account = relationship("TradingAccount", back_populates="metrics")

    __table_args__ = (
        UniqueConstraint("account_id", "date", name="uq_account_metrics_date"),
    )


class ShareLink(Base):
    __tablename__ = "share_links"

    id = Column(Integer, primary_key=True, index=True)
    account_id = Column(Integer, ForeignKey("trading_accounts.id"), nullable=False)
    slug = Column(String, unique=True, index=True, nullable=False)
    is_active = Column(Boolean, default=True)
    show_balance = Column(Boolean, default=True)
    show_magic = Column(Boolean, default=False)
    show_comment = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    account = relationship("TradingAccount", back_populates="share_links")


class ConnectionEvent(Base):
    __tablename__ = "connection_events"

    id = Column(Integer, primary_key=True, index=True)
    account_id = Column(Integer, ForeignKey("trading_accounts.id"), nullable=False)
    event_type = Column(String, nullable=False)  # info, warning, error, sync_failed, sync_success, publisher_heartbeat
    message = Column(Text, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)

    # Relationships
    account = relationship("TradingAccount", back_populates="connection_events")


class UserBackupLog(Base):
    __tablename__ = "user_backup_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    backup_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    user = relationship("User", backref="backup_logs")
