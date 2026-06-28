"""
復華台灣未來50主動式ETF (00991A) — fetch & parse module.

Dependency-free (stdlib only): urllib + zipfile + re.
Data source (reverse-engineered): the official ETF page's Excel export endpoint
    https://www.fhtrust.com.tw/api/assetsExcel/ETF23/<YYYYMMDD>
returns an xlsx snapshot for any trading day. Non-trading days (weekends,
holidays, pre-inception) return a 12-byte JSON body "查無資料".

Each xlsx contains fund-level metadata (NAV, units outstanding, NAV/unit)
plus the full holdings table: code / name / shares / amount / weight%.
"""

import io
import re
import html
import json
import zipfile
import urllib.request

BASE = "https://www.fhtrust.com.tw/api/assetsExcel/ETF23/"
UA = "Mozilla/5.0 (compatible; etf-00991a-tracker/0.1)"


def fetch(date_yyyymmdd, timeout=30):
    """Return raw xlsx bytes for a date, or None if no data for that day."""
    url = BASE + date_yyyymmdd
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        data = r.read()
    # xlsx files start with the ZIP magic "PK"; "查無資料" JSON does not.
    if data[:2] != b"PK":
        return None
    return data


# ---- xlsx parsing (no openpyxl needed) -------------------------------------

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
    """Map column letter -> string value for one <row>."""
    cells = {}
    for c in re.findall(r"<(?:x:)?c\b[^>]*?(?:/>|>.*?</(?:x:)?c>)", rowxml, re.S):
        mref = re.search(r'r="([A-Z]+)\d+"', c)
        if not mref:
            continue
        col = mref.group(1)
        t = re.search(r't="([^"]*)"', c)
        inline = re.search(r"<(?:x:)?is>.*?<(?:x:)?t[^>]*>(.*?)</(?:x:)?t>", c, re.S)
        v = re.search(r"<(?:x:)?v>(.*?)</(?:x:)?v>", c, re.S)
        if inline:
            val = html.unescape(inline.group(1))
        elif v:
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
    if s is None:
        return None
    s = s.replace(",", "").strip()
    return int(float(s)) if s not in ("", "-") else None


def _to_pct(s):
    if not s:
        return None
    return round(float(s.replace("%", "").replace(",", "").strip()), 6)


def parse(xlsx_bytes):
    """Parse one xlsx snapshot into a normalized dict."""
    z = zipfile.ZipFile(io.BytesIO(xlsx_bytes))
    ss = _shared_strings(z)
    sheet = z.read("xl/worksheets/sheet1.xml").decode("utf-8", "ignore")

    rows = {}
    for rnum, rowxml in re.findall(
        r'<(?:x:)?row r="(\d+)"[^>]*>(.*?)</(?:x:)?row>', sheet, re.S
    ):
        rows[int(rnum)] = _cells_by_col(rowxml, ss)

    # --- fund-level metadata ---
    meta = {"date": None, "nav_total": None, "units": None, "nav_per_unit": None}
    label_to_key = {
        "基金資產淨值": "nav_total",
        "基金在外流通單位數": "units",
        "基金每單位淨值": "nav_per_unit",
    }
    header_row = None
    cols = {}
    for rnum in sorted(rows):
        a = rows[rnum].get("A", "")
        m = re.search(r"日期[:：]\s*(\d{4}/\d{2}/\d{2})", a)
        if m:
            meta["date"] = m.group(1).replace("/", "-")
        if a in label_to_key:  # value sits in column A of the next row
            nxt = rows.get(rnum + 1, {}).get("A", "")
            key = label_to_key[a]
            meta[key] = _to_int(nxt) if key != "nav_per_unit" else float(nxt or 0) or None
        if "證券代號" in rows[rnum].values():
            header_row = rnum
            for col, label in rows[rnum].items():
                cols[label] = col

    # --- holdings table ---
    holdings = []
    if header_row is not None:
        c_code = cols.get("證券代號")
        c_name = cols.get("證券名稱")
        c_sh = cols.get("股數")
        c_amt = cols.get("金額")
        c_wt = cols.get("權重(%)")
        for rnum in sorted(rows):
            if rnum <= header_row:
                continue
            row = rows[rnum]
            code = row.get(c_code, "")
            if not code:
                continue
            holdings.append(
                {
                    "code": code,
                    "name": row.get(c_name, ""),
                    "shares": _to_int(row.get(c_sh)),
                    "amount": _to_int(row.get(c_amt)),
                    "weight": _to_pct(row.get(c_wt)),
                }
            )
    return {**meta, "n_holdings": len(holdings), "holdings": holdings}


def fetch_parse(date_yyyymmdd, timeout=30):
    raw = fetch(date_yyyymmdd, timeout=timeout)
    if raw is None:
        return None
    return parse(raw)


if __name__ == "__main__":
    import sys

    out = fetch_parse(sys.argv[1])
    print(json.dumps(out, ensure_ascii=False, indent=2)[:1500])
