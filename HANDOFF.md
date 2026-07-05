# 主動ETF持股雷達 — 工程交接文件

> 最後更新：2026-07-05　作者：Claude Sonnet 4.6（協助 hsieh2070@gmail.com）
> 2026-07-05 補充查證：Claude Sonnet 5

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
      > 2026-07-05 技術查證：兩連結皆 HTTP 200；`capitalfund.com.tw/etf` 頁面含「00982」「群益台灣強棒」「預估淨值」，`yuantaetfs.com/.../00990A/NAVhistory` 頁面含「00990」「INAV」，皆指向正確頁面。技術面無誤，仍待業主最終簽核後才勾除。
- [x] GitHub Pages 部署在修正後已手動重新觸發（2026-07-05 查證：目前無 stuck/queued run；concurrency 修正 commit `fd10984` 之後，workflow_dispatch（07-04 23:37 UTC）與 push（07-04 23:56 UTC）兩次 run 皆 build+deploy 成功，線上 `last_updated.json` 已對齊最新資料 commit）
- [x] 00988A 的 2026-07-01 & 07-02 快照已補齊（2026-07-05 查證：兩檔案皆存在於 `data/snapshots/00988A/`）
- [ ] 00988A、00990A 的 2026-07-03 快照缺漏 — 已排查為**上游來源尚未發布**，非程式錯誤（詳見九-2）；預期來源補發布後，下次排程會自動回補，無需人工介入

---

## 九、2026-07-05 查證記錄

### 1. CI 中斷時間窗（比原記錄更嚴重）

用 GitHub Actions API（`gh api repos/.../actions/runs?created=...`）直接查證，發現 **2026-07-02T14:17:53Z 到 2026-07-04T16:32:45Z（約50小時）之間完全沒有任何 workflow run 被建立**——不是「觸發後失敗」，是排程本身沒有產生 run 紀錄，比原文件描述的「排程全部失敗」更嚴重。

但同一時間窗內，git log 卻有 3 筆 `github-actions[bot]` 具名的資料 commit（2026-07-03T02:14 / 16:23 / 17:17 UTC），author/committer date 完全一致、找不到對應的 Actions run。研判是前一位工程師在 CI 中斷期間**手動於本機執行 pipeline 並以 bot 身分推送**回補資料，而非真正由 CI 產生。

現況：concurrency 修正（`fd10984`，2026-07-05 00:37 台北時間）之後的所有 run 皆正常，此問題已解決，僅記錄存查，避免日後誤判「CI 有跑只是失敗」。

### 2. 00988A、00990A 的 2026-07-03 快照缺漏 — 根因排查

其餘 5 支 ETF 都在 2026-07-03（週五，交易日）正常產生快照，唯獨 00988A、00990A 沒有。逐項排查：

- 確認 `backfill_00988a()` / `backfill_00990a()` 結尾都已有 `fetch_parse(None)` 的 T+1 補抓修正（程式碼無誤）
- 確認 `RECENT_CUTOFF = END - 7 days`，兩者迴圈對近 7 天內的日期**每次都會強制重抓**，不會因為檔案已存在而跳過 → 回補機制健全
- 直接對 `upamc_global_etf.fetch_parse()` 用多個日期探測，發現該來源對 00988A 有 **T+2 交易日發布延遲**（例：查詢 `2026-07-03` 實際拿到的是 `2026-07-01` 的資料）
- 直接對 `yuanta_etf.fetch_parse('2026-07-03')` 探測，回傳 `None`（無 T+1/T+2 位移，是單純**尚未發布**）
- 實際在本機執行完整的 `backfill_00988a()` / `backfill_00990a()`（非探測，是正式函式），兩者皆 0 errors 完成，但都沒有產生 `2026-07-03.json`

**結論：這不是程式錯誤，是上游來源截至 2026-07-05（週日）當下尚未發布 07-03 的資料。** 因為 RECENT_CUTOFF 機制會讓近 7 天內的日期在每次排程都重新嘗試，一旦來源補發布，下次排程（最快 07-06 週一 18:30）會自動補上這兩個檔案，不需要人工介入。若 07-07 之後仍缺漏，才需要進一步排查來源是否異常。

---

## 十、快速除錯

| 症狀 | 可能原因 | 排查方式 |
|------|---------|---------|
| 某 ETF 日期停在昨天 | 迴圈中 `fetch_parse(date)` T+1 偏移，date-less fetch 未寫入 | 確認 `backfill_*()` 末尾有 `fetch_parse(None)` |
| 頁面沒更新 | GitHub Pages deploy queue 卡住 | 查 Actions tab，cancel stuck runs，重跑 |
| 市場價格顯示「收盤」 | Yahoo Finance CORS / 非交易時間 | 正常現象，非交易時段 fallback 到 prices.json |
| `last_updated` 沒更新 | deploy 失敗（資料有更新但 deploy 卡住） | 同「頁面沒更新」 |
| Snapshot `file ≠ snap.date` | 存盤用了查詢日期而非 snap["date"] | 確認存盤時使用 `snap.get("date", d.isoformat())` 當檔名 |
| 特定 ETF 某天快照持續缺漏 | 上游來源發布延遲（T+1/T+2），非程式錯誤 | 用不同日期參數呼叫 `fetch_parse()` 探測；確認 `RECENT_CUTOFF` 內會自動重抓，通常下次排程自癒 |
