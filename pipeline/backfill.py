"""
Backfill snapshots for all tracked ETFs and build the frontend datasets.

00991A (復華台灣未來50):  historical backfill via fhtrust.com.tw (date parameter)
00981A (主動統一台股增長): today-only fetch via ezmoney.com.tw (no history endpoint)
"""

import datetime
import json
import os
import time
import urllib.error

import fhetf
import upamc_etf

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SNAP_DIR = os.path.join(ROOT, "data", "snapshots")
SNAP_DIR_00981A = os.path.join(ROOT, "data", "snapshots", "00981A")
PUB_DIR = os.path.join(ROOT, "data", "public")
WEB_PUB_DIR = os.path.join(ROOT, "web", "public")

START = datetime.date(2025, 12, 8)       # 00991A inception ~2025-12-09
START_00981A = datetime.date(2025, 5, 27)  # 00981A first PCF date (listed 2025-05-15)
END = datetime.date.today()


def daterange(a, b):
    d = a
    while d <= b:
        if d.weekday() < 5:
            yield d
        d += datetime.timedelta(days=1)


def backfill():
    """Fetch any missing 00991A trading days up to today. Returns error count."""
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
        except Exception as e:
            time.sleep(1.0)
            try:
                snap = fhetf.fetch_parse(ymd)
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
        time.sleep(0.2)
    print(f"00991A backfill: {got} days saved, {empty} non-trading skipped, {errs} errors")
    return errs


def backfill_00981a():
    """Fetch all missing 00981A trading days from inception to today. Returns error count."""
    os.makedirs(SNAP_DIR_00981A, exist_ok=True)
    got, empty, errs = 0, 0, 0
    for d in daterange(START_00981A, END):
        out_path = os.path.join(SNAP_DIR_00981A, f"{d.isoformat()}.json")
        if os.path.exists(out_path):
            got += 1
            continue
        try:
            snap = upamc_etf.fetch_parse(d.isoformat())
        except Exception as e:
            time.sleep(1.0)
            try:
                snap = upamc_etf.fetch_parse(d.isoformat())
            except Exception as e2:
                print(f"  00981A ERR {d}: {e2}")
                errs += 1
                continue
        if snap is None:
            empty += 1
        else:
            # Use snap['date'] as filename (PostDate from API, may differ from requested date)
            actual_date = snap.get("date", d.isoformat())
            actual_path = os.path.join(SNAP_DIR_00981A, f"{actual_date}.json")
            if not os.path.exists(actual_path):
                with open(actual_path, "w", encoding="utf-8") as f:
                    json.dump(snap, f, ensure_ascii=False)
            got += 1
        time.sleep(0.3)
    print(f"00981A backfill: {got} days saved, {empty} non-trading skipped, {errs} errors")
    return errs


def _build_one_dataset(snap_dir, fund_code, fund_name, out_filename):
    snaps = {}
    for fn in sorted(os.listdir(snap_dir)):
        if not fn.endswith(".json"):
            continue
        with open(os.path.join(snap_dir, fn), encoding="utf-8") as f:
            s = json.load(f)
        if s and s.get("date"):
            snaps[s["date"]] = s

    if not snaps:
        print(f"{fund_code}: no snapshots found, skipping dataset build")
        return None

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
        "fund": {"code": fund_code, "name": fund_name},
        "generated_dates": {"first": dates[0], "last": dates[-1], "count": len(dates)},
        "columns": ["code", "shares", "amount", "weight"],
        "securities": securities,
        "fund_series": fund_series,
        "holdings_by_date": holdings_by_date,
    }
    payload = json.dumps(dataset, ensure_ascii=False, separators=(",", ":"))
    out = os.path.join(PUB_DIR, out_filename)
    with open(out, "w", encoding="utf-8") as f:
        f.write(payload)
    if os.path.isdir(WEB_PUB_DIR):
        with open(os.path.join(WEB_PUB_DIR, out_filename), "w", encoding="utf-8") as f:
            f.write(payload)
    print(f"{fund_code} {out_filename}: {len(dates)} days, {len(securities)} securities, {len(payload)/1024:.0f} KB")
    return dataset


def build_dataset():
    return _build_one_dataset(
        SNAP_DIR, "00991A", "復華台灣未來50主動式ETF", "dataset.json"
    )


def build_dataset_00981a():
    return _build_one_dataset(
        SNAP_DIR_00981A, "00981A", "主動統一台股增長ETF", "dataset_00981A.json"
    )


if __name__ == "__main__":
    backfill()
    build_dataset()
    backfill_00981a()
    build_dataset_00981a()
