import { useEffect, useState } from 'react'

// code -> 產業別 name. Loaded from /sectors.json (optional; empty if absent).
export function useSectors(): Record<string, string> {
  const [map, setMap] = useState<Record<string, string>>({})
  useEffect(() => {
    let alive = true
    fetch(`${import.meta.env.BASE_URL}sectors.json`)
      .then((r) => (r.ok ? r.json() : {}))
      .then((m) => alive && setMap(m))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])
  return map
}
