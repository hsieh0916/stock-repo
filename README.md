# 00991A 復華台灣未來50主動式ETF — 每日持股變化追蹤

分析復華台灣未來50主動式 ETF（00991A）每日揭露持股，追蹤主要持股變化
（預設 |Δ股數| ≥ 10,000 股 / 10 張），並可點選個股查詢持股張數與逐日變化。

## 資料源

官網 ETF 頁面背後的 Excel 匯出端點（已逆向確認）：

```
https://www.fhtrust.com.tw/api/assetsExcel/ETF23/<YYYYMMDD>
```

- 任意交易日回傳一份 xlsx（含基金淨值/規模/單位數 + 50 檔持股：代號/名稱/股數/金額/權重%）
- 非交易日（週末、假日、成立日前）回傳 12-byte JSON「查無資料」
- 基金資料自 **2025-12-09** 起；本工具回補全歷史（~130 交易日）

## 專案結構

```
pipeline/        Python 資料管線（零相依，stdlib）
  fhetf.py         fetch + 解析 xlsx
  backfill.py      回補全歷史 → data/snapshots/*.json + dataset.json
data/
  snapshots/       每日標準化快照（一日一檔）
  public/          dataset.json（合併檔，前端用）
web/             React + Vite + TS 前端（Tailwind / ECharts / TanStack Table）
  public/dataset.json   前端讀取的資料（由管線寫入）
```

## 開發

資料管線（Python ≥ 3.8，無需額外套件）：

```bash
python3 pipeline/backfill.py      # 回補/更新並產生 dataset.json（含寫入 web/public/）
```

前端（Node 22；本機用 conda env `etfweb`）：

```bash
cd web
npm install
npm run dev       # 本機開發
npm run build     # 產出靜態站到 web/dist/
npm run preview   # 預覽產出
```

## 功能（Phase 1）

- **投資人版**：每日總覽（規模/淨值/檔數/換手率/前10大權重/HHI）、當日買賣超 Top5、
  持股變化表（門檻滑桿、增持/減持/新進/出清篩選、股數↔權重視角、搜尋、匯出 CSV）
- **個股明細**：持股張數+權重走勢、每日買賣超、持有天數/連續變動/首次進場、逐日明細、匯出
- **分析版**：基金規模&檔數走勢、集中度（前10大權重 & HHI）走勢
- 深色模式、關注清單（localStorage）、RWD

## 注意事項

- 1 張 = 1,000 股。預設門檻 |Δ股數| ≥ 10,000 股（= 10 張），可用滑桿調整。
- ⚠️ 股數變化未必等於買賣，亦可能來自除權息／減資／股票分割等股本變動；
  大量申購會使多數個股同步增持 → 建議搭配「權重視角」判讀經理人意圖。
- 本工具僅供研究參考，非投資建議。

## 後續（規劃）

- **Phase 2**：區間 diff、區間買賣超排行、產業/類股分布、變化熱力圖、進出事件時間軸
- **Phase 3**：每日排程（GitHub Actions）自動更新 + Email 推播（關注股變動超門檻）
- **Phase 4**：RWD 微調、抓取失敗告警、免責頁
