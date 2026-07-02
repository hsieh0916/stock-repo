"""主動第一金台股趨勢優選 ETF (00994A) — fetch & parse module.

Uses fsitc.com.tw WebAPI.aspx endpoints (reverse-engineered from FundDetail.aspx).
Fund ID: 182. Data available from 2026-01-07 (listing date).

Publication schedule: T+1 (PCF published next business day after trading).
API date parameter = publication date; response sdate = actual holdings date (T+0).
Weekends / holidays return {"d":""} → parse() returns None.

Dependency-free (stdlib only): urllib + json.
"""

import json
import urllib.request

FUND_ID = "182"
API_BASE = "https://www.fsitc.com.tw/WebAPI.aspx"
UA = "Mozilla/5.0 (compatible; etf-00994a-tracker/0.1)"
_REFERER = "https://www.fsitc.com.tw/FundDetail.aspx?ID=182"


def _post(method: str, body: dict, timeout: int) -> list:
    data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(
        f"{API_BASE}/{method}",
        data=data,
        headers={
            "User-Agent": UA,
            "Content-Type": "application/json; charset=utf-8",
            "Referer": _REFERER,
        },
    )
    with urllib.request.urlopen(req, timeout=timeout) as r:
        resp = json.loads(r.read())
    raw = resp.get("d") or ""
    if not raw:
        return []
    return json.loads(raw)


def fetch_parse(pub_date_ymd=None, timeout=30):
    """Fetch and normalize 00994A PCF data.

    pub_date_ymd: The PUBLICATION date ('YYYY-MM-DD'), which is T+1 from the
                  actual holdings date shown in the returned snapshot's 'date' field.
                  Pass None to get the latest available data.

    Returns a snapshot dict or None for non-trading days.
    """
    pstr = pub_date_ymd or ""
    body = {"pStrFundID": FUND_ID, "pStrDate": pstr}

    # holdings
    hd_items = _post("Get_hd", body, timeout)
    stocks = [x for x in hd_items if x.get("group") == "1" and x.get("A")]
    if not stocks:
        return None

    actual_date = (stocks[0].get("sdate") or "").strip()
    if not actual_date or actual_date.startswith("0001"):
        return None

    # NAV / units
    nav_items = _post("Get_BuySellA", body, timeout)
    nav_total = units = nav_per_unit = None
    for item in nav_items:
        a = item.get("A", "")
        b = (item.get("B") or "").replace(",", "").replace("TWD ", "").replace("USD ", "").strip()
        if not b:
            continue
        if "基金淨資產價值" in a:
            try:
                nav_total = int(float(b))
            except (ValueError, TypeError):
                pass
        elif "每受益權單位淨資產價值" in a and "台幣" in a:
            try:
                nav_per_unit = float(b)
            except (ValueError, TypeError):
                pass
        elif "已發行受益權單位總數" in a and "台幣" in a:
            try:
                units = int(float(b))
            except (ValueError, TypeError):
                pass

    if not nav_total:
        return None

    holdings = []
    for item in stocks:
        code = (item.get("A") or "").strip()
        name = (item.get("B") or "").strip().rstrip("*")
        try:
            weight = round(float((item.get("C") or "0").replace(",", "")), 6)
        except (ValueError, TypeError):
            weight = 0.0
        shares_str = (item.get("D") or "0").replace(",", "").strip()
        try:
            shares = int(shares_str) if shares_str else 0
        except (ValueError, TypeError):
            shares = 0
        if not code:
            continue
        amount = int(weight / 100 * nav_total) if nav_total else 0
        holdings.append({
            "code": code,
            "name": name,
            "shares": shares,
            "amount": amount,
            "weight": weight,
        })

    holdings.sort(key=lambda h: -(h.get("weight") or 0))

    return {
        "date": actual_date,
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
