import { useState, useEffect } from 'react'

export type PriceMap = Record<string, number>

let _cache: PriceMap | null = null
let _promise: Promise<PriceMap> | null = null

function loadPrices(): Promise<PriceMap> {
  if (_cache) return Promise.resolve(_cache)
  if (_promise) return _promise
  _promise = fetch(`${import.meta.env.BASE_URL}prices.json`)
    .then((r) => (r.ok ? r.json() : {}))
    .then((data: PriceMap) => {
      _cache = data
      return data
    })
    .catch(() => ({}))
  return _promise
}

export function usePrices(): PriceMap {
  const [map, setMap] = useState<PriceMap>(_cache ?? {})
  useEffect(() => {
    if (_cache) return
    loadPrices().then(setMap)
  }, [])
  return map
}
