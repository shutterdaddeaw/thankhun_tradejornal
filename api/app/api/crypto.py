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
    
    # Blockscout URLs for main networks (excluding Linea/BSC to bypass Cloudflare and 404s)
    networks = [
        {"base": "https://eth.blockscout.com/api/v2", "coin": "ETH"},
        {"base": "https://base.blockscout.com/api/v2", "coin": "ETH"},
        {"base": "https://polygon.blockscout.com/api/v2", "coin": "POL"},
        {"base": "https://arbitrum.blockscout.com/api/v2", "coin": "ETH"},
        {"base": "https://optimism.blockscout.com/api/v2", "coin": "ETH"}
    ]
    
    # Direct Linea RPC native ETH check
    try:
        rpc_url = "https://rpc.linea.build"
        payload = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "eth_getBalance",
            "params": [address, "latest"]
        }
        res = requests.post(rpc_url, json=payload, timeout=4)
        if res.status_code == 200:
            result = res.json().get("result")
            if result:
                wei_val = int(result, 16)
                eth_val = wei_val / 1e18
                if eth_val > 0.0001:
                    tokens["ETH"] = {"balance": eth_val, "price": 0.0}
    except Exception as e:
        print(f"Error fetching Linea RPC: {e}")
        
    # Direct BSC RPC native BNB check
    try:
        bsc_rpc_url = "https://bsc-dataseed.binance.org"
        payload = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "eth_getBalance",
            "params": [address, "latest"]
        }
        res = requests.post(bsc_rpc_url, json=payload, timeout=4)
        if res.status_code == 200:
            result = res.json().get("result")
            if result:
                wei_val = int(result, 16)
                bnb_val = wei_val / 1e18
                if bnb_val > 0.0001:
                    tokens["BNB"] = {"balance": bnb_val, "price": 0.0}
    except Exception as e:
        print(f"Error fetching BSC RPC: {e}")
    
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

def fetch_solana_balances(address: str) -> dict:
    tokens = {}
    
    # 1. Fetch native SOL balance
    try:
        url = "https://api.mainnet-beta.solana.com"
        payload = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "getBalance",
            "params": [address]
        }
        res = requests.post(url, json=payload, timeout=4)
        if res.status_code == 200:
            result = res.json().get("result", {})
            value = result.get("value", 0)
            sol_balance = float(value) / 1e9
            if sol_balance > 0.0001:
                p_feed = get_crypto_prices(["SOL"])
                sol_price = p_feed.get("SOL", 0.0)
                tokens["SOL"] = {"balance": sol_balance, "price": sol_price}
    except Exception as e:
        print(f"Error fetching SOL balance: {e}")
        
    # 2. Fetch SPL token balances
    try:
        url = "https://api.mainnet-beta.solana.com"
        payload = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "getTokenAccountsByOwner",
            "params": [
                address,
                {"programId": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"},
                {"encoding": "jsonParsed"}
            ]
        }
        res = requests.post(url, json=payload, timeout=4)
        if res.status_code == 200:
            result = res.json().get("result", {}).get("value", [])
            for item in result:
                parsed_info = item.get("account", {}).get("data", {}).get("parsed", {}).get("info", {})
                mint = parsed_info.get("mint")
                token_amount = parsed_info.get("tokenAmount", {})
                ui_amount = token_amount.get("uiAmount", 0.0)
                
                # Check if it is a common token and balance is positive
                SOL_COMMON_TOKENS = {
                    "EPjFWdd5AufqSSjN7mvkyCeqMTJ5k91yZYJJELzSM5j": "USDC",
                    "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB": "USDT",
                    "JUPyiwrYJF1m4F2Xbh9Q56o6qg35jNMJwi17CZaYn94": "JUP",
                    "HZ128J7hU2GAtu4YdJ884751z31Y15K4edC65W1RnaJQ": "PYTH",
                    "jtoJsD2C2v1h7d3Y93ePpwVYQgx2H87iDG88A7tJGsV": "JTO"
                }
                if mint in SOL_COMMON_TOKENS and ui_amount > 0.0001:
                    symbol = SOL_COMMON_TOKENS[mint]
                    p_feed = get_crypto_prices([symbol])
                    price = p_feed.get(symbol, 0.0)
                    tokens[symbol] = {"balance": ui_amount, "price": price}
    except Exception as e:
        print(f"Error fetching SPL tokens: {e}")
        
    return tokens

@router.post("/accounts/{account_id}/sync")
def sync_prices(
    account_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """Sync prices for all crypto holdings under this account, or auto-scan blockchain balances if address is EVM or Solana."""
    account = db.query(TradingAccount).filter(
        TradingAccount.id == account_id,
        TradingAccount.user_id == current_user.id
    ).first()
    if not account:
        raise HTTPException(status_code=404, detail="Crypto account not found")

    address = (account.account_number or "").strip()
    is_evm = address.lower().startswith("0x") and len(address) == 42
    is_sol = len(address) >= 32 and len(address) <= 44 and not address.lower().startswith("0x")
    
    if is_evm or is_sol:
        # Auto-scan EVM or Solana wallet!
        tokens = fetch_evm_balances(address) if is_evm else fetch_solana_balances(address)
        
        # Get existing holdings to delete any that are no longer present
        existing_holdings = db.query(CryptoHolding).filter(CryptoHolding.account_id == account_id).all()
        existing_symbols = {h.symbol: h for h in existing_holdings}
        
        # Upsert scanned tokens
        saved_symbols = set()
        for symbol, info in tokens.items():
            bal = info["balance"]
            price = info["price"]
            
            # If price is 0, try to get from our price feed (Binance/Jupiter)
            if price == 0:
                p_feed = get_crypto_prices([symbol])
                price = p_feed.get(symbol, 0.0)
                
            val_usd = bal * price
            
            # Filter out spam/low-value tokens (under $1 value)
            if val_usd < 1.0:
                continue
                
            saved_symbols.add(symbol)
            
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
                
        # Remove any tokens that are in DB but no longer present, or are worth less than $1
        for symbol, holding in existing_symbols.items():
            if symbol not in saved_symbols:
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
