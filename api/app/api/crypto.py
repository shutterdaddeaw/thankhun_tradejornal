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

def fetch_evm_balances(address: str) -> dict:
    tokens = {}
    
    # Blockscout URLs for main networks
    networks = [
        {"base": "https://eth.blockscout.com/api/v2", "coin": "ETH"},
        {"base": "https://bsc.blockscout.com/api/v2", "coin": "BNB"},
        {"base": "https://base.blockscout.com/api/v2", "coin": "ETH"}
    ]
    
    headers = {"User-Agent": "Mozilla/5.0"}
    for net in networks:
        base_url = net["base"]
        coin_sym = net["coin"]
        
        # 1. Fetch native balance
        try:
            url = f"{base_url}/addresses/{address}"
            res = requests.get(url, headers=headers, timeout=4)
            if res.status_code == 200:
                data = res.json()
                raw_bal = data.get("coin_balance")
                exchange_rate = data.get("exchange_rate")
                if raw_bal:
                    val = float(raw_bal) / (10 ** 18)
                    price = float(exchange_rate) if exchange_rate else 0.0
                    if val > 0.0001:
                        if coin_sym in tokens:
                            tokens[coin_sym]["balance"] += val
                            if price > 0:
                                tokens[coin_sym]["price"] = price
                        else:
                            tokens[coin_sym] = {"balance": val, "price": price}
        except Exception as e:
            print(f"Error fetching native from {base_url}: {e}")
            
        # 2. Fetch ERC-20 tokens
        try:
            url = f"{base_url}/addresses/{address}/tokens"
            res = requests.get(url, headers=headers, timeout=4)
            if res.status_code == 200:
                data = res.json()
                items = data.get("items", [])
                for item in items:
                    t_info = item.get("token", {})
                    t_type = t_info.get("type")
                    if t_type != "ERC-20":
                        continue
                    
                    symbol = t_info.get("symbol")
                    decimals = t_info.get("decimals")
                    raw_val = item.get("value")
                    exchange_rate = t_info.get("exchange_rate")
                    
                    if symbol and decimals and raw_val:
                        try:
                            dec = int(decimals)
                            val = float(raw_val) / (10 ** dec)
                            price = float(exchange_rate) if exchange_rate else 0.0
                            if val > 0.0001:
                                sym = symbol.strip().upper()
                                # Accumulate multi-chain balances if the same token exists on multiple networks
                                if sym in tokens:
                                    tokens[sym]["balance"] += val
                                    if price > 0:
                                        tokens[sym]["price"] = price
                                else:
                                    tokens[sym] = {"balance": val, "price": price}
                        except Exception:
                            pass
        except Exception as e:
            print(f"Error fetching tokens from {base_url}: {e}")
            
    return tokens

@router.post("/accounts/{account_id}/sync")
def sync_prices(
    account_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """Sync prices for all crypto holdings under this account, or auto-scan blockchain balances if address is EVM."""
    account = db.query(TradingAccount).filter(
        TradingAccount.id == account_id,
        TradingAccount.user_id == current_user.id
    ).first()
    if not account:
        raise HTTPException(status_code=404, detail="Crypto account not found")

    address = (account.account_number or "").strip()
    is_evm = address.lower().startswith("0x") and len(address) == 42
    
    if is_evm:
        # Auto-scan MetaMask / EVM wallet using Blockscout!
        tokens = fetch_evm_balances(address)
        
        # Get existing holdings to delete any that are no longer present
        existing_holdings = db.query(CryptoHolding).filter(CryptoHolding.account_id == account_id).all()
        existing_symbols = {h.symbol: h for h in existing_holdings}
        
        # Upsert scanned tokens
        for symbol, info in tokens.items():
            bal = info["balance"]
            price = info["price"]
            
            # If price is 0, try to get from our price feed (Binance/Jupiter)
            if price == 0:
                p_feed = get_crypto_prices([symbol])
                price = p_feed.get(symbol, 0.0)
                
            val_usd = bal * price
            
            if symbol in existing_symbols:
                holding = existing_symbols[symbol]
                holding.balance = bal
                holding.current_price_usd = price
                holding.value_usd = val_usd
                holding.updated_at = datetime.utcnow()
            else:
                holding = CryptoHolding(
                    account_id=account_id,
                    symbol=symbol,
                    balance=bal,
                    current_price_usd=price,
                    value_usd=val_usd
                )
                db.add(holding)
                
        # Remove any tokens that are in DB but no longer present in scanned wallet (balance is now 0)
        scanned_symbols = set(tokens.keys())
        for symbol, holding in existing_symbols.items():
            if symbol not in scanned_symbols:
                db.delete(holding)
    else:
        # Regular manual sync: update prices for existing holdings
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
