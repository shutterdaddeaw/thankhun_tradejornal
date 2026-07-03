from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Any, List
from datetime import datetime
import yfinance as yf

from app.core.database import get_db
from app.models.models import TradingAccount, StockHolding, StockTrade, StockCashBalance
from app.api.deps import get_current_user
from app.models.models import User

router = APIRouter()

def format_symbol(symbol: str) -> str:
    sym = symbol.strip().upper()
    if not sym.endswith(".BK") and "." not in sym:
        return f"{sym}.BK"
    return sym

def get_stock_prices(symbols: List[str]) -> dict:
    prices = {}
    if not symbols:
        return prices
    try:
        tickers_str = " ".join(symbols)
        tickers = yf.Tickers(tickers_str)
        for sym in symbols:
            try:
                ticker = tickers.tickers[sym]
                price = ticker.fast_info.get("last_price")
                if price is None:
                    hist = ticker.history(period="1d")
                    if not hist.empty:
                        price = hist["Close"].iloc[-1]
                if price is not None:
                    prices[sym] = float(price)
            except Exception as e:
                print(f"Error fetching price for {sym}: {str(e)}")
                # Try fallback direct ticker call
                try:
                    t = yf.Ticker(sym)
                    hist = t.history(period="1d")
                    if not hist.empty:
                        prices[sym] = float(hist["Close"].iloc[-1])
                except Exception:
                    pass
    except Exception as e:
        print(f"Error calling yfinance: {str(e)}")
    return prices

def recalculate_stock_account_value(account_id: int, db: Session):
    account = db.query(TradingAccount).filter(TradingAccount.id == account_id).first()
    if not account:
        return
    cash = db.query(StockCashBalance).filter(StockCashBalance.account_id == account_id).first()
    cash_val = cash.cash_balance if cash else 0.0
    
    holdings = db.query(StockHolding).filter(StockHolding.account_id == account_id).all()
    symbols = [h.symbol for h in holdings]
    prices = get_stock_prices(symbols)
    
    holdings_val = 0.0
    for h in holdings:
        current_p = prices.get(h.symbol, h.current_price)
        holdings_val += h.volume * current_p
        
    total = cash_val + holdings_val
    account.balance = total
    account.equity = total
    db.commit()

