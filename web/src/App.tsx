import { Suspense, lazy, useEffect, useState } from 'react'
import { useDataset } from './data/useDataset'
import type { Dataset } from './data/types'
import { prevTradingDate, tradingDates } from './data/analytics'
import { useWatchlist } from './lib/useWatchlist'
import { Header } from './components/Header'
import { DateControls } from './components/DateControls'
import { DashboardCards } from './components/DashboardCards'
import { ChangeTable } from './components/ChangeTable'

const AnalysisView = lazy(() =>
  import('./components/AnalysisView').then((m) => ({ default: m.AnalysisView })),
)
const StockDetail = lazy(() =>
  import('./components/StockDetail').then((m) => ({ default: m.StockDetail })),
)

const ETF_DATASETS: Record<string, string> = {
  '00991A': 'dataset.json',
  '00981A': 'dataset_00981A.json',
  '00982A': 'dataset_00982A.json',
  '00980A': 'dataset_00980A.json',
  '00988A': 'dataset_00988A.json',
  '00990A': 'dataset_00990A.json',
}

const ETF_SOURCES: Record<string, string> = {
  '00991A': '復華投信官網每日持股揭露（00991A）',
  '00981A': '統一投信 ezmoney.com.tw 每日持股揭露（00981A）',
  '00982A': '群益投信官網每日持股揭露（00982A）',
  '00980A': '野村投信官網每日持股揭露（00980A）',
  '00988A': '統一投信 ezmoney.com.tw 每日持股揭露（00988A）',
  '00990A': '元大投信 yuantaetfs.com 每日持股揭露（00990A）',
}

function useDark(): [boolean, () => void] {
  const [dark, setDark] = useState(
    () =>
      localStorage.getItem('etf-tracker.dark') === '1' ||
      (localStorage.getItem('etf-tracker.dark') === null &&
        window.matchMedia('(prefers-color-scheme: dark)').matches),
  )
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('etf-tracker.dark', dark ? '1' : '0')
  }, [dark])
  return [dark, () => setDark((d) => !d)]
}

export default function App() {
  const [dark, toggleDark] = useDark()
  const [etf, setEtf] = useState(() => localStorage.getItem('etf-tracker.etf') ?? '00991A')
  const [rev, setRev] = useState(0)
  const [cached, setCached] = useState<Dataset | null>(null)

  function handleSetEtf(code: string) {
    setEtf(code)
    localStorage.setItem('etf-tracker.etf', code)
    setCached(null)
  }

  // Include today's date so CDN/browser cache is busted once per day on initial load.
  // The rev param adds a timestamp for same-day forced refreshes via the ↻ button.
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const baseUrl = `${import.meta.env.BASE_URL}${ETF_DATASETS[etf] ?? 'dataset.json'}`
  const url = `${baseUrl}?v=${today}`
  const state = useDataset(url, rev)

  useEffect(() => {
    if (state.status === 'ready') setCached(state.data)
  }, [state])

  const refreshing = state.status === 'loading'

  if (state.status === 'error') return <Centered>資料載入失敗：{state.error}</Centered>
  if (!cached) return <Centered>載入資料中…</Centered>
  return (
    <Main
      ds={cached}
      dark={dark}
      toggleDark={toggleDark}
      etf={etf}
      onSetEtf={handleSetEtf}
      sourceNote={ETF_SOURCES[etf] ?? ''}
      refreshing={refreshing}
      onRefresh={() => setRev((r) => r + 1)}
    />
  )
}

interface MainProps {
  ds: Dataset
  dark: boolean
  toggleDark: () => void
  etf: string
  onSetEtf: (code: string) => void
  sourceNote: string
  refreshing: boolean
  onRefresh: () => void
}

function Main({ ds, dark, toggleDark, etf, onSetEtf, sourceNote, refreshing, onRefresh }: MainProps) {
  const dates = tradingDates(ds)
  const last = dates[dates.length - 1]
  const [tab, setTab] = useState<'investor' | 'analysis'>('investor')
  const [compareDate, setCompareDate] = useState(last)
  const [baseDate, setBaseDate] = useState(prevTradingDate(ds, last) ?? dates[0])
  const [selected, setSelected] = useState<string | null>(null)
  const watch = useWatchlist()

  // Reset dates when dataset changes
  useEffect(() => {
    const l = dates[dates.length - 1]
    setCompareDate(l)
    setBaseDate(prevTradingDate(ds, l) ?? dates[0])
    setSelected(null)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ds])

  function onCompare(d: string) {
    setCompareDate(d)
    setBaseDate(prevTradingDate(ds, d) ?? dates[0])
  }

  return (
    <div className="min-h-full bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      <Header ds={ds} dark={dark} onToggleDark={toggleDark} etf={etf} onSetEtf={onSetEtf} refreshing={refreshing} onRefresh={onRefresh} />

      <div className="mx-auto max-w-7xl px-4 py-4 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-lg border border-gray-300 dark:border-gray-700 overflow-hidden text-sm">
            <TabBtn on={tab === 'investor'} onClick={() => setTab('investor')}>投資人版</TabBtn>
            <TabBtn on={tab === 'analysis'} onClick={() => setTab('analysis')}>分析版</TabBtn>
          </div>
          {tab === 'investor' && (
            <div className="ml-auto">
              <DateControls dates={dates} baseDate={baseDate} compareDate={compareDate} onBase={setBaseDate} onCompare={onCompare} />
            </div>
          )}
        </div>

        {tab === 'investor' ? (
          <>
            <DashboardCards ds={ds} baseDate={baseDate} compareDate={compareDate} onSelect={setSelected} />
            <ChangeTable
              ds={ds}
              baseDate={baseDate}
              compareDate={compareDate}
              onSelect={setSelected}
              isWatched={watch.has}
              onToggleWatch={watch.toggle}
            />
          </>
        ) : (
          <Suspense fallback={<div className="py-12 text-center text-gray-400">載入分析模組…</div>}>
            <AnalysisView ds={ds} dark={dark} onSelect={setSelected} isWatched={watch.has} onToggleWatch={watch.toggle} />
          </Suspense>
        )}
      </div>

      {selected && (
        <Suspense fallback={null}>
          <StockDetail
            ds={ds}
            code={selected}
            dark={dark}
            isWatched={watch.has}
            onToggleWatch={watch.toggle}
            onClose={() => setSelected(null)}
          />
        </Suspense>
      )}

      <footer className="mx-auto max-w-7xl px-4 py-6 text-xs text-gray-400 dark:text-gray-600 space-y-1 border-t border-gray-100 dark:border-gray-900 mt-4">
        <p>資料來源：{sourceNote}。每交易日揭露後自動更新。1 張 = 1,000 股。</p>
        <p>⚠️ 股數變化未必等於買賣，亦可能來自除權息／減資／股票分割等股本變動；換手率為估計值。本工具僅供研究參考，<strong>不構成任何投資建議</strong>，據以買賣風險自負。</p>
      </footer>
    </div>
  )
}

function TabBtn({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-1.5 ${on ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
    >
      {children}
    </button>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-950">
      {children}
    </div>
  )
}
