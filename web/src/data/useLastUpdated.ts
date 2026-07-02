import { useState, useEffect } from 'react'

/** Fetches last_updated.json and returns a Taiwan-time display string, e.g. "07/02 20:35" */
export function useLastUpdated(): string | null {
  const [display, setDisplay] = useState<string | null>(null)

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}last_updated.json`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data?.at) return
        const d = new Date(data.at)
        const s = d.toLocaleString('zh-TW', {
          timeZone: 'Asia/Taipei',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        })
        setDisplay(s)
      })
      .catch(() => null)
  }, [])

  return display
}
