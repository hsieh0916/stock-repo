import type { Dataset, FundDay, HoldingRow } from './types'

export interface Holding {
  shares: number
  amount: number
  weight: number
}

export type ChangeTag = 'new' | 'exit' | 'up' | 'down' | 'flat'

export interface ChangeRow {
  code: string
  name: string
  shares: number // compare-date shares (0 if exited)
  prevShares: number
  dShares: number
  dLots: number // dShares / 1000
  amount: number
  dAmount: number
  weight: number // compare-date weight (%)
  prevWeight: number
  dWeight: number
  price: number // estimated NT$/share (amount/shares; uses prev-day for exits)
  tag: ChangeTag
}

export function tradingDates(ds: Dataset): string[] {
  return ds.fund_series.map((d) => d.date)
}

export function fundDay(ds: Dataset, date: string): FundDay | undefined {
  return ds.fund_series.find((d) => d.date === date)
}

export function prevTradingDate(ds: Dataset, date: string): string | null {
  const dates = tradingDates(ds)
  const i = dates.indexOf(date)
  return i > 0 ? dates[i - 1] : null
}

export function holdingsMap(ds: Dataset, date: string): Map<string, Holding> {
  const m = new Map<string, Holding>()
  const rows: HoldingRow[] = ds.holdings_by_date[date] || []
  for (const r of rows) m.set(r[0], { shares: r[1], amount: r[2], weight: r[3] })
  return m
}

/** Full day-over-day diff (unfiltered). Includes new (新進) and exit (出清). */
export function diffRows(
  ds: Dataset,
  baseDate: string,
  compareDate: string,
): ChangeRow[] {
  const base = holdingsMap(ds, baseDate)
  const cur = holdingsMap(ds, compareDate)
  const codes = new Set<string>([...base.keys(), ...cur.keys()])
  const out: ChangeRow[] = []
  for (const code of codes) {
    const b = base.get(code)
    const c = cur.get(code)
    const shares = c?.shares ?? 0
    const prevShares = b?.shares ?? 0
    const dShares = shares - prevShares
    const weight = c?.weight ?? 0
    const prevWeight = b?.weight ?? 0
    const amount = c?.amount ?? 0
    const price = shares > 0 ? amount : (prevShares > 0 ? (b?.amount ?? 0) : 0)
    let tag: ChangeTag
    if (!b && c) tag = 'new'
    else if (b && !c) tag = 'exit'
    else if (dShares > 0) tag = 'up'
    else if (dShares < 0) tag = 'down'
    else tag = 'flat'
    out.push({
      code,
      name: ds.securities[code] ?? code,
      shares,
      prevShares,
      dShares,
      dLots: dShares / 1000,
      amount,
      dAmount: dShares * price,
      weight,
      prevWeight,
      dWeight: weight - prevWeight,
      price,
      tag,
    })
  }
  return out
}

/** estimated traded price per row (NT$/share), used for turnover proxy. */
function rowPrice(r: ChangeRow): number {
  return r.price // correctly set in diffRows: today's price for held, prev-day for exits
}

export interface Dashboard {
  day: FundDay
  prevNavPerUnit: number | null
  prevNavTotal: number | null
  weekNavTotal: number | null  // ~5 trading days ago
  monthNavTotal: number | null // ~20 trading days ago
  ma20: number | null // 月線: 20-day MA of nav_per_unit
  ma60: number | null // 季線: 60-day MA of nav_per_unit
  ma240: number | null // 年線: 240-day MA of nav_per_unit
  recentHigh: number | null // 近期高點: max nav_per_unit in last 240 trading days
  newCount: number
  exitCount: number
  changedCount: number // |dShares|>0
  turnover: number // fraction (estimate)
  top10Weight: number // %
  hhi: number // Σ weight%² (0..10000)
  topBuys: ChangeRow[]
  topSells: ChangeRow[]
}

function mavg(series: FundDay[], upToIdx: number, n: number): number | null {
  const slice = series.slice(Math.max(0, upToIdx - n + 1), upToIdx + 1)
  if (slice.length === 0) return null
  return slice.reduce((s, d) => s + d.nav_per_unit, 0) / slice.length
}

export function dashboard(
  ds: Dataset,
  baseDate: string,
  compareDate: string,
): Dashboard {
  const day = fundDay(ds, compareDate)!
  const prevDay = fundDay(ds, baseDate)
  const compareIdx = ds.fund_series.findIndex((d) => d.date === compareDate)
  const rows = diffRows(ds, baseDate, compareDate)
  let traded = 0
  for (const r of rows) traded += Math.abs(r.dShares) * rowPrice(r)
  const cur = ds.holdings_by_date[compareDate] || []
  const weights = cur.map((r) => r[3]).sort((a, b) => b - a)
  const top10Weight = weights.slice(0, 10).reduce((s, w) => s + w, 0)
  const hhi = weights.reduce((s, w) => s + w * w, 0)
  const ups = rows.filter((r) => r.dShares > 0).sort((a, b) => b.dAmount - a.dAmount)
  const downs = rows.filter((r) => r.dShares < 0).sort((a, b) => a.dAmount - b.dAmount)
  const weekDay = compareIdx >= 5 ? ds.fund_series[compareIdx - 5] : null
  const monthDay = compareIdx >= 20 ? ds.fund_series[compareIdx - 20] : null
  return {
    day,
    prevNavPerUnit: prevDay?.nav_per_unit ?? null,
    prevNavTotal: prevDay?.nav_total ?? null,
    weekNavTotal: weekDay?.nav_total ?? null,
    monthNavTotal: monthDay?.nav_total ?? null,
    ma20: compareIdx >= 0 ? mavg(ds.fund_series, compareIdx, 20) : null,
    ma60: compareIdx >= 0 ? mavg(ds.fund_series, compareIdx, 60) : null,
    ma240: compareIdx >= 0 ? mavg(ds.fund_series, compareIdx, 240) : null,
    recentHigh: compareIdx >= 0
      ? Math.max(...ds.fund_series.slice(Math.max(0, compareIdx - 239), compareIdx + 1).map((d) => d.nav_per_unit))
      : null,
    newCount: rows.filter((r) => r.tag === 'new').length,
    exitCount: rows.filter((r) => r.tag === 'exit').length,
    changedCount: rows.filter((r) => r.dShares !== 0).length,
    turnover: day.nav_total ? traded / day.nav_total : 0,
    top10Weight,
    hhi,
    topBuys: ups.slice(0, 5),
    topSells: downs.slice(0, 5),
  }
}

