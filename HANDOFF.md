# 主動ETF持股雷達 — 工程交接文件

> 最後更新：2026-07-05　作者：Claude Sonnet 4.6（協助 hsieh2070@gmail.com）

---

## 一、專案概覽

**目的**：追蹤台灣7支主動式ETF的每日持股變化，提供即時市場價格、折溢價、跨ETF持股比較、集中度分析。

| 項目 | 值 |
|------|-----|
| GitHub Repo | `hsieh0916/stock-repo` |
| GitHub Pages | `https://hsieh0916.github.io/stock-repo/` |
| 前端 | React 18 + TypeScript + Tailwind CSS (Vite) |
| 後端/Pipeline | Python 3.12（標準函式庫，無第三方依賴） |
| 部署 | GitHub Actions → GitHub Pages |
| 排程 | 每週一～五 18:30 & 20:30 台灣時間 |

---

## 二、追蹤的7支ETF

| 代號 | 名稱 | Pipeline 模組 | API 類型 |
|------|------|--------------|---------|
| 00991A | 復華台灣未來50 | `fhetf.py` | FH Trust xlsx 下載 |
| 00981A | 統一台股增長 | `upamc_etf.py` | ezmoney PCF API（T+1偏移） |
| 00982A | 群益台灣強棒 | `capital_etf.py` | Capital Fund API |
| 00980A | 野村臺灣優選 | `nomura_etf.py` | Nomura 兩步 API |
| 00988A | 統一全球創新 | `upamc_global_etf.py` | ezmoney PCF API（T+1偏移） |
| 00990A | 元大全球AI新經濟 | `yuanta_etf.py` | Yuanta PCF API |
| 00994A | 第一金台股趨勢優選 | `fsitc_etf.py` | FSITC API（T+1偏移） |

### T+1 偏移（重要）

部分 API 的行為：**帶日期查詢（如 `2026-07-02`）返回的是前一天（`2026-07-01`）的資料**。

**修正方式**：每個 `backfill_*()` 函式的迴圈結束後，追加一次 **無日期** 的 `fetch_parse(None)` 呼叫，取得當日最新資料。目前 7 個函式全部已修正。

---

## 三、目錄結構

```
stock-repo/
├── pipeline/
│   ├── daily.py            # CI 入口，呼叫所有 backfill + notify
│   ├── backfill.py         # 所有 ETF 的 backfill_*() 與 build_dataset_*()
│   ├── fhetf.py            # 00991A fetch/parse
│   ├── upamc_etf.py        # 00981A fetch/parse
│   ├── capital_etf.py      # 00982A fetch/parse
│   ├── nomura_etf.py       # 00980A fetch/parse（兩步 API）
│   ├── upamc_global_etf.py # 00988A fetch/parse
│   ├── yuanta_etf.py       # 00990A fetch/parse
│   ├── fsitc_etf.py        # 00994A fetch/parse
│   ├── notify.py           # email 通知
│   └── prices.py           # 收盤價抓取 → web/public/prices.json
│
├── data/
│   └── snapshots/
│       ├── YYYY-MM-DD.json          # 00991A 原始快照
│       ├── 00980A/YYYY-MM-DD.json
│       ├── 00981A/YYYY-MM-DD.json
│       ├── 00982A/YYYY-MM-DD.json
│       ├── 00988A/YYYY-MM-DD.json
│       ├── 00990A/YYYY-MM-DD.json
│       └── 00994A/YYYY-MM-DD.json
│
├── web/
│   ├── public/
│   │   ├── dataset.json            # 00991A 前端資料集
│   │   ├── dataset_00981A.json     # ～dataset_00994A.json
│   │   ├── sectors.json            # 產業分類
│   │   ├── prices.json             # 昨日收盤價
│   │   └── last_updated.json       # 最後更新時間（UTC ISO）
│   └── src/
│       ├── components/
│       │   ├── DashboardCards.tsx  # 主要指標卡片（規模、淨值、市場價格…）
│       │   ├── StockDetail.tsx     # 個股詳情 + 七大ETF持股概況
│       │   └── Header.tsx          # ETF切換 + 最後更新時間
│       └── data/
│           ├── analytics.ts        # Dashboard 型別與計算（ma20/60/240、HHI…）
│           ├── useAllEtfWeights.ts # 跨ETF持股查詢（module-level cache）
│           ├── useEtfPrice.ts      # 即時價格（Yahoo Finance → TWSE MIS fallback）
│           ├── useLastUpdated.ts   # 讀 last_updated.json 並轉台灣時間
│           └── usePrices.ts        # 讀 prices.json（收盤價）
│
└── .github/workflows/
    ├── daily.yml       # 18:30 台灣時間，週一～五；push main 也觸發
    └── daily_late.yml  # 20:30 台灣時間，週一～五
```

---

## 四、資料流

