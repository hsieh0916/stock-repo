import { useCallback, useEffect, useState } from 'react'

const KEY = 'etf00991a.watchlist'

export function useWatchlist() {
  const [codes, setCodes] = useState<Set<string>>(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem(KEY) || '[]'))
    } catch {
      return new Set()
    }
  })

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify([...codes]))
  }, [codes])

  const toggle = useCallback((code: string) => {
    setCodes((prev) => {
      const next = new Set(prev)
      next.has(code) ? next.delete(code) : next.add(code)
      return next
    })
  }, [])

  const has = useCallback((code: string) => codes.has(code), [codes])

  return { codes, toggle, has }
}
