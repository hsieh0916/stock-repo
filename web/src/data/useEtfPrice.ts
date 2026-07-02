import { useState, useEffect } from 'react'

export interface EtfPriceState {
  price: number | null
  updatedAt: string | null // "HH:MM" when real-time, null when using close price
  isRealtime: boolean
}

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
 * Real-time ETF market price via TWSE MIS (updates every 30 min).
 * Falls back to closePrice when market is closed or API is unavailable.
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
      const rt = await fetchMis(code)
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
