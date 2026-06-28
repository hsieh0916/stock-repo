"""
Fetch latest closing prices for all TWSE/TPEX stocks from official OpenAPI.
Output: data/public/prices.json and web/public/prices.json — {code: close_price}

Sources:
  TWSE (上市): https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL
  TPEX (上櫃): https://www.tpex.org.tw/openapi/v1/tpex_mainboard_quotes
"""

import json
import os
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
PUB_DIR = os.path.join(ROOT, "data", "public")
WEB_PUB_DIR = os.path.join(ROOT, "web", "public")

UA = "Mozilla/5.0 (compatible; etf-tracker/0.1)"

TWSE_URL = "https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL"
TPEX_URL = "https://www.tpex.org.tw/openapi/v1/tpex_mainboard_quotes"


def _get_json(url, timeout=30):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read())


def _to_float(s):
    try:
        return float(str(s).replace(",", "").strip())
    except (ValueError, TypeError):
        return None


def build(timeout=30):
    """Fetch and save closing prices. Returns {code: price} dict."""
    prices = {}

    # TWSE listed stocks (上市) — fields: Code, ClosingPrice
    try:
        rows = _get_json(TWSE_URL, timeout)
        n = 0
        for row in rows:
            code = str(row.get("Code", "")).strip()
            p = _to_float(row.get("ClosingPrice", ""))
            if code and p and p > 0:
                prices[code] = p
                n += 1
        print(f"prices: {n} TWSE stocks")
    except Exception as e:
        print(f"prices: TWSE failed: {e}")

    # TPEX OTC stocks (上櫃) — fields: SecuritiesCompanyCode, Close
    try:
        rows = _get_json(TPEX_URL, timeout)
        n = 0
        for row in rows:
            code = str(row.get("SecuritiesCompanyCode", "")).strip()
            p = _to_float(row.get("Close", ""))
            if code and p and p > 0:
                prices[code] = p
                n += 1
        print(f"prices: {n} TPEX stocks")
    except Exception as e:
        print(f"prices: TPEX failed: {e}")

    out = json.dumps(prices, ensure_ascii=False, separators=(",", ":"))
    os.makedirs(PUB_DIR, exist_ok=True)
    with open(os.path.join(PUB_DIR, "prices.json"), "w", encoding="utf-8") as f:
        f.write(out)
    if os.path.isdir(WEB_PUB_DIR):
        with open(os.path.join(WEB_PUB_DIR, "prices.json"), "w", encoding="utf-8") as f:
            f.write(out)
    print(f"prices: saved {len(prices)} total entries")
    return prices


if __name__ == "__main__":
    build()
