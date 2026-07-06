"""
webull_client.py  —  Custom Webull OpenAPI REST Client
Handles HMAC-SHA1/HMAC-SHA256 signatures, token creation, and portfolio data retrieval.
Compatible with Python 3.14+ with no third-party package dependencies other than `requests`.
"""
import hmac
import hashlib
import uuid
import json
import base64
import time
from datetime import datetime
from urllib.parse import quote, urlencode
import requests

# Set of hosts that use HMAC-SHA1 signature and MD5 body hashing
UPGRADE_HOSTS = {
    "api.webull.com", "events-api.webull.com",
    "api.webull.hk", "events-api.webull.hk",
    "pre-openapi-us-alb.webullbroker.com", "pre-openapi-us-events.webullbroker.com",
    "pre-openapi-alb.webullbroker.com", "pre-openapi-events.webullbroker.com",
    "us-openapi-alb.uat.webullbroker.com", "us-openapi-events.uat.webullbroker.com",
    "hk-openapi.uat.webullbroker.com", "hk-openapi-events-api.uat.webullbroker.com",
    "api.sandbox.webull.hk", "events-api.sandbox.webull.hk"
}

def get_host_for_region(region: str) -> str:
    region = region.lower().strip()
    if region == "th":
        return "api.webull.co.th"
    return "api.webull.com"

def get_iso_8601_date() -> str:
    return datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")

def get_uuid() -> str:
    return str(uuid.uuid4())

def md5_hex(content: str) -> str:
    return hashlib.md5(content.encode("utf-8")).hexdigest()

def sha256_hex(content: str) -> str:
    return hashlib.sha256(content.encode("utf-8")).hexdigest()

def json_dumps_compact(content) -> str:
    return json.dumps(content, ensure_ascii=False, separators=(',', ':'))

def build_signature_headers(
    host: str,
    path: str,
    method: str,
    params: dict = None,
    body_params: dict = None,
    app_key: str = "",
    app_secret: str = "",
    access_token: str = None
) -> dict:
    """
    Build the signature headers and compute x-signature.
    Returns a dict of request headers.
    """
    params = params or {}
    use_sha256 = host not in UPGRADE_HOSTS

    headers = {
        "x-app-key": app_key,
        "x-timestamp": get_iso_8601_date(),
        "x-signature-version": "1.0",
        "x-signature-algorithm": "HMAC-SHA256" if use_sha256 else "HMAC-SHA1",
        "x-signature-nonce": get_uuid(),
        "x-version": "v2",
    }

    if access_token:
        headers["x-access-token"] = access_token

    # 1. Build lowercase canonical sign params
    sign_params = {k.lower(): str(v) for k, v in headers.items()}
    sign_params["host"] = host

    # 2. Add query parameters to sign_params
    for k, v in params.items():
        lk = k.lower()
        if lk in sign_params:
            sign_params[lk] = f"{sign_params[lk]}&{v}"
        else:
            sign_params[lk] = str(v)

    # 3. Calculate body string
    body_string = None
    if body_params is not None:
        raw_body = json_dumps_compact(body_params)
        if use_sha256:
            body_string = sha256_hex(raw_body).upper()
        else:
            body_string = md5_hex(raw_body).upper()

    # 4. Build string to sign
    sorted_map = sorted(sign_params.items(), key=lambda item: item[0])
    sorted_array = [f"{k}={v}" for k, v in sorted_map]
    
    if path:
        string_to_sign = f"{path}&{'&'.join(sorted_array)}"
    else:
        string_to_sign = "&".join(sorted_array)

    if body_string:
        string_to_sign = f"{string_to_sign}&{body_string}"

    # 5. Urlencode/quote the entire string (safe='')
    quoted_string = quote(string_to_sign, safe='')

    # 6. Generate HMAC signature (key = app_secret + "&")
    key = (app_secret + "&").encode("utf-8")
    msg = quoted_string.encode("utf-8")
    
    if use_sha256:
        h = hmac.new(key, msg, hashlib.sha256)
    else:
        h = hmac.new(key, msg, hashlib.sha1)

    signature = base64.b64encode(h.digest()).decode("utf-8").strip()
    headers["x-signature"] = signature
    return headers

class WebullRestClient:
    def __init__(self, app_key: str, app_secret: str, region: str = "th"):
        self.app_key = app_key.strip()
        self.app_secret = app_secret.strip()
        self.region = region.lower().strip()
        self.host = get_host_for_region(self.region)
        self.base_url = f"https://{self.host}"
        self.access_token = None

    def get_access_token(self) -> str:
        """Get or create an access token."""
        if self.access_token:
            return self.access_token

        path = "/openapi/auth/token/create"
        url = f"{self.base_url}{path}"
        
        headers = build_signature_headers(
            host=self.host,
            path=path,
            method="POST",
            app_key=self.app_key,
            app_secret=self.app_secret
        )
        headers["Content-Type"] = "application/json"
        
        # Payload is empty json
        res = requests.post(url, headers=headers, json={}, timeout=5)
        if res.status_code != 200:
            raise Exception(f"Failed to generate Webull Access Token (HTTP {res.status_code}): {res.text}")

        data = res.json()
        self.access_token = data.get("accessToken")
        if not self.access_token:
            raise Exception(f"Invalid Webull response: missing accessToken field: {data}")

        return self.access_token

    def get_account_list(self) -> list:
        """Retrieve list of accounts."""
        token = self.get_access_token()
        path = "/api/v2/account/get_account_list"
        url = f"{self.base_url}{path}"

        headers = build_signature_headers(
            host=self.host,
            path=path,
            method="POST",
            app_key=self.app_key,
            app_secret=self.app_secret,
            access_token=token
        )
        headers["Content-Type"] = "application/json"

        res = requests.post(url, headers=headers, json={}, timeout=5)
        if res.status_code != 200:
            raise Exception(f"Failed to get Webull account list (HTTP {res.status_code}): {res.text}")

        return res.json()

    def get_account_balance(self, account_id: str) -> dict:
        """Retrieve balance for specific account."""
        token = self.get_access_token()
        path = "/api/v2/account/get_account_balance"
        url = f"{self.base_url}{path}"

        body = {"account_id": account_id}
        headers = build_signature_headers(
            host=self.host,
            path=path,
            method="POST",
            body_params=body,
            app_key=self.app_key,
            app_secret=self.app_secret,
            access_token=token
        )
        headers["Content-Type"] = "application/json"

        res = requests.post(url, headers=headers, json=body, timeout=5)
        if res.status_code != 200:
            raise Exception(f"Failed to get Webull balance (HTTP {res.status_code}): {res.text}")

        return res.json()

    def get_account_positions(self, account_id: str) -> list:
        """Retrieve positions (holdings) for specific account."""
        token = self.get_access_token()
        path = "/api/v2/account/get_account_positions"
        url = f"{self.base_url}{path}"

        body = {"account_id": account_id}
        headers = build_signature_headers(
            host=self.host,
            path=path,
            method="POST",
            body_params=body,
            app_key=self.app_key,
            app_secret=self.app_secret,
            access_token=token
        )
        headers["Content-Type"] = "application/json"

        res = requests.post(url, headers=headers, json=body, timeout=5)
        if res.status_code != 200:
            raise Exception(f"Failed to get Webull positions (HTTP {res.status_code}): {res.text}")

        # Returns position list or wrapper dict depending on API model
        data = res.json()
        if isinstance(data, dict) and "positions" in data:
            return data["positions"]
        return data
