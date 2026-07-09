import { useState, useEffect } from 'react'
import { stockSeries } from './analytics'
import type { StockPoint } from './analytics'
import { ETF_FILES, loadDataset } from './useAllEtfWeights'

export function useEtfStockSeries(etfCode: string, stockCode: string): StockPoint[] {
  const [series, setSeries] = useState<StockPoint[]>([])

  useEffect(() => {
    let alive = true
    const entry = ETF_FILES.find(([c]) => c === etfCode)
    if (!entry) { setSeries([]); return }
    const [, file] = entry
    loadDataset(file).then((ds) => {
      if (!alive || !ds) { setSeries([]); return }
      setSeries(stockSeries(ds, stockCode))
    })
    return () => { alive = false }
  }, [etfCode, stockCode])

  return series
}
