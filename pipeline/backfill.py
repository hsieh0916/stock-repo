"""
Backfill all available daily snapshots for 00991A and build the frontend dataset.

Iterates weekdays from inception to today, fetches each trading day's xlsx,
saves a normalized per-date snapshot, then assembles a single dataset.json
(fund time-series + per-date holdings) for the static frontend.
"""

import os
import json
import time
import datetime
import urllib.error

import fhetf

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SNAP_DIR = os.path.join(ROOT, "data", "snapshots")
PUB_DIR = os.path.join(ROOT, "data", "public")
WEB_PUB_DIR = os.path.join(ROOT, "web", "public")  # frontend reads dataset.json from here

START = datetime.date(2025, 12, 8)          # inception ~2025-12-09
END = datetime.date.today()                 # incremental: fetch up to today (skips cached days)


def daterange(a, b):
    d = a
    while d <= b:
        if d.weekday() < 5:                  # skip Sat/Sun
            yield d
        d += datetime.timedelta(days=1)


def backfill():
    os.makedirs(SNAP_DIR, exist_ok=True)
    os.makedirs(PUB_DIR, exist_ok=True)
    got, empty, errs = 0, 0, 0
    for d in daterange(START, END):
        ymd = d.strftime("%Y%m%d")
        out_path = os.path.join(SNAP_DIR, f"{d.isoformat()}.json")
        if os.path.exists(out_path):
            got += 1
            continue
        try:
            snap = fhetf.fetch_parse(ymd)
        except (urllib.error.URLError, TimeoutError, OSError) as e:
            time.sleep(1.0)
            try:
                snap = fhetf.fetch_parse(ymd)        # one retry
            except Exception as e2:
                print(f"  ERR {d}: {e2}")
                errs += 1
                continue
        if snap is None:
            empty += 1
        else:
            with open(out_path, "w", encoding="utf-8") as f:
                json.dump(snap, f, ensure_ascii=False)
            got += 1
        time.sleep(0.2)                              # be polite to the server
    print(f"backfill done: {got} trading days saved, {empty} non-trading skipped, {errs} errors")
    return errs


def build_dataset():
    snaps = {}
    for fn in sorted(os.listdir(SNAP_DIR)):
        if not fn.endswith(".json"):
            continue
        with open(os.path.join(SNAP_DIR, fn), encoding="utf-8") as f:
            s = json.load(f)
        if s and s.get("date"):
            snaps[s["date"]] = s

    dates = sorted(snaps)
    securities = {}
    fund_series = []
    holdings_by_date = {}
    for dt in dates:
        s = snaps[dt]
        fund_series.append(
            {
                "date": dt,
                "nav_total": s["nav_total"],
                "units": s["units"],
                "nav_per_unit": s["nav_per_unit"],
                "n_holdings": s["n_holdings"],
            }
        )
        rows = []
        for h in s["holdings"]:
            securities[h["code"]] = h["name"]
            rows.append([h["code"], h["shares"], h["amount"], h["weight"]])
        holdings_by_date[dt] = rows

    dataset = {
        "fund": {"code": "00991A", "name": "復華台灣未來50主動式ETF"},
        "generated_dates": {"first": dates[0], "last": dates[-1], "count": len(dates)},
        "columns": ["code", "shares", "amount", "weight"],
        "securities": securities,
        "fund_series": fund_series,
        "holdings_by_date": holdings_by_date,
    }
    payload = json.dumps(dataset, ensure_ascii=False, separators=(",", ":"))
    out = os.path.join(PUB_DIR, "dataset.json")
    with open(out, "w", encoding="utf-8") as f:
        f.write(payload)
    # also write directly into the frontend so the daily job updates the site in one step
    if os.path.isdir(WEB_PUB_DIR):
        with open(os.path.join(WEB_PUB_DIR, "dataset.json"), "w", encoding="utf-8") as f:
            f.write(payload)
    print(f"dataset.json: {len(dates)} days, {len(securities)} unique securities, {len(payload)/1024:.0f} KB")
    return dataset, snaps, dates


if __name__ == "__main__":
    backfill()
    build_dataset()
