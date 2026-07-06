from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Any, List
from datetime import datetime
import requests

from app.core.database import get_db
from app.models.models import TradingAccount, StockHolding, StockTrade, StockCashBalance
from app.api.deps import get_current_user
from app.models.models import User

router = APIRouter()

def format_symbol(symbol: str, currency: str = "THB") -> str:
    sym = symbol.strip().upper()
    if currency == "USD":
        return sym
    if not sym.endswith(".BK") and "." not in sym:
        return f"{sym}.BK"
    return sym

def get_stock_price_direct(symbol: str) -> float:
    try:
        url = f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?range=1d&interval=1m"
        headers = {"User-Agent": "Mozilla/5.0"}
        res = requests.get(url, headers=headers, timeout=2.5)
        if res.status_code == 200:
            data = res.json()
            result = data.get("chart", {}).get("result", [])
            if result:
                meta = result[0].get("meta", {})
                price = meta.get("regularMarketPrice")
                if price is not None:
                    return float(price)
    except Exception as e:
        print(f"Error fetching stock price direct for {symbol}: {e}")
    return 0.0

def get_stock_prices(symbols: List[str]) -> dict:
    prices = {}
    for sym in symbols:
        prices[sym] = get_stock_price_direct(sym)
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

    if account.connection_type == "webull_api":
        raise HTTPException(status_code=400, detail="Cannot manually edit holdings on a Webull API-connected account.")

    symbol = format_symbol(payload.get("symbol", ""), account.currency)
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

    if account.connection_type == "webull_api":
        raise HTTPException(status_code=400, detail="Cannot manually delete holdings on a Webull API-connected account.")

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

    if account.connection_type == "webull_api":
        raise HTTPException(status_code=400, detail="Cannot manually add trades to a Webull API-connected account.")

    symbol = format_symbol(payload.get("symbol", ""), account.currency)
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

    if account.connection_type == "webull_api":
        raise HTTPException(status_code=400, detail="Cannot manually update cash on a Webull API-connected account.")

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
def get_stock_candles(symbol: str, currency: str = "THB") -> Any:
    """Fetch historical candlestick data for the given stock symbol from Yahoo Finance."""
    try:
        sym = format_symbol(symbol, currency)
        url = f"https://query1.finance.yahoo.com/v8/finance/chart/{sym}?range=6mo&interval=1d"
        headers = {"User-Agent": "Mozilla/5.0"}
        res = requests.get(url, headers=headers, timeout=5)
        if res.status_code != 200:
            raise HTTPException(status_code=400, detail=f"Yahoo Finance returned status {res.status_code}")
            
        data = res.json()
        result = data.get("chart", {}).get("result", [])
        if not result:
            return []
            
        timestamps = result[0].get("timestamp", [])
        quote = result[0].get("indicators", {}).get("quote", [{}])[0]
        
        opens = quote.get("open", [])
        highs = quote.get("high", [])
        lows = quote.get("low", [])
        closes = quote.get("close", [])
        volumes = quote.get("volume", [])
        
        candles = []
        for i, ts in enumerate(timestamps):
            if i < len(opens) and i < len(closes) and opens[i] is not None and closes[i] is not None:
                # Convert timestamp to YYYY-MM-DD
                # We can construct date string natively without dependency
                import time
                date_str = time.strftime('%Y-%m-%d', time.gmtime(ts))
                candles.append({
                    "date": date_str,
                    "open": float(opens[i]),
                    "high": float(highs[i]) if highs[i] is not None else float(opens[i]),
                    "low": float(lows[i]) if lows[i] is not None else float(opens[i]),
                    "close": float(closes[i]),
                    "volume": int(volumes[i]) if volumes[i] is not None else 0
                })
        return candles
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch historical chart: {str(e)}")


