"""
Backfill snapshots for all tracked ETFs and build the frontend datasets.

00991A (復華台灣未來50):  historical backfill via fhtrust.com.tw (date parameter)
00981A (主動統一台股增長): historical backfill via ezmoney.com.tw
00982A (主動群益台灣強棒): historical backfill via capitalfund.com.tw
00980A (主動野村臺灣優選): historical backfill via nomurafunds.com.tw
00988A (統一全球創新):   historical backfill via ezmoney.com.tw (global fund, T+2 publish)
00990A (元大全球AI新經濟): historical backfill via yuantaetfs.com
"""

import datetime
import json
import os
import time
import urllib.error

import capital_etf
import fhetf
import fsitc_etf
import nomura_etf
import upamc_etf
import upamc_global_etf
import yuanta_etf

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SNAP_DIR = os.path.join(ROOT, "data", "snapshots")
SNAP_DIR_00981A = os.path.join(ROOT, "data", "snapshots", "00981A")
SNAP_DIR_00982A = os.path.join(ROOT, "data", "snapshots", "00982A")
SNAP_DIR_00980A = os.path.join(ROOT, "data", "snapshots", "00980A")
SNAP_DIR_00988A = os.path.join(ROOT, "data", "snapshots", "00988A")
SNAP_DIR_00990A = os.path.join(ROOT, "data", "snapshots", "00990A")
SNAP_DIR_00994A = os.path.join(ROOT, "data", "snapshots", "00994A")
PUB_DIR = os.path.join(ROOT, "data", "public")
WEB_PUB_DIR = os.path.join(ROOT, "web", "public")

START = datetime.date(2025, 12, 8)        # 00991A inception ~2025-12-09
START_00981A = datetime.date(2025, 5, 27)  # 00981A first PCF date (listed 2025-05-15)
START_00982A = datetime.date(2025, 5, 22)  # 00982A listing date
START_00980A = datetime.date(2025, 5, 5)   # 00980A listing date
START_00988A = datetime.date(2025, 11, 1)  # 00988A first PCF ~2025-11-05 (T+2 publish)
START_00990A = datetime.date(2026, 1, 2)   # 00990A first available date
START_00994A = datetime.date(2026, 1, 7)   # 00994A listing date
END = datetime.date.today()
RECENT_CUTOFF = END - datetime.timedelta(days=7)  # re-fetch & compare within this window


def _snap_changed(path, snap):
    """Return True if snap differs from saved file (or file missing).
    Compares nav_total and nav_per_unit to detect official-site corrections."""
    if not os.path.exists(path):
        return True
    try:
        with open(path, encoding="utf-8") as f:
            old = json.load(f)
        return (old.get("nav_total") != snap.get("nav_total") or
                old.get("nav_per_unit") != snap.get("nav_per_unit"))
    except Exception:
        return True


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
    got, updated, empty, errs = 0, 0, 0, 0
    for d in daterange(START, END):
        ymd = d.strftime("%Y%m%d")
        out_path = os.path.join(SNAP_DIR, f"{d.isoformat()}.json")
        if os.path.exists(out_path) and d < RECENT_CUTOFF:
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
            if _snap_changed(out_path, snap):
                with open(out_path, "w", encoding="utf-8") as f:
                    json.dump(snap, f, ensure_ascii=False)
                updated += 1
            got += 1
        time.sleep(0.2)
    print(f"00991A backfill: {got} days saved/checked, {updated} updated, {empty} non-trading skipped, {errs} errors")
    return errs


def backfill_00981a():
    """Fetch all missing 00981A trading days from inception to today. Returns error count."""
    os.makedirs(SNAP_DIR_00981A, exist_ok=True)
    got, updated, empty, errs = 0, 0, 0, 0
    for d in daterange(START_00981A, END):
        out_path = os.path.join(SNAP_DIR_00981A, f"{d.isoformat()}.json")
        if os.path.exists(out_path) and d < RECENT_CUTOFF:
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
            if _snap_changed(actual_path, snap):
                with open(actual_path, "w", encoding="utf-8") as f:
                    json.dump(snap, f, ensure_ascii=False)
                updated += 1
            got += 1
        time.sleep(0.3)
    print(f"00981A backfill: {got} days saved/checked, {updated} updated, {empty} non-trading skipped, {errs} errors")
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
            sh = h["shares"]
            # amount col = NT$/share (每股金額): weight×NAV÷張數÷1000
            per_share = round(h["amount"] / sh, 2) if sh else 0.0
            rows.append([h["code"], sh, per_share, h["weight"]])
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


