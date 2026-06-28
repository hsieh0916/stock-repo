"""
主動群益台灣強棒 ETF (00982A) — fetch & parse module.

Uses capitalfund.com.tw /CFWeb/api/etf/buyback JSON endpoint.
Supports historical date lookups via {"fundId": "399", "date": "YYYY-MM-DD"}.
Data available from 2025-05-22 (listing date).

Dependency-free (stdlib only): urllib + json.
"""

import json
import urllib.request
from datetime import date as _date

FUND_ID = "399"
BUYBACK_URL = "https://www.capitalfund.com.tw/CFWeb/api/etf/buyback"
UA = "Mozilla/5.0 (compatible; etf-00982a-tracker/0.1)"


def _fetch_raw(date_ymd=None, timeout=30):
    """Fetch raw buyback JSON for a date (YYYY-MM-DD) or latest if None."""
    body = {"fundId": FUND_ID}
    if date_ymd:
        body["date"] = date_ymd
    data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(
        BUYBACK_URL,
        data=data,
        headers={
            "User-Agent": UA,
            "Content-Type": "application/json",
            "Referer": "https://www.capitalfund.com.tw/",
        },
    )
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read())


def fetch_parse(date_ymd=None, timeout=30):
    """
    Fetch and normalize Capital Fund 00982A PCF data.

    Returns a snapshot dict or None if no data for that date.
    Snapshot format:
      date, nav_total (NT$), units, nav_per_unit (NT$/unit),
      n_holdings, holdings[{code, name, shares, amount, weight}]
    """
    raw = _fetch_raw(date_ymd, timeout=timeout)

    data = raw.get("data") or {}
    pcf = data.get("pcf") or {}
    stocks = data.get("stocks") or []

    date_str = pcf.get("date2")  # "YYYY-MM-DD"
    if not date_str or not stocks:
        return None

    nav_total = int(pcf.get("nav") or 0)
    units = int(pcf.get("totUnit") or 0)
    nav_per_unit = float(pcf.get("pUnit") or 0)

    if nav_total <= 0 or not units:
        return None

    holdings = []
    for s in stocks:
        code = (s.get("stocNo") or "").strip()
        name = (s.get("stocName") or "").strip().rstrip("*")
        shares = int(s.get("share") or 0)
        weight = float(s.get("weight") or 0)
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
