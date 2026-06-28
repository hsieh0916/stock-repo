"""
主動統一台股增長 ETF (00981A) — fetch & parse module.

Dependency-free (stdlib only): urllib + zipfile + re.
Data source: https://www.ezmoney.com.tw/ETF/Fund/AssetExcelNPOI?fundCode=49YTW
(統一投信 ezmoney.com.tw official site)

Note: This endpoint always returns today's holdings; no date parameter is supported.
Holdings "amount" is estimated as weight% × nav_total (no per-stock amount in source).
"""

import html
import http.cookiejar
import io
import json
import re
import urllib.request
import zipfile

URL = "https://www.ezmoney.com.tw/ETF/Fund/AssetExcelNPOI?fundCode=49YTW"
UA = "Mozilla/5.0 (compatible; etf-00981a-tracker/0.1)"


def fetch(timeout=30):
    """Return raw xlsx bytes, or None if response is not an xlsx."""
    jar = http.cookiejar.CookieJar()
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
    req = urllib.request.Request(
        URL,
        headers={
            "User-Agent": UA,
            "Referer": "https://www.ezmoney.com.tw/ETF/Fund/Info?FundCode=49YTW",
        },
    )
    with opener.open(req, timeout=timeout) as r:
        data = r.read()
    return data if data[:2] == b"PK" else None


def _shared_strings(z):
    try:
        x = z.read("xl/sharedStrings.xml").decode("utf-8", "ignore")
    except KeyError:
        return []
    out = []
    for si in re.findall(r"<(?:x:)?si>(.*?)</(?:x:)?si>", x, re.S):
        parts = re.findall(r"<(?:x:)?t[^>]*>(.*?)</(?:x:)?t>", si, re.S)
        out.append(html.unescape("".join(parts)))
    return out


def _cells_by_col(rowxml, ss):
    cells = {}
    for c in re.findall(r"<c\b[^>]*?(?:/>|>.*?</c>)", rowxml, re.S):
        mref = re.search(r'r="([A-Z]+)\d+"', c)
        if not mref:
            continue
        col = mref.group(1)
        t = re.search(r't="([^"]*)"', c)
        v = re.search(r"<v>(.*?)</v>", c, re.S)
        if v:
            raw = html.unescape(v.group(1))
            if t and t.group(1) == "s" and raw.isdigit() and int(raw) < len(ss):
                val = ss[int(raw)]
            else:
                val = raw
        else:
            val = ""
        cells[col] = val.strip()
    return cells


def _to_int(s):
    if not s:
        return None
    s = s.replace(",", "").replace("NTD", "").strip()
    return int(float(s)) if s not in ("", "-") else None


def _to_float(s):
    if not s:
        return None
    s = s.replace(",", "").replace("NTD", "").strip()
    return float(s) if s not in ("", "-") else None


def _to_pct(s):
    if not s:
        return None
    return round(float(s.replace("%", "").strip()), 6)


def parse(xlsx_bytes):
    """Parse xlsx into normalized dict (same schema as fhetf.parse)."""
    z = zipfile.ZipFile(io.BytesIO(xlsx_bytes))
    ss = _shared_strings(z)
    sheet = z.read("xl/worksheets/sheet1.xml").decode("utf-8", "ignore")

    rows = {}
    for rnum, rowxml in re.findall(r'<row r="(\d+)"[^>]*>(.*?)</row>', sheet, re.S):
        rows[int(rnum)] = _cells_by_col(rowxml, ss)

    date = nav_total = units = nav_per_unit = None
    header_row = None
    for rnum in sorted(rows):
        a = rows[rnum].get("A", "")
        b = rows[rnum].get("B", "")
        # "資料日期：115/06/26" — ROC year needs +1911
        m = re.search(r"資料日期[:：]\s*(\d+)/(\d{2})/(\d{2})", a)
        if m:
            date = f"{int(m.group(1)) + 1911}-{m.group(2)}-{m.group(3)}"
        if a == "淨資產":
            nav_total = _to_int(b)
        elif a == "流通在外單位數":
            units = _to_int(b)
        elif a == "每單位淨值":
            nav_per_unit = _to_float(b)
        if a == "股票代號":
            header_row = rnum

    holdings = []
    if header_row is not None:
        for rnum in sorted(rows):
            if rnum <= header_row:
                continue
            row = rows[rnum]
            code = row.get("A", "")
            if not re.match(r"^\d{4,5}$", code):
                continue
            name = row.get("B", "").rstrip("*")  # some names have trailing asterisk
            shares = _to_int(row.get("C", ""))
            weight = _to_pct(row.get("D", ""))
            # Estimate position value from weight × fund NAV (no per-stock amount in source)
            amount = int(weight / 100 * nav_total) if (weight and nav_total) else None
            holdings.append(
                {
                    "code": code,
                    "name": name,
                    "shares": shares,
                    "amount": amount,
                    "weight": weight,
                }
            )

    return {
        "date": date,
        "nav_total": nav_total,
        "units": units,
        "nav_per_unit": nav_per_unit,
        "n_holdings": len(holdings),
        "holdings": holdings,
    }


def fetch_parse(timeout=30):
    raw = fetch(timeout=timeout)
    if raw is None:
        return None
    return parse(raw)


if __name__ == "__main__":
    out = fetch_parse()
    print(json.dumps(out, ensure_ascii=False, indent=2)[:2000])
