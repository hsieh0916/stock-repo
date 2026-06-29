"""統一全球創新主動式ETF (00988A) — fetch & parse module.

Uses ezmoney.com.tw /ETF/Transaction/GetPCF JSON endpoint (same as 00981A).
Fund code: 61YTW. Data available from 2025-11-05.

Publication schedule: T+2 trading days (global ETFs settle T+2).
PostDate in response = publication date = snapshot date used here.
PostDate field is in .NET /Date(ms)/ timestamp format (UTC).
"""

import datetime
import http.cookiejar
import json
import re
import urllib.request

FUND_CODE = "61YTW"
PCF_URL = "https://www.ezmoney.com.tw/ETF/Transaction/GetPCF"
UA = "Mozilla/5.0 (compatible; etf-00988a-tracker/0.1)"


def _roc(iso_date: str) -> str:
    y, m, d = iso_date.split("-")
    return f"{int(y) - 1911}/{m}/{d}"


def _parse_net_date(s) -> str | None:
    """Parse /Date(ms)/ or YYYY-MM-DD → 'YYYY-MM-DD', or None."""
    if not s:
        return None
    m = re.match(r"/Date\((\d+)", str(s))
    if m:
        ts = int(m.group(1)) // 1000
        return datetime.datetime.fromtimestamp(ts, tz=datetime.timezone.utc).strftime("%Y-%m-%d")
    if re.match(r"\d{4}-\d{2}-\d{2}", str(s)):
        return str(s)[:10]
    return None


class _PostRedirectHandler(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return urllib.request.Request(
            newurl, data=req.data, headers=dict(req.headers), method=req.get_method()
        )


def _opener():
    jar = http.cookiejar.CookieJar()
    return urllib.request.build_opener(
        urllib.request.HTTPCookieProcessor(jar), _PostRedirectHandler()
    )


def fetch(date_ymd=None, timeout=30):
    if date_ymd:
        roc = _roc(date_ymd)
        specific = True
    else:
        roc = _roc(datetime.date.today().isoformat())
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
        if not post_date:
            pd = _parse_net_date(item.get("PostDate"))
            if pd and not pd.startswith("0001"):
                post_date = pd

    if not post_date or not nav_total:
        return None

    holdings = []
    for a in raw.get("asset", []):
        for d in a.get("Details") or []:
            code = (d.get("DetailCode") or "").strip()
            if not code:
                continue
            weight = round(float(d["NavRate"]), 6) if d.get("NavRate") is not None else 0.0
            shares = int(d["Share"]) if d.get("Share") is not None else 0
            amount = int(weight / 100 * nav_total)
            holdings.append({
                "code": code,
                "name": (d.get("DetailName") or "").strip().rstrip("*"),
                "shares": shares,
                "amount": amount,
                "weight": weight,
            })

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