@router.get("/accounts/{account_id}/holdings")
def get_holdings(
    account_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """Retrieve current stock holdings, updating current prices and pnl from Yahoo Finance."""
    account = db.query(TradingAccount).filter(
        TradingAccount.id == account_id,
        TradingAccount.user_id == current_user.id
    ).first()
    if not account:
        raise HTTPException(status_code=404, detail="Stock account not found")

    holdings = db.query(StockHolding).filter(StockHolding.account_id == account_id).all()
    
    # Batch update prices from Yahoo Finance
    symbols = [h.symbol for h in holdings]
    prices = get_stock_prices(symbols)
    
    res = []
    for h in holdings:
        if h.symbol in prices:
            h.current_price = prices[h.symbol]
            h.pnl = (h.current_price - h.avg_price) * h.volume
        res.append({
            "id": h.id,
            "symbol": h.symbol,
            "volume": h.volume,
            "avg_price": h.avg_price,
            "current_price": h.current_price,
            "pnl": h.pnl,
            "updated_at": h.updated_at.isoformat() if h.updated_at else None
        })
    db.commit()
    recalculate_stock_account_value(account_id, db)
    return res

@router.post("/accounts/{account_id}/holdings")
def upsert_holding(
    account_id: int,
    payload: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """Add or update a stock holding manually."""
    account = db.query(TradingAccount).filter(
        TradingAccount.id == account_id,
        TradingAccount.user_id == current_user.id
    ).first()
    if not account:
        raise HTTPException(status_code=404, detail="Stock account not found")

    symbol = format_symbol(payload.get("symbol", ""))
    if not symbol:
        raise HTTPException(status_code=400, detail="Symbol is required")
        
    volume = int(payload.get("volume", 0))
    avg_price = float(payload.get("avg_price", 0.0))
    
    # Query current price
    prices = get_stock_prices([symbol])
    current_price = prices.get(symbol, avg_price)
    pnl = (current_price - avg_price) * volume

    holding = db.query(StockHolding).filter(
        StockHolding.account_id == account_id,
        StockHolding.symbol == symbol
    ).first()

    if holding:
        if volume <= 0:
            db.delete(holding)
        else:
            holding.volume = volume
            holding.avg_price = avg_price
            holding.current_price = current_price
            holding.pnl = pnl
            holding.updated_at = datetime.utcnow()
    elif volume > 0:
        holding = StockHolding(
            account_id=account_id,
            symbol=symbol,
            volume=volume,
            avg_price=avg_price,
            current_price=current_price,
            pnl=pnl
        )
        db.add(holding)

    db.commit()
    recalculate_stock_account_value(account_id, db)
    return {"status": "success"}

@router.delete("/accounts/{account_id}/holdings/{holding_id}")
def delete_holding(
    account_id: int,
    holding_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """Delete a stock holding."""
    account = db.query(TradingAccount).filter(
        TradingAccount.id == account_id,
        TradingAccount.user_id == current_user.id
    ).first()
    if not account:
        raise HTTPException(status_code=404, detail="Stock account not found")

    holding = db.query(StockHolding).filter(
        StockHolding.id == holding_id,
        StockHolding.account_id == account_id
    ).first()
    if not holding:
        raise HTTPException(status_code=404, detail="Holding not found")
        
    db.delete(holding)
    db.commit()
    recalculate_stock_account_value(account_id, db)
    return {"status": "success"}

@router.get("/accounts/{account_id}/trades")
def get_trades(
    account_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """Get stock trade history."""
    account = db.query(TradingAccount).filter(
        TradingAccount.id == account_id,
        TradingAccount.user_id == current_user.id
    ).first()
    if not account:
        raise HTTPException(status_code=404, detail="Stock account not found")

    trades = db.query(StockTrade).filter(
        StockTrade.account_id == account_id
    ).order_by(StockTrade.date.desc()).all()
    
    return [
        {
            "id": t.id,
            "symbol": t.symbol,
            "action": t.action,
            "volume": t.volume,
            "price": t.price,
            "realized_pnl": t.realized_pnl,
            "date": t.date.isoformat() if t.date else None,
            "reason": t.reason
        }
        for t in trades
    ]

@router.post("/accounts/{account_id}/trades")
def add_trade(
    account_id: int,
    payload: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """Record a new stock trade (BUY or SELL) and automatically adjust holdings and cash balance."""
    account = db.query(TradingAccount).filter(
        TradingAccount.id == account_id,
        TradingAccount.user_id == current_user.id
    ).first()
    if not account:
        raise HTTPException(status_code=404, detail="Stock account not found")

    symbol = format_symbol(payload.get("symbol", ""))
    action = payload.get("action", "").upper()  # BUY, SELL
    volume = int(payload.get("volume", 0))
    price = float(payload.get("price", 0.0))
    reason = payload.get("reason", "")

    if not symbol or action not in ("BUY", "SELL") or volume <= 0 or price <= 0:
        raise HTTPException(status_code=400, detail="Invalid trade parameters")

    # 1. Query existing holding to compute realized PnL and update volumes
    holding = db.query(StockHolding).filter(
        StockHolding.account_id == account_id,
        StockHolding.symbol == symbol
    ).first()

    realized_pnl = 0.0
    
    if action == "BUY":
        if holding:
            new_volume = holding.volume + volume
            # Compute new average price
            new_avg = ((holding.volume * holding.avg_price) + (volume * price)) / new_volume
            holding.volume = new_volume
            holding.avg_price = new_avg
            holding.updated_at = datetime.utcnow()
        else:
            holding = StockHolding(
                account_id=account_id,
                symbol=symbol,
                volume=volume,
                avg_price=price,
                current_price=price,
                pnl=0.0
            )
            db.add(holding)
    else:  # SELL
        if not holding or holding.volume < volume:
            raise HTTPException(status_code=400, detail="Insufficient stock holdings to sell")
        
        realized_pnl = (price - holding.avg_price) * volume
        new_volume = holding.volume - volume
        
        if new_volume == 0:
            db.delete(holding)
        else:
            holding.volume = new_volume
            holding.updated_at = datetime.utcnow()

    # 2. Record the trade
    trade = StockTrade(
        account_id=account_id,
        symbol=symbol,
        action=action,
        volume=volume,
        price=price,
        realized_pnl=realized_pnl,
        reason=reason
    )
    db.add(trade)

    # 3. Update cash balance
    cash = db.query(StockCashBalance).filter(StockCashBalance.account_id == account_id).first()
    if not cash:
        cash = StockCashBalance(account_id=account_id, cash_balance=0.0)
        db.add(cash)
        
    total_cost = volume * price
    if action == "BUY":
        cash.cash_balance -= total_cost
    else:  # SELL
        cash.cash_balance += total_cost

    db.commit()
    recalculate_stock_account_value(account_id, db)
    return {"status": "success"}

@router.get("/accounts/{account_id}/cash")
def get_cash(
    account_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """Retrieve current stock cash balance."""
    account = db.query(TradingAccount).filter(
        TradingAccount.id == account_id,
        TradingAccount.user_id == current_user.id
    ).first()
    if not account:
        raise HTTPException(status_code=404, detail="Stock account not found")

    cash = db.query(StockCashBalance).filter(StockCashBalance.account_id == account_id).first()
    return {"cash_balance": cash.cash_balance if cash else 0.0}

@router.post("/accounts/{account_id}/cash")
def update_cash(
    account_id: int,
    payload: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """Update stock cash balance manually."""
    account = db.query(TradingAccount).filter(
        TradingAccount.id == account_id,
        TradingAccount.user_id == current_user.id
    ).first()
    if not account:
        raise HTTPException(status_code=404, detail="Stock account not found")

    amount = float(payload.get("cash_balance", 0.0))
    cash = db.query(StockCashBalance).filter(StockCashBalance.account_id == account_id).first()
    
    if cash:
        cash.cash_balance = amount
        cash.updated_at = datetime.utcnow()
    else:
        cash = StockCashBalance(account_id=account_id, cash_balance=amount)
        db.add(cash)
        
    db.commit()
    recalculate_stock_account_value(account_id, db)
    return {"status": "success", "cash_balance": amount}


@router.get("/candles/{symbol}")
def get_stock_candles(symbol: str) -> Any:
    """Fetch historical candlestick data for the given stock symbol from Yahoo Finance."""
    try:
        sym = format_symbol(symbol)
        ticker = yf.Ticker(sym)
        hist = ticker.history(period="6mo", interval="1d")
        res = []
        for date_idx, row in hist.iterrows():
            res.append({
                "date": date_idx.strftime("%Y-%m-%d"),
                "open": float(row["Open"]),
                "high": float(row["High"]),
                "low": float(row["Low"]),
                "close": float(row["Close"]),
                "volume": int(row["Volume"])
            })
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch historical chart: {str(e)}")
