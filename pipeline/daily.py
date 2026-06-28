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
import sectors


def main():
    dry = "--dry-run" in sys.argv
    errs = backfill.backfill()  # fetch any missing trading days up to today
    backfill.build_dataset()    # rebuild dataset.json (+ web/public)
    try:
        sectors.build()         # refresh industry map (non-fatal if source down)
    except Exception as e:
        print("daily: sectors refresh skipped:", e)
    notify.run(dry_run=dry)

    # health signal for CI (does NOT block deploy; a post-deploy job alerts on it)
    failed = errs > 0
    if failed:
        print(f"::error::FH Trust fetch failed for {errs} day(s); served data may be stale")
    else:
        print("daily: fetch healthy")
    gh_out = os.environ.get("GITHUB_OUTPUT")
    if gh_out:
        with open(gh_out, "a", encoding="utf-8") as f:
            f.write(f"fetch_failed={'1' if failed else '0'}\n")


if __name__ == "__main__":
    main()