export interface SecurityEvent {
  date: string
  code: string
  name: string
  type: 'new' | 'exit'
  shares: number
  lots: number
}

/** Timeline of 新進/出清 events across all trading days (newest first). */
export function events(ds: Dataset): SecurityEvent[] {
  const dates = tradingDates(ds)
  const out: SecurityEvent[] = []
  for (let i = 1; i < dates.length; i++) {
    const prev = holdingsMap(ds, dates[i - 1])
    const cur = holdingsMap(ds, dates[i])
    for (const [code, h] of cur)
      if (!prev.has(code))
        out.push({ date: dates[i], code, name: ds.securities[code] ?? code, type: 'new', shares: h.shares, lots: h.shares / 1000 })
    for (const [code, h] of prev)
      if (!cur.has(code))
        out.push({ date: dates[i], code, name: ds.securities[code] ?? code, type: 'exit', shares: h.shares, lots: h.shares / 1000 })
  }
  return out.reverse()
}

export interface SectorAgg {
  sector: string
  weight: number // % at compare date
  prevWeight: number // % at base date
  dWeight: number
  count: number // # holdings in sector at compare date
}

/** Aggregate holdings weight by industry for base vs compare date. */
export function sectorAgg(
  ds: Dataset,
  sectors: Record<string, string>,
  baseDate: string,
  compareDate: string,
): SectorAgg[] {
  const acc = new Map<string, { w: number; pw: number; n: number }>()
  const add = (sec: string, key: 'w' | 'pw' | 'n', v: number) => {
    const cur = acc.get(sec) ?? { w: 0, pw: 0, n: 0 }
    cur[key] += v
    acc.set(sec, cur)
  }
  for (const r of ds.holdings_by_date[compareDate] || []) {
    const sec = sectors[r[0]] ?? '未分類'
    add(sec, 'w', r[3])
    add(sec, 'n', 1)
  }
  for (const r of ds.holdings_by_date[baseDate] || []) {
    add(sectors[r[0]] ?? '未分類', 'pw', r[3])
  }
  return [...acc.entries()]
    .map(([sector, v]) => ({ sector, weight: v.w, prevWeight: v.pw, dWeight: v.w - v.pw, count: v.n }))
    .sort((a, b) => b.weight - a.weight)
}

export interface StockPoint {
  date: string
  shares: number
  lots: number
  weight: number
  amount: number
  dShares: number
  dLots: number
}

/** Per-stock full time series across all trading days. */
export function stockSeries(ds: Dataset, code: string): StockPoint[] {
  const dates = tradingDates(ds)
  const out: StockPoint[] = []
  let prev = 0
  for (const date of dates) {
    const rows = ds.holdings_by_date[date] || []
    const r = rows.find((x) => x[0] === code)
    const shares = r ? r[1] : 0
    out.push({
      date,
      shares,
      lots: shares / 1000,
      weight: r ? r[3] : 0,
      amount: r ? r[2] : 0,
      dShares: shares - prev,
      dLots: (shares - prev) / 1000,
    })
    prev = shares
  }
  return out
}

export interface StockSummary {
  firstDate: string | null // 首次進場日
  heldDays: number // 持有天數
  currentLots: number
  currentShares: number
  currentWeight: number
  cumLots: number // 期間累積增減 (張)
  maxDayLots: number // 最大單日變動 (張, 絕對值帶號)
  streak: number // 連續同向天數 (正=增持, 負=減持)
  everExited: boolean // 曾出清再買回
}

export function stockSummary(series: StockPoint[]): StockSummary {
  const held = series.filter((p) => p.shares > 0)
  const first = held.length ? held[0].date : null
  const last = series[series.length - 1]
  // streak from the end over days the stock is held & changing
  let streak = 0
  for (let i = series.length - 1; i >= 0; i--) {
    const d = series[i].dShares
    if (d === 0) break
    const sign = Math.sign(d)
    if (streak === 0 || Math.sign(streak) === sign) streak += sign
    else break
  }
  let maxDayLots = 0
  for (const p of series) if (Math.abs(p.dLots) > Math.abs(maxDayLots)) maxDayLots = p.dLots
  // ever exited: a zero-share day that occurs after the first appearance and before the last held day
  let everExited = false
  if (first) {
    const fi = series.findIndex((p) => p.date === first)
    const li = series.map((p) => p.shares > 0).lastIndexOf(true)
    for (let i = fi; i <= li; i++) if (series[i].shares === 0) everExited = true
  }
  return {
    firstDate: first,
    heldDays: held.length,
    currentLots: last.lots,
    currentShares: last.shares,
    currentWeight: last.weight,
    cumLots: last.shares > 0 ? last.lots : 0,
    maxDayLots,
    streak,
    everExited,
  }
}
