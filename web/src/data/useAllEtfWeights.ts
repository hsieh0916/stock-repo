import { useState, useEffect } from 'react'
import type { Dataset, HoldingRow } from './types'

export const ETF_FILES: [string, string, string][] = [
  ['00991A', 'dataset.json',         '復華台灣未來50'],
  ['00981A', 'dataset_00981A.json',  '統一台股增長'],
  ['00982A', 'dataset_00982A.json',  '群益台灣強棒'],
  ['00980A', 'dataset_00980A.json',  '野村臺灣優選'],
  ['00988A', 'dataset_00988A.json',  '統一全球創新'],
  ['00990A', 'dataset_00990A.json',  '元大全球AI新經濟'],
  ['00994A', 'dataset_00994A.json',  '第一金台股趨勢優選'],
]

export interface EtfWeightRow {
  etfCode: string
  etfName: string
  weight: number | null  // null = not held today
  shares: number | null
  lots: number | null
  dShares: number | null // today vs prev trading day (null if prev data unavailable)
  dLots: number | null
  date: string | null
}

// Module-level cache: one Promise<Dataset|null> per file, lives for the page session
const _cache = new Map<string, Promise<Dataset | null>>()

export function loadDataset(file: string): Promise<Dataset | null> {
  if (!_cache.has(file)) {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const url = `${import.meta.env.BASE_URL}${file}?v=${today}`
    const p = fetch(url)
      .then((r) => (r.ok ? (r.json() as Promise<Dataset>) : null))
      .catch(() => null)
    _cache.set(file, p)
  }
  return _cache.get(file)!
}

function findShares(holdings: HoldingRow[], stockCode: string): number {
  return holdings.find((h) => h[0] === stockCode)?.[1] ?? 0
}

export function useAllEtfWeights(stockCode: string): EtfWeightRow[] {
  const [rows, setRows] = useState<EtfWeightRow[]>([])

  useEffect(() => {
    let alive = true
    Promise.all(
      ETF_FILES.map(async ([etfCode, file, etfName]) => {
        const ds = await loadDataset(file)
        const series = ds?.fund_series ?? []
        const lastDay = series[series.length - 1]
        const prevDay = series.length >= 2 ? series[series.length - 2] : null

        const todayH: HoldingRow[] = lastDay ? (ds!.holdings_by_date[lastDay.date] ?? []) : []
        const prevH: HoldingRow[] = prevDay ? (ds!.holdings_by_date[prevDay.date] ?? []) : []

        const row = todayH.find((h) => h[0] === stockCode)
        const curShares = row ? row[1] : 0
        const prevShares = prevDay ? findShares(prevH, stockCode) : null

        const dShares = prevShares !== null ? curShares - prevShares : null

        return {
          etfCode,
          etfName,
          weight: row ? row[3] : null,
          shares: row ? row[1] : null,
          lots: row ? row[1] / 1000 : null,
          dShares,
          dLots: dShares !== null ? dShares / 1000 : null,
          date: lastDay?.date ?? null,
        }
      }),
    ).then((result) => { if (alive) setRows(result) })
    return () => { alive = false }
  }, [stockCode])

  return rows
}
