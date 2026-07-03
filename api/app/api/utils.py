from fastapi import APIRouter
import requests

router = APIRouter()

_rate_cache = {"rate": None, "timestamp": 0}

def get_usd_thb_rate() -> float:
    """Fetch real-time USD/THB exchange rate from Yahoo Finance. Caches for 5 minutes."""
    import time
    now = time.time()
    if _rate_cache["rate"] and (now - _rate_cache["timestamp"]) < 300:
        return _rate_cache["rate"]
    
    try:
        url = "https://query1.finance.yahoo.com/v8/finance/chart/USDTHB=X"
        headers = {"User-Agent": "Mozilla/5.0"}
        r = requests.get(url, headers=headers, timeout=5)
        if r.status_code == 200:
            data = r.json()
            rate = data["chart"]["result"][0]["meta"]["regularMarketPrice"]
            _rate_cache["rate"] = float(rate)
            _rate_cache["timestamp"] = now
            return float(rate)
    except Exception as e:
        print(f"Error fetching USD/THB rate: {e}")
    
    # fallback to cached or default
    return _rate_cache["rate"] or 33.0


@router.get("/exchange-rate")
def get_exchange_rate():
    """Get real-time USD to THB exchange rate from Yahoo Finance."""
    rate = get_usd_thb_rate()
    return {
        "usd_thb": rate,
        "source": "Yahoo Finance (USDTHB=X)"
    }