```
daily.py
  └─ backfill_*()     ← 各 ETF 模組 fetch_parse(date) + fetch_parse(None)
       └─ snapshots/YYYY-MM-DD.json 存盤（以 snap["date"] 命名，非查詢日期）
  └─ build_dataset_*() ← 讀所有 snapshot → 合併成 dataset_*.json
  └─ prices.build()   ← prices.json
  └─ write_last_updated() ← last_updated.json（UTC ISO 時間戳）
  └─ notify.run()     ← email 通知

GitHub Actions:
  build job → python daily.py → commit data [skip ci] → npm build
  deploy job → actions/deploy-pages@v4
```

---

## 五、GitHub Actions 設定

### 觸發條件

- `daily.yml`：排程 `30 10 * * 1-5`（10:30 UTC = 18:30 台北）、`workflow_dispatch`、`push main`（bot 資料 commit 帶 `[skip ci]` 不觸發）
- `daily_late.yml`：排程 `30 12 * * 1-5`（12:30 UTC = 20:30 台北）、`workflow_dispatch`

### Concurrency 設計

| Group | cancel-in-progress | 用途 |
|-------|--------------------|------|
| `daily-update` | `false` | Pipeline job，讓資料 commit 不被中斷 |
| `github-pages` | `true` | Deploy job，新部署自動取消舊的，防止 Pages queue 卡住 |

> ⚠️ **歷史問題**：2026-07-02 下午多個 run 同時觸發，Pages deployment queue 堆疊，導致 07/02～07/04 所有排程全部失敗（`Deployment failed, try again later`）。已於 2026-07-05 修正為 job-level concurrency。修正後第一次需手動 cancel stuck runs 並重新觸發一次。

---

## 六、前端功能說明

### DashboardCards.tsx

| 卡片 | 資料來源 | 備註 |
|------|---------|------|
| 基金規模 | `nav_total`，日/週/月變化 | |
| 每單位淨值 | `nav_per_unit`，月/季/年線，近期高點 | ma20/60/240，recentHigh = 近240日最高 |
| 市場價格 | Yahoo Finance（每30分鐘），fallback TWSE MIS | 顯示即時/收盤，折溢價，預估淨值外連結 |
| 持股檔數 | `n_holdings`，新進/出清數 | |
| 換手率/集中度 | `turnover`, `top10Weight`, `hhi` | 三指標合併為同一卡片 |

### 預估淨值外連結（INAV_URL）

```
00991A → https://www.fhtrust.com.tw/ETF/etf_data_value
00981A → https://www.ezmoney.com.tw/ETF/Transaction/Estimate?agree=y
00982A → https://www.capitalfund.com.tw/etf
00980A → https://www.nomurafunds.com.tw/ETFWEB/inav
00988A → https://www.ezmoney.com.tw/ETF/Transaction/Estimate?agree=y
00990A → https://www.yuantaetfs.com/tradeInfo/comparison/00990A/NAVhistory
00994A → https://www.fsitc.com.tw/FundDetail.aspx?ID=182
```

### StockDetail.tsx — 七大主動 ETF 持股概況

- `useAllEtfWeights(stockCode)` 取得該股在各 ETF 的權重與當日增減(張)
- Module-level cache（Map）確保每次 session 只 fetch 一次各 dataset
- 當前 ETF 列高亮 `bg-indigo-50`；未持有列呈灰色

---

## 七、本地開發

```bash
# 前端
cd web
npm install
npm run dev        # http://localhost:5173/stock-repo/

# Pipeline（dry-run，不發 email）
cd pipeline
python daily.py --dry-run

# 測試單一 ETF fetch
python -c "import upamc_etf; import json; print(json.dumps(upamc_etf.fetch_parse(), indent=2))"
```

---

## 八、待確認事項

- [ ] 00982A（群益）、00990A（元大）的 INAV 外連結是否正確，待業主確認
- [ ] GitHub Pages 部署在修正後需手動重新觸發一次（取消 stuck run → 觸發 workflow_dispatch）
- [ ] 00988A 的 2026-07-01 & 07-02 快照待下次 CI 執行後補齊

---

## 九、快速除錯

| 症狀 | 可能原因 | 排查方式 |
|------|---------|---------|
| 某 ETF 日期停在昨天 | 迴圈中 `fetch_parse(date)` T+1 偏移，date-less fetch 未寫入 | 確認 `backfill_*()` 末尾有 `fetch_parse(None)` |
| 頁面沒更新 | GitHub Pages deploy queue 卡住 | 查 Actions tab，cancel stuck runs，重跑 |
| 市場價格顯示「收盤」 | Yahoo Finance CORS / 非交易時間 | 正常現象，非交易時段 fallback 到 prices.json |
| `last_updated` 沒更新 | deploy 失敗（資料有更新但 deploy 卡住） | 同「頁面沒更新」 |
| Snapshot `file ≠ snap.date` | 存盤用了查詢日期而非 snap["date"] | 確認存盤時使用 `snap.get("date", d.isoformat())` 當檔名 |
