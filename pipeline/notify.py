"""
Phase 3 — daily email alert for 00991A holdings changes.

Reads data/public/dataset.json (produced by backfill.build_dataset), computes the
latest trading-day diff, filters to the watchlist + threshold, renders an HTML
email and either sends it (Resend / SendGrid) or, in dry-run, writes the rendered
email to data/public/last_alert.html for local inspection.

Zero third-party deps: uses urllib for the provider HTTP APIs.
Secrets come from env vars (set as GitHub Secrets in CI):
  RESEND_API_KEY   — for provider "resend"
  SENDGRID_API_KEY — for provider "sendgrid"
"""

import os
import sys
import json
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DATASET = os.path.join(ROOT, "data", "public", "dataset.json")
CONFIG = os.path.join(HERE, "watchlist.json")
DRY_OUT = os.path.join(ROOT, "data", "public", "last_alert.html")

TAG_LABEL = {"new": "🆕 新進", "exit": "🚫 出清", "up": "▲ 增持", "down": "▼ 減持"}


def load_json(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def holdings_map(ds, date):
    # columns: code, shares, amount, weight
    return {r[0]: r for r in ds["holdings_by_date"].get(date, [])}


def compute_alerts(ds, cfg):
    dates = [d["date"] for d in ds["fund_series"]]
    if len(dates) < 2:
        return None, None, None, []
    base, cur = dates[-2], dates[-1]
    th = int(cfg.get("threshold_shares", 10000))
    mode = cfg.get("mode", "all")
    watch = set(cfg.get("codes", []))
    bm, cm = holdings_map(ds, base), holdings_map(ds, cur)
    names = ds["securities"]
    alerts = []
    for code in set(bm) | set(cm):
        if mode == "watch" and code not in watch:
            continue
        sh = cm[code][1] if code in cm else 0
        psh = bm[code][1] if code in bm else 0
        d = sh - psh
        if abs(d) < th:
            continue
        if code not in bm and code in cm:
            tag = "new"
        elif code in bm and code not in cm:
            tag = "exit"
        else:
            tag = "up" if d > 0 else "down"
        w = cm[code][3] if code in cm else 0.0
        alerts.append(
            {"code": code, "name": names.get(code, code), "shares": sh,
             "dShares": d, "dLots": d / 1000, "weight": w, "tag": tag}
        )
    alerts.sort(key=lambda a: -abs(a["dShares"]))
    return base, cur, th, alerts


def render_html(base, cur, th, alerts):
    rows = ""
    for a in alerts:
        color = "#e11d48" if a["dShares"] > 0 else "#059669"
        rows += (
            f"<tr>"
            f"<td style='padding:6px 10px;font-family:monospace;color:#6b7280'>{a['code']}</td>"
            f"<td style='padding:6px 10px'>{a['name']}</td>"
            f"<td style='padding:6px 10px'>{TAG_LABEL[a['tag']]}</td>"
            f"<td style='padding:6px 10px;text-align:right'>{a['shares']:,}</td>"
            f"<td style='padding:6px 10px;text-align:right;color:{color}'>{a['dShares']:+,}</td>"
            f"<td style='padding:6px 10px;text-align:right;color:{color}'>{a['dLots']:+,.0f}</td>"
            f"<td style='padding:6px 10px;text-align:right'>{a['weight']:.2f}%</td>"
            f"</tr>"
        )
    return f"""<div style="font-family:system-ui,'Noto Sans TC',sans-serif;max-width:720px">
  <h2 style="margin:0 0 4px">00991A 復華台灣未來50主動式ETF — 持股異動</h2>
  <p style="color:#6b7280;margin:0 0 12px">{base} → {cur}　門檻 |Δ股數| ≥ {th:,} 股（{th//1000} 張）　共 {len(alerts)} 檔</p>
  <table style="border-collapse:collapse;width:100%;font-size:14px">
    <thead><tr style="text-align:left;color:#6b7280;border-bottom:1px solid #e5e7eb">
      <th style="padding:6px 10px">代號</th><th style="padding:6px 10px">名稱</th>
      <th style="padding:6px 10px">標記</th><th style="padding:6px 10px;text-align:right">今日股數</th>
      <th style="padding:6px 10px;text-align:right">Δ股數</th><th style="padding:6px 10px;text-align:right">Δ張數</th>
      <th style="padding:6px 10px;text-align:right">權重</th>
    </tr></thead><tbody>{rows}</tbody>
  </table>
  <p style="color:#9ca3af;font-size:12px;margin-top:12px">
    ⚠️ 股數變化未必等於買賣，亦可能來自除權息／減資／股票分割等股本變動。本信僅供研究參考，非投資建議。
  </p>
</div>"""


def send_resend(cfg, subject, html):
    key = os.environ.get("RESEND_API_KEY")
    if not key:
        raise RuntimeError("RESEND_API_KEY not set")
    body = json.dumps({"from": cfg["from"], "to": cfg["recipients"],
                       "subject": subject, "html": html}).encode()
    req = urllib.request.Request(
        "https://api.resend.com/emails", data=body, method="POST",
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.status


def send_sendgrid(cfg, subject, html):
    key = os.environ.get("SENDGRID_API_KEY")
    if not key:
        raise RuntimeError("SENDGRID_API_KEY not set")
    body = json.dumps({
        "personalizations": [{"to": [{"email": e} for e in cfg["recipients"]]}],
        "from": {"email": cfg["from"]},
        "subject": subject,
        "content": [{"type": "text/html", "value": html}],
    }).encode()
    req = urllib.request.Request(
        "https://api.sendgrid.com/v3/mail/send", data=body, method="POST",
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.status


def run(dry_run=False):
    cfg = load_json(CONFIG)
    ds = load_json(DATASET)
    base, cur, th, alerts = compute_alerts(ds, cfg)
    if base is None:
        print("notify: not enough data")
        return
    print(f"notify: {base} -> {cur}, {len(alerts)} alert(s) over threshold {th}")
    if not alerts and not cfg.get("send_when_empty", False):
        print("notify: no alerts, nothing to send")
        return
    subject = f"{cfg.get('subject_prefix', '[00991A]')} {cur}（{len(alerts)} 檔變化）"
    html = render_html(base, cur, th, alerts)

    provider = cfg.get("provider", "resend")
    has_key = os.environ.get("RESEND_API_KEY") or os.environ.get("SENDGRID_API_KEY")
    if dry_run or not has_key:
        with open(DRY_OUT, "w", encoding="utf-8") as f:
            f.write(html)
        print(f"notify: DRY-RUN (no send). rendered → {DRY_OUT}")
        print(f"        subject: {subject}")
        for a in alerts[:10]:
            print(f"        {a['code']} {a['name']} {a['dLots']:+,.0f}張 {TAG_LABEL[a['tag']]}")
        return
    status = send_sendgrid(cfg, subject, html) if provider == "sendgrid" else send_resend(cfg, subject, html)
    print(f"notify: sent via {provider}, status {status}")


if __name__ == "__main__":
    run(dry_run="--dry-run" in sys.argv)
