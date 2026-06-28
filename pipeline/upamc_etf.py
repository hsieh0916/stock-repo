"""
主動統一台股增長 ETF (00981A) — fetch & parse module.

Uses ezmoney.com.tw /ETF/Transaction/GetPCF JSON endpoint.
Supports historical date lookups (unlike AssetExcelNPOI which is today-only).
Data available from ~2025-05-27; some days are missing (holidays / publication lag).

Dependency-free (stdlib only): urllib + http.cookiejar + json.
"""

import http.cookiejar
import json
import urllib.request
from datetime import date as _date

FUND_CODE = "49YTW"
PCF_URL = "https://www.ezmoney.com.tw/ETF/Transaction/GetPCF"
UA = "Mozilla/5.0 (compatible; etf-00981a-tracker/0.1)"


def _roc(iso_date: str) -> str:
    """Convert YYYY-MM-DD → ROC year date string 'YY/MM/DD'."""
    y, m, d = iso_date.split("-")
    return f"{int(y) - 1911}/{m}/{d}"


class _PostRedirectHandler(urllib.request.HTTPRedirectHandler):
    """Preserve POST method and body on 307/308 redirects."""

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        new_req = urllib.request.Request(
            newurl,
            data=req.data,
            headers=dict(req.headers),
            method=req.get_method(),
        )
        return new_req


def _opener():
    jar = http.cookiejar.CookieJar()
    return urllib.request.build_opener(
        urllib.request.HTTPCookieProcessor(jar),
        _PostRedirectHandler(),
    )


def fetch(date_ymd=None, timeout=30):
    """
    Fetch raw GetPCF JSON dict for a date (YYYY-MM-DD) or latest if date_ymd is None.
    Returns the parsed JSON dict (not yet normalized).
    """
    if date_ymd:
        roc = _roc(date_ymd)
        specific = True
    else:
        roc = _roc(_date.today().isoformat())
        specific = False

    body = json.dumps(
        {"fundCode": FUND_CODE, "date": roc, "specificDate": specific}
    ).encode("utf-8")

    req = urllib.request.Request(
        PCF_URL,
        data=body,
        headers={
            "User-Agent": UA,
            "Content-Type": "application/json; charset=utf-8",
            "Referer": "https://www.ezmoney.com.tw/ETF/Transaction/PCF",
        },
    )
    with _opener().open(req, timeout=timeout) as r:
        return json.loads(r.read())


def parse(raw):
    """
    Normalize a raw GetPCF response dict into a snapshot dict.
    Returns None for non-trading days (all amounts == 0 or post_date missing).
    """
    pcf_list = raw.get("pcf", [])
    if not pcf_list or all(item.get("Amount", 0) == 0 for item in pcf_list):
        return None

    nav_total = units = nav_per_unit = None
    post_date = None

    for item in pcf_list:
        code = item.get("PCFCode")
        amt = item.get("Amount", 0)
        if code == "NAV":
            nav_total = int(amt)
        elif code == "OUT_UNIT":
            units = int(amt)
        elif code == "P_UNIT":
            nav_per_unit = float(amt)
        pd = item.get("PostDate") or ""
        if "0001" not in pd and not post_date:
            post_date = pd[:10]  # YYYY-MM-DD

    if not post_date:
        return None

    holdings = []
    for a in raw.get("asset", []):
        if a.get("AssetCode") != "ST":
            continue
        for d in a.get("Details") or []:
            code = (d.get("DetailCode") or "").strip()
            if not code:
                continue
            holdings.append(
                {
                    "code": code,
                    "name": (d.get("DetailName") or "").strip().rstrip("*"),
                    "shares": int(d["Share"]) if d.get("Share") is not None else None,
                    "amount": int(d["Amount"]) if d.get("Amount") is not None else None,
                    "weight": round(float(d["NavRate"]), 6) if d.get("NavRate") is not None else None,
                }
            )

    holdings.sort(key=lambda h: -(h.get("weight") or 0))

    return {
        "date": post_date,
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
