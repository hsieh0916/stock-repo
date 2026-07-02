import { useState, useEffect } from 'react'

export interface EtfPriceState {
  price: number | null
  updatedAt: string | null // "HH:MM" when real-time, null when using close price
  isRealtime: boolean
}

// Yahoo Finance — historical CORS support; works during & outside market hours
async function fetchYahoo(code: string): Promise<number | null> {
  try {
    const url =
      `https://query1.finance.yahoo.com/v8/finance/chart/${code}.TW` +
      `?interval=1d&range=1d`
    const r = await fetch(url, { cache: 'no-store' })
    if (!r.ok) return null
    const data = await r.json()
    const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice
    return typeof price === 'number' && price > 0 ? price : null
  } catch {
    return null
  }
}

// TWSE MIS — real-time during market hours, may be CORS-blocked in browsers
async function fetchMis(code: string): Promise<number | null> {
  try {
    const url =
      `https://mis.twse.com.tw/stock/api/getStockInfo.jsp` +
      `?ex_ch=tse_${code.toLowerCase()}.tw&json=1&delay=0`
    const r = await fetch(url, { cache: 'no-store' })
    if (!r.ok) return null
    const data = await r.json()
    const z = data?.msgArray?.[0]?.z
    return z && z !== '-' ? parseFloat(z) : null
  } catch {
    return null
  }
}

/**
 * Real-time ETF market price (updates every 30 min).
 * Tries Yahoo Finance first (CORS-friendly), then TWSE MIS.
 * Falls back to closePrice (daily close from prices.json) when both fail.
 */
export function useEtfPrice(code: string, closePrice: number | null): EtfPriceState {
  const [state, setState] = useState<EtfPriceState>({
    price: closePrice,
    updatedAt: null,
    isRealtime: false,
  })

  useEffect(() => {
    let alive = true

    async function poll() {
      const rt = (await fetchYahoo(code)) ?? (await fetchMis(code))
      if (!alive) return
      if (rt != null) {
        const hhmm = new Date().toTimeString().slice(0, 5)
        setState({ price: rt, updatedAt: hhmm, isRealtime: true })
      } else {
        setState((s) =>
          s.isRealtime ? s : { price: closePrice, updatedAt: null, isRealtime: false },
        )
      }
    }

    poll()
    const id = setInterval(poll, 30 * 60 * 1000)
    return () => {
      alive = false
      clearInterval(id)
    }
  }, [code, closePrice])

  return state
}