def write_last_updated():
    """Write last_updated.json with current UTC timestamp to both public dirs."""
    payload = json.dumps({"at": datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")},
                         separators=(",", ":"))
    for d in (PUB_DIR, WEB_PUB_DIR):
        if os.path.isdir(d):
            with open(os.path.join(d, "last_updated.json"), "w", encoding="utf-8") as f:
                f.write(payload)
    print(f"last_updated: {payload}")


def build_dataset():
    return _build_one_dataset(
        SNAP_DIR, "00991A", "復華台灣未來50主動式ETF", "dataset.json"
    )


def build_dataset_00981a():
    return _build_one_dataset(
        SNAP_DIR_00981A, "00981A", "主動統一台股增長ETF", "dataset_00981A.json"
    )


def backfill_00982a():
    """Fetch all missing 00982A trading days from inception to today. Returns error count."""
    os.makedirs(SNAP_DIR_00982A, exist_ok=True)
    got, updated, empty, errs = 0, 0, 0, 0
    for d in daterange(START_00982A, END):
        out_path = os.path.join(SNAP_DIR_00982A, f"{d.isoformat()}.json")
        if os.path.exists(out_path) and d < RECENT_CUTOFF:
            got += 1
            continue
        try:
            snap = capital_etf.fetch_parse(d.isoformat())
        except Exception as e:
            time.sleep(1.0)
            try:
                snap = capital_etf.fetch_parse(d.isoformat())
            except Exception as e2:
                print(f"  00982A ERR {d}: {e2}")
                errs += 1
                continue
        if snap is None:
            empty += 1
        else:
            actual_date = snap.get("date", d.isoformat())
            actual_path = os.path.join(SNAP_DIR_00982A, f"{actual_date}.json")
            if _snap_changed(actual_path, snap):
                with open(actual_path, "w", encoding="utf-8") as f:
                    json.dump(snap, f, ensure_ascii=False)
                updated += 1
            got += 1
        time.sleep(0.3)
    # Also fetch latest (no-date) to capture today's same-day PCF (avoids T+1 lag)
    try:
        snap = capital_etf.fetch_parse(None)
        if snap:
            actual_date = snap.get("date")
            actual_path = os.path.join(SNAP_DIR_00982A, f"{actual_date}.json")
            if _snap_changed(actual_path, snap):
                with open(actual_path, "w", encoding="utf-8") as f:
                    json.dump(snap, f, ensure_ascii=False)
                updated += 1
    except Exception as e:
        print(f"  00982A latest fetch failed: {e}")
    print(f"00982A backfill: {got} days saved/checked, {updated} updated, {empty} non-trading skipped, {errs} errors")
    return errs


def build_dataset_00982a():
    return _build_one_dataset(
        SNAP_DIR_00982A, "00982A", "主動群益台灣強棒ETF", "dataset_00982A.json"
    )


def backfill_00980a():
    """Fetch all missing 00980A trading days from inception to today. Returns error count."""
    os.makedirs(SNAP_DIR_00980A, exist_ok=True)
    got, updated, empty, errs = 0, 0, 0, 0
    for d in daterange(START_00980A, END):
        out_path = os.path.join(SNAP_DIR_00980A, f"{d.isoformat()}.json")
        if os.path.exists(out_path) and d < RECENT_CUTOFF:
            got += 1
            continue
        try:
            snap = nomura_etf.fetch_parse(d.isoformat())
        except Exception as e:
            time.sleep(1.0)
            try:
                snap = nomura_etf.fetch_parse(d.isoformat())
            except Exception as e2:
                print(f"  00980A ERR {d}: {e2}")
                errs += 1
                continue
        if snap is None:
            empty += 1
        else:
            actual_date = snap.get("date", d.isoformat())
            actual_path = os.path.join(SNAP_DIR_00980A, f"{actual_date}.json")
            if _snap_changed(actual_path, snap):
                with open(actual_path, "w", encoding="utf-8") as f:
                    json.dump(snap, f, ensure_ascii=False)
                updated += 1
            got += 1
        time.sleep(0.3)
    print(f"00980A backfill: {got} days saved/checked, {updated} updated, {empty} non-trading skipped, {errs} errors")
    return errs


def build_dataset_00980a():
    return _build_one_dataset(
        SNAP_DIR_00980A, "00980A", "主動野村臺灣優選ETF", "dataset_00980A.json"
    )


def backfill_00988a():
    """Fetch all missing 00988A days from inception to today. Returns error count.

    PostDate from API = publication date (T+2 trading). Consecutive requested
    dates may return the same PostDate; the file-exists check skips duplicates.
    """
    os.makedirs(SNAP_DIR_00988A, exist_ok=True)
    got, empty, errs = 0, 0, 0
    for d in daterange(START_00988A, END):
        try:
            snap = upamc_global_etf.fetch_parse(d.isoformat())
        except Exception as e:
            time.sleep(1.0)
            try:
                snap = upamc_global_etf.fetch_parse(d.isoformat())
            except Exception as e2:
                print(f"  00988A ERR {d}: {e2}")
                errs += 1
                continue
        if snap is None:
            empty += 1
        else:
            actual_date = snap.get("date", d.isoformat())
            actual_path = os.path.join(SNAP_DIR_00988A, f"{actual_date}.json")
            if _snap_changed(actual_path, snap):
                with open(actual_path, "w", encoding="utf-8") as f:
                    json.dump(snap, f, ensure_ascii=False)
                got += 1
            else:
                got += 1
        time.sleep(0.3)
    print(f"00988A backfill: {got} saved/dedup, {empty} non-trading skipped, {errs} errors")
    return errs


def build_dataset_00988a():
    return _build_one_dataset(
        SNAP_DIR_00988A, "00988A", "統一全球創新主動式ETF", "dataset_00988A.json"
    )


def backfill_00990a():
    """Fetch all missing 00990A trading days from inception to today. Returns error count."""
    os.makedirs(SNAP_DIR_00990A, exist_ok=True)
    got, updated, empty, errs = 0, 0, 0, 0
    for d in daterange(START_00990A, END):
        actual_path = os.path.join(SNAP_DIR_00990A, f"{d.isoformat()}.json")
        if os.path.exists(actual_path) and d < RECENT_CUTOFF:
            got += 1
            continue
        try:
            snap = yuanta_etf.fetch_parse(d.isoformat())
        except Exception as e:
            time.sleep(1.0)
            try:
                snap = yuanta_etf.fetch_parse(d.isoformat())
            except Exception as e2:
                print(f"  00990A ERR {d}: {e2}")
                errs += 1
                continue
        if snap is None:
            empty += 1
        else:
            if _snap_changed(actual_path, snap):
                with open(actual_path, "w", encoding="utf-8") as f:
                    json.dump(snap, f, ensure_ascii=False)
                updated += 1
            got += 1
        time.sleep(0.3)
    print(f"00990A backfill: {got} days saved/checked, {updated} updated, {empty} non-trading skipped, {errs} errors")
    return errs


def build_dataset_00990a():
    return _build_one_dataset(
        SNAP_DIR_00990A, "00990A", "元大全球AI新經濟主動式ETF", "dataset_00990A.json"
    )


def backfill_00994a():
    """Fetch all missing 00994A trading days from inception to today. Returns error count.

    fsitc API convention: requesting publication date d returns holdings for d-1 (T+0).
    We iterate d from START+1 to END (publication dates), capturing d-1 data each time,
    then also fetch the latest (None) to capture today's data after market close.
    """
    os.makedirs(SNAP_DIR_00994A, exist_ok=True)
    got, updated, empty, errs = 0, 0, 0, 0
    # Iterate publication dates from START+1 to END (weekdays)
    pub_start = START_00994A + datetime.timedelta(days=1)
    for d in daterange(pub_start, END):
        # Approximate actual data date = d-1 (may be off by holiday, corrected after fetch)
        approx_actual = d - datetime.timedelta(days=1)
        approx_path = os.path.join(SNAP_DIR_00994A, f"{approx_actual.isoformat()}.json")
        if os.path.exists(approx_path) and approx_actual < RECENT_CUTOFF:
            got += 1
            continue
        try:
            snap = fsitc_etf.fetch_parse(d.isoformat())
        except Exception as e:
            time.sleep(1.0)
            try:
                snap = fsitc_etf.fetch_parse(d.isoformat())
            except Exception as e2:
                print(f"  00994A ERR {d}: {e2}")
                errs += 1
                continue
        if snap is None:
            empty += 1
        else:
            actual_date = snap.get("date", approx_actual.isoformat())
            actual_path = os.path.join(SNAP_DIR_00994A, f"{actual_date}.json")
            if _snap_changed(actual_path, snap):
                with open(actual_path, "w", encoding="utf-8") as f:
                    json.dump(snap, f, ensure_ascii=False)
                updated += 1
            got += 1
        time.sleep(0.3)
    # Also fetch latest to capture today's data after market close
    try:
        snap = fsitc_etf.fetch_parse(None)
        if snap:
            actual_date = snap.get("date")
            actual_path = os.path.join(SNAP_DIR_00994A, f"{actual_date}.json")
            if _snap_changed(actual_path, snap):
                with open(actual_path, "w", encoding="utf-8") as f:
                    json.dump(snap, f, ensure_ascii=False)
                updated += 1
                got += 1
    except Exception as e:
        print(f"  00994A latest fetch failed: {e}")
    print(f"00994A backfill: {got} days saved/checked, {updated} updated, {empty} non-trading skipped, {errs} errors")
    return errs


def build_dataset_00994a():
    return _build_one_dataset(
        SNAP_DIR_00994A, "00994A", "主動第一金台股趨勢優選ETF", "dataset_00994A.json"
    )


if __name__ == "__main__":
    backfill()
    build_dataset()
    backfill_00981a()
    build_dataset_00981a()
    backfill_00982a()
    build_dataset_00982a()
    backfill_00980a()
    build_dataset_00980a()
    backfill_00988a()
    build_dataset_00988a()
    backfill_00990a()
    build_dataset_00990a()
    backfill_00994a()
    build_dataset_00994a()
