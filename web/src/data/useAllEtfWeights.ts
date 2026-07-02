import { useState, useEffect } from 'react'
import type { Dataset, HoldingRow } from './types'

const ETF_FILES: [string, string, string][] = [
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
  weight: number | null  // null = not held
  shares: number | null
  lots: number | null
  date: string | null    // latest data date for this ETF
}

// Module-level cache: one Promise<Dataset|null> per file, lives for the page session
const _cache = new Map<string, Promise<Dataset | null>>()

function loadDataset(file: string): Promise<Dataset | null> {
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

export function useAllEtfWeights(stockCode: string): EtfWeightRow[] {
  const [rows, setRows] = useState<EtfWeightRow[]>([])

  useEffect(() => {
    let alive = true
    Promise.all(
      ETF_FILES.map(async ([etfCode, file, etfName]) => {
        const ds = await loadDataset(file)
        const lastDay = ds?.fund_series[ds.fund_series.length - 1]
        const holdings: HoldingRow[] = lastDay ? (ds!.holdings_by_date[lastDay.date] ?? []) : []
        const row = holdings.find((h) => h[0] === stockCode)
        return {
          etfCode,
          etfName,
          weight: row ? row[3] : null,
          shares: row ? row[1] : null,
          lots: row ? row[1] / 1000 : null,
          date: lastDay?.date ?? null,
        }
      }),
    ).then((result) => { if (alive) setRows(result) })
    return () => { alive = false }
  }, [stockCode])

  return rows
}
