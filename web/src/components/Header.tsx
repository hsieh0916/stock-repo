import type { Dataset } from '../data/types'

const ETF_INFO: Record<string, string> = {
  '00991A': '復華台灣未來50',
  '00981A': '主動統一台股增長',
}

interface Props {
  ds: Dataset
  dark: boolean
  onToggleDark: () => void
  etf: string
  onSetEtf: (code: string) => void
}

export function Header({ ds, dark, onToggleDark, etf, onSetEtf }: Props) {
  return (
    <header className="border-b border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur sticky top-0 z-20">
      <div className="mx-auto max-w-7xl px-4 py-3 flex items-center gap-3 flex-wrap">
        <div className="inline-flex rounded-md border border-gray-300 dark:border-gray-700 overflow-hidden text-sm">
          {Object.entries(ETF_INFO).map(([code, label]) => (
            <button
              key={code}
              onClick={() => onSetEtf(code)}
              className={`px-2.5 py-1 ${etf === code ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
              title={label}
            >
              {code}
            </button>
          ))}
        </div>
        <span className="text-sm text-gray-600 dark:text-gray-400">{ds.fund.name}</span>
        <span className="ml-auto text-xs text-gray-500 dark:text-gray-400 hidden sm:inline">
          資料 {ds.generated_dates.first} ~ {ds.generated_dates.last}（{ds.generated_dates.count} 交易日）
        </span>
        <button
          onClick={onToggleDark}
          className="rounded-md border border-gray-300 dark:border-gray-700 px-2 py-1 text-sm hover:bg-gray-100 dark:hover:bg-gray-800"
          title="切換深色模式"
        >
          {dark ? '☀️' : '🌙'}
        </button>
      </div>
    </header>
  )
}