@router.post("/accounts/{account_id}/sync-webull")
def sync_webull_account(
    account_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """Sync holdings and cash balance from Webull API."""
    account = db.query(TradingAccount).filter(
        TradingAccount.id == account_id,
        TradingAccount.user_id == current_user.id
    ).first()
    if not account:
        raise HTTPException(status_code=404, detail="Stock account not found")

    if account.connection_type != "webull_api":
        raise HTTPException(status_code=400, detail="This account is not configured for Webull API")

    creds = account.credentials
    if not creds or not creds.webull_app_key_encrypted or not creds.webull_app_secret_encrypted:
        raise HTTPException(status_code=400, detail="Webull credentials not configured")

    from app.core.security import decrypt_password, encrypt_password
    from app.services.webull_client import WebullRestClient

    try:
        app_key = decrypt_password(creds.webull_app_key_encrypted)
        app_secret = decrypt_password(creds.webull_app_secret_encrypted)
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to decrypt Webull credentials")

    region = account.server_name.strip().lower() if (account.server_name and account.server_name.strip()) else "th"
    if region not in ("th", "us", "sg", "hk", "my"):
        region = "th"

    # Load cached access token
    access_token = None
    if creds.webull_access_token_encrypted:
        try:
            access_token = decrypt_password(creds.webull_access_token_encrypted)
        except Exception:
            pass

    client = WebullRestClient(app_key, app_secret, region=region)
    if access_token:
        client.access_token = access_token

    try:
        # 1. Try to fetch Webull account ID with current/cached token
        accounts_data = client.get_account_list()
    except Exception as e:
        # If current token is expired, invalid or not present, request a new token
        try:
            client.access_token = None
            new_token = client.get_access_token()
        except Exception as auth_err:
            # Save the new pending token if it was generated
            if client.access_token:
                creds.webull_access_token_encrypted = encrypt_password(client.access_token)
                db.commit()
            raise HTTPException(status_code=400, detail=f"Webull Sync Error: {str(auth_err)}")

        # Save the new successful token
        creds.webull_access_token_encrypted = encrypt_password(client.access_token)
        db.commit()
        
        try:
            accounts_data = client.get_account_list()
        except Exception as retry_err:
            raise HTTPException(status_code=400, detail=f"Webull Sync Error: {str(retry_err)}")

    try:
        if not accounts_data:
            raise Exception("No Webull accounts found under these credentials")
            
        webull_acc_id = None
        for wa in accounts_data:
            acc_num = wa.get("account_number") or wa.get("account_id")
            if acc_num == account.account_number:
                webull_acc_id = wa.get("account_id")
                break
        
        if not webull_acc_id:
            # Fallback to first account
            webull_acc_id = accounts_data[0].get("account_id")
            if account.account_number in ("123456", "Combined", "all-stock", ""):
                account.account_number = str(webull_acc_id)

        # 2. Get Balance (to get cash balance and total equity)
        balance_data = client.get_account_balance(webull_acc_id)
        cash_val = balance_data.get("cash_balance")
        if cash_val is None:
            cash_val = balance_data.get("cash")
        if cash_val is None:
            cash_val = balance_data.get("buying_power", 0.0)
            
        cash_val = float(cash_val)

        # 3. Get Positions (holdings)
        positions_data = client.get_account_positions(webull_acc_id)

        # 4. Overwrite StockCashBalance
        cash_row = db.query(StockCashBalance).filter(StockCashBalance.account_id == account_id).first()
        if cash_row:
            cash_row.cash_balance = cash_val
            cash_row.updated_at = datetime.utcnow()
        else:
            cash_row = StockCashBalance(account_id=account_id, cash_balance=cash_val)
            db.add(cash_row)

        # 5. Overwrite holdings (delete old, add new)
        db.query(StockHolding).filter(StockHolding.account_id == account_id).delete()

        for pos in positions_data:
            sym = pos.get("symbol")
            if not sym:
                continue
                
            qty = float(pos.get("quantity") or pos.get("volume") or 0.0)
            if qty <= 0:
                continue
                
            cost = float(pos.get("cost_price") or pos.get("avg_price") or pos.get("avg_cost") or 0.0)
            curr_price = float(pos.get("last_price") or pos.get("current_price") or pos.get("close_price") or cost)
            
            sym = format_symbol(sym, account.currency)
            pnl = (curr_price - cost) * qty
            
            holding = StockHolding(
                account_id=account_id,
                symbol=sym,
                volume=qty,
                avg_price=cost,
                current_price=curr_price,
                pnl=pnl
            )
            db.add(holding)

        db.commit()
        
        # 6. Recalculate total account value
        recalculate_stock_account_value(account_id, db)
        
        return {"status": "success", "message": f"Successfully synced Webull account {webull_acc_id}"}
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Webull Sync Error: {str(e)}")

