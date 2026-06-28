import { useEffect, useState } from 'react'
import type { Dataset } from './types'

type State =
  | { status: 'loading' }
  | { status: 'error'; error: string }
  | { status: 'ready'; data: Dataset }

export function useDataset(url: string): State {
  const [state, setState] = useState<State>({ status: 'loading' })
  useEffect(() => {
    let alive = true
    setState({ status: 'loading' })
    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((data: Dataset) => alive && setState({ status: 'ready', data }))
      .catch((e) => alive && setState({ status: 'error', error: String(e) }))
    return () => {
      alive = false
    }
  }, [url])
  return state
}
