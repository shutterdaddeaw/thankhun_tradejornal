from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Any, List
from datetime import datetime
import requests

from app.core.database import get_db
from app.models.models import TradingAccount, CryptoHolding, CryptoWallet
from app.api.deps import get_current_user
from app.models.models import User

router = APIRouter()

def get_crypto_prices(symbols: List[str]) -> dict:
    prices = {}
    if not symbols:
        return prices
        
    for symbol in symbols:
        sym = symbol.strip().upper()
        if sym in ("USDT", "USDC", "USD"):
            prices[symbol] = 1.0
            continue
            
        # Try Binance API
        try:
            res = requests.get(f"https://api.binance.com/api/v3/ticker/price?symbol={sym}USDT", timeout=3)
            if res.status_code == 200:
                prices[symbol] = float(res.json().get("price", 0.0))
                continue
        except Exception:
            pass
            
        # Try Jupiter Price API (for Solana ecosystem tokens)
        try:
            res = requests.get(f"https://api.jup.ag/price/v2?ids={sym}", timeout=3)
            if res.status_code == 200:
                data = res.json().get("data", {})
                if sym in data:
                    prices[symbol] = float(data[sym].get("price", 0.0))
                    continue
        except Exception:
            pass
            
        # Fallback default price (default to 0.0 if not found)
        prices[symbol] = 0.0
    return prices

def recalculate_crypto_account_value(account_id: int, db: Session):
    account = db.query(TradingAccount).filter(TradingAccount.id == account_id).first()
    if not account:
        return
    holdings = db.query(CryptoHolding).filter(CryptoHolding.account_id == account_id).all()
    total = sum(h.value_usd for h in holdings)
    account.balance = total
    account.equity = total
    db.commit()

@router.get("/accounts/{account_id}/holdings")
def get_holdings(
    account_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """Retrieve crypto holdings, updating prices via Binance and Jupiter API."""
    account = db.query(TradingAccount).filter(
        TradingAccount.id == account_id,
        TradingAccount.user_id == current_user.id
    ).first()
    if not account:
        raise HTTPException(status_code=404, detail="Crypto account not found")

    holdings = db.query(CryptoHolding).filter(CryptoHolding.account_id == account_id).all()
    
    # Update prices on fetch
    symbols = [h.symbol for h in holdings]
    prices = get_crypto_prices(symbols)
    
    res = []
    for h in holdings:
        if h.symbol in prices and prices[h.symbol] > 0:
            h.current_price_usd = prices[h.symbol]
            h.value_usd = h.balance * h.current_price_usd
            
        res.append({
            "id": h.id,
            "symbol": h.symbol,
            "balance": h.balance,
            "avg_purchase_price": h.avg_purchase_price,
            "current_price_usd": h.current_price_usd,
            "value_usd": h.value_usd,
            "updated_at": h.updated_at.isoformat() if h.updated_at else None
        })
    db.commit()
    recalculate_crypto_account_value(account_id, db)
    return res

@router.post("/accounts/{account_id}/holdings")
def upsert_holding(
    account_id: int,
    payload: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """Manually add or edit a crypto holding."""
    account = db.query(TradingAccount).filter(
        TradingAccount.id == account_id,
        TradingAccount.user_id == current_user.id
    ).first()
    if not account:
        raise HTTPException(status_code=404, detail="Crypto account not found")

    symbol = payload.get("symbol", "").strip().upper()
    if not symbol:
        raise HTTPException(status_code=400, detail="Symbol is required")
        
    balance = float(payload.get("balance", 0.0))
    avg_purchase_price = payload.get("avg_purchase_price")
    if avg_purchase_price is not None:
        avg_purchase_price = float(avg_purchase_price)
        
    # Get current price
    prices = get_crypto_prices([symbol])
    current_price = prices.get(symbol, 0.0)
    value_usd = balance * current_price

    holding = db.query(CryptoHolding).filter(
        CryptoHolding.account_id == account_id,
        CryptoHolding.symbol == symbol
    ).first()

    if holding:
        if balance <= 0:
            db.delete(holding)
        else:
            holding.balance = balance
            if avg_purchase_price is not None:
                holding.avg_purchase_price = avg_purchase_price
            holding.current_price_usd = current_price
            holding.value_usd = value_usd
            holding.updated_at = datetime.utcnow()
    elif balance > 0:
        holding = CryptoHolding(
            account_id=account_id,
            symbol=symbol,
            balance=balance,
            avg_purchase_price=avg_purchase_price,
            current_price_usd=current_price,
            value_usd=value_usd
        )
        db.add(holding)

    db.commit()
    recalculate_crypto_account_value(account_id, db)
    return {"status": "success"}

@router.delete("/accounts/{account_id}/holdings/{holding_id}")
def delete_holding(
    account_id: int,
    holding_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """Delete a crypto holding."""
    account = db.query(TradingAccount).filter(
        TradingAccount.id == account_id,
        TradingAccount.user_id == current_user.id
    ).first()
    if not account:
        raise HTTPException(status_code=404, detail="Crypto account not found")

    holding = db.query(CryptoHolding).filter(
        CryptoHolding.id == holding_id,
        CryptoHolding.account_id == account_id
    ).first()
    if not holding:
        raise HTTPException(status_code=404, detail="Holding not found")
        
    db.delete(holding)
    db.commit()
    recalculate_crypto_account_value(account_id, db)
    return {"status": "success"}

@router.post("/accounts/{account_id}/sync")
def sync_prices(
    account_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """Sync prices for all crypto holdings under this account."""
    account = db.query(TradingAccount).filter(
        TradingAccount.id == account_id,
        TradingAccount.user_id == current_user.id
    ).first()
    if not account:
        raise HTTPException(status_code=404, detail="Crypto account not found")

    holdings = db.query(CryptoHolding).filter(CryptoHolding.account_id == account_id).all()
    symbols = [h.symbol for h in holdings]
    prices = get_crypto_prices(symbols)
    
    for h in holdings:
        if h.symbol in prices and prices[h.symbol] > 0:
            h.current_price_usd = prices[h.symbol]
            h.value_usd = h.balance * h.current_price_usd
            h.updated_at = datetime.utcnow()
            
    db.commit()
    recalculate_crypto_account_value(account_id, db)
    return {"status": "success"}
