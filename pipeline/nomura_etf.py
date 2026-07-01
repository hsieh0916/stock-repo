"""
主動野村臺灣優選 ETF (00980A) — fetch & parse module.

Uses nomurafunds.com.tw /API/ETFAPI/api/Fund/GetFundTradeInfo endpoint.
Requires a two-step call: GetFundTradeInfoDate → GetFundTradeInfo.
Historical data available from 2025-05-05 (listing date).

Dependency-free (stdlib only): urllib + json.
"""

import json
import urllib.request

FUND_NO = "00980A"
API_BASE = "https://www.nomurafunds.com.tw/API/ETFAPI/api"
UA = "Mozilla/5.0 (compatible; etf-00980a-tracker/0.1)"
_HEADERS = {
    "User-Agent": UA,
    "Content-Type": "application/json",
    "Referer": "https://www.nomurafunds.com.tw/ETFWEB/pcf",
}


def _post(path, body, timeout):
    data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(
        f"{API_BASE}/{path}",
        data=data,
        headers=_HEADERS,
    )
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read())


def _latest_date(timeout=15):
    """Return the latest available PCF date as 'YYYY/MM/DD'."""
    resp = _post(
        "Fund/GetFundTradeInfoDate",
        {"FundNo": FUND_NO, "Type": 1},
        timeout,
    )
    return (resp.get("Entries") or {}).get("LatestDate")


def _date_ymd_to_api(date_ymd):
    """Convert 'YYYY-MM-DD' to 'YYYY/MM/DD' for the Nomura API."""
    return date_ymd.replace("-", "/")


def fetch_parse(date_ymd=None, timeout=30):
    """
    Fetch and normalize Nomura 00980A PCF data.

    date_ymd: 'YYYY-MM-DD' or None for latest available date.
    Returns snapshot dict or None if no data.

    Snapshot format:
      date, nav_total (NT$), units, nav_per_unit (NT$/unit),
      n_holdings, holdings[{code, name, shares, amount, weight}]
    """
    if date_ymd:
        api_date = _date_ymd_to_api(date_ymd)
    else:
        api_date = _latest_date(timeout=timeout // 2)
        if not api_date:
            return None

    resp = _post(
        "Fund/GetFundTradeInfo",
        {"FundNo": FUND_NO, "Type": 1, "Date": api_date},
        timeout,
    )
    d = resp.get("Entries") or {}

    fund_id = d.get("CFundId")
    stocks = d.get("Stocks") or []
    if not fund_id or not stocks:
        return None

    # CNavDt = NAV date shown on official site (T+0); CPcfdate = PCF settlement date (T+1)
    raw_date = d.get("CNavDt") or d.get("CPcfdate") or ""
    date_str = raw_date[:10] if raw_date else None
    if not date_str or date_str.startswith("0001"):
        return None

    nav_total = int(d.get("CAnceTotalAv") or 0)
    units = int(d.get("CAnceTotalIssues") or 0)
    nav_per_unit = float(d.get("CAnceNav") or 0)

    if nav_total <= 0 or not units:
        return None

    holdings = []
    for s in stocks:
        code = (s.get("CStockCode") or "").strip()
        name = (s.get("CStockName") or "").strip()
        shares = int(s.get("CQuantity") or 0)
        weight = float(s.get("CWeightsPct") or 0)
        if not code or shares <= 0:
            continue
        amount = int(weight / 100 * nav_total)
        holdings.append({
            "code": code,
            "name": name,
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


if __name__ == "__main__":
    import sys
    arg = sys.argv[1] if len(sys.argv) > 1 else None
    out = fetch_parse(arg)
    print(json.dumps(out, ensure_ascii=False, indent=2)[:2000] if out else "No data")
