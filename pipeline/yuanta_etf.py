"""元大全球AI新經濟主動式ETF (00990A) — fetch & parse module.

Uses etfapi.yuantaetfs.com bridge API.
Data available from 2026-01-02.
trandate field format: YYYYMMDD.
Non-trading days return empty StockWeights → parse() returns None.
"""

import datetime
import json
import urllib.request

TICKER = "00990A"
API_URL = "https://etfapi.yuantaetfs.com/ectranslation/api/bridge"
UA = "Mozilla/5.0 (compatible; etf-00990a-tracker/0.1)"

_BASE_PARAMS = {
    "APIType": "ETFAPI",
    "CompanyName": "YUANTAFUNDS",
    "PageName": f"/tradeInfo/pcf/{TICKER}",
    "DeviceId": "null",
    "FuncId": "PCF/Daily",
    "AppName": "ETF",
    "Device": "3",
    "Platform": "ETF",
    "ticker": TICKER,
}


def fetch(date_ymd=None, timeout=30):
    params = dict(_BASE_PARAMS)
    if date_ymd:
        params["ndate"] = date_ymd.replace("-", "")
    qs = "&".join(f"{k}={v}" for k, v in params.items())
    req = urllib.request.Request(
        f"{API_URL}?{qs}",
        headers={
            "User-Agent": UA,
            "Referer": f"https://www.yuantaetfs.com/tradeInfo/pcf/{TICKER}",
            "Origin": "https://www.yuantaetfs.com",
        },
    )
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read())


def parse(raw):
    pcf = raw.get("PCF") or {}
    td = pcf.get("trandate") or ""
    if not td or len(td) != 8:
        return None
    try:
        date_str = datetime.datetime.strptime(td, "%Y%m%d").strftime("%Y-%m-%d")
    except ValueError:
        return None

    nav_total = int(pcf.get("totalav") or 0)
    units = int(pcf.get("osunit") or 0)
    nav_per_unit = float(pcf.get("nav") or 0)

    if nav_total <= 0 or not units:
        return None

    stocks = (raw.get("FundWeights") or {}).get("StockWeights") or []
    if not stocks:
        return None

    holdings = []
    for s in stocks:
        code = (s.get("code") or "").strip()
        if not code:
            continue
        weight = round(float(s.get("weights") or 0), 6)
        shares = int(s.get("qty") or 0)
        amount = int(weight / 100 * nav_total)
        holdings.append({
            "code": code,
            "name": (s.get("name") or "").strip(),
            "shares": shares,
            "amount": amount,
            "weight": weight,
        })

    holdings.sort(key=lambda h: -(h.get("weight") or 0))

    return {
        "date": date_str,
        "nav_total": nav_total,
        "units": units,
        "nav_per_unit": nav_per_unit,
        "n_holdings": len(holdings),
        "holdings": holdings,
    }


def fetch_parse(date_ymd=None, timeout=30):
    """Fetch and normalize in one call. Returns None for non-trading days."""
    return parse(fetch(date_ymd, timeout=timeout))


if __name__ == "__main__":
    import sys
    arg = sys.argv[1] if len(sys.argv) > 1 else None
    out = fetch_parse(arg)
    print(json.dumps(out, ensure_ascii=False, indent=2)[:2000] if out else "No data")
