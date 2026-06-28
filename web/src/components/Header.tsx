import type { Dataset } from '../data/types'

interface Props {
  ds: Dataset
  dark: boolean
  onToggleDark: () => void
}

export function Header({ ds, dark, onToggleDark }: Props) {
  return (
    <header className="border-b border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur sticky top-0 z-20">
      <div className="mx-auto max-w-7xl px-4 py-3 flex items-center gap-3">
        <div className="flex items-baseline gap-2">
          <span className="text-lg font-bold tracking-tight">{ds.fund.code}</span>
          <span className="text-sm text-gray-600 dark:text-gray-400">{ds.fund.name}</span>
        </div>
        <span className="ml-auto text-xs text-gray-500 dark:text-gray-400 hidden sm:inline">
          資料 {ds.generated_dates.first} ~ {ds.generated_dates.last}（{ds.generated_dates.count} 交易日）
        </span>
        <button
          onClick={onToggleDark}
          className="ml-2 rounded-md border border-gray-300 dark:border-gray-700 px-2 py-1 text-sm hover:bg-gray-100 dark:hover:bg-gray-800"
          title="切換深色模式"
        >
          {dark ? '☀️' : '🌙'}
        </button>
      </div>
    </header>
  )
}
