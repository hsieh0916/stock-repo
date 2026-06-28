"""
Daily orchestrator (called by CI): incremental fetch -> rebuild dataset -> notify.

Local dry-run (no email sent, renders data/public/last_alert.html):
    python pipeline/daily.py --dry-run
CI (sends email if RESEND_API_KEY / SENDGRID_API_KEY present):
    python pipeline/daily.py
"""

import os
import sys

import backfill
import notify
import prices
import sectors


def main():
    dry = "--dry-run" in sys.argv
    try:
        errs = backfill.backfill()
    except Exception as e:
        print(f"daily: 00991A backfill failed: {e}")
        errs = 1
    try:
        backfill.build_dataset()
    except Exception as e:
        print(f"daily: 00991A build_dataset failed: {e}")
    try:
        errs += backfill.backfill_00981a()
    except Exception as e:
        print(f"daily: 00981A backfill failed: {e}")
        errs += 1
    try:
        backfill.build_dataset_00981a()
    except Exception as e:
        print(f"daily: 00981A build_dataset failed: {e}")
    try:
        sectors.build()
    except Exception as e:
        print("daily: sectors refresh skipped:", e)
    try:
        prices.build()
    except Exception as e:
        print(f"daily: prices fetch skipped: {e}")
    try:
        notify.run(dry_run=dry)
    except Exception as e:
        print(f"daily: notify skipped: {e}")

    # health signal for CI (does NOT block deploy; a post-deploy job alerts on it)
    failed = errs > 0
    if failed:
        print(f"::error::ETF fetch failed for {errs} error(s); served data may be stale")
    else:
        print("daily: fetch healthy")
    gh_out = os.environ.get("GITHUB_OUTPUT")
    if gh_out:
        with open(gh_out, "a", encoding="utf-8") as f:
            f.write(f"fetch_failed={'1' if failed else '0'}\n")


if __name__ == "__main__":
    main()
