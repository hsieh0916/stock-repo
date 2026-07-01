import type { Dataset } from '../data/types'

const ETF_GROUPS: { label: string; etfs: Record<string, string> }[] = [
  {
    label: '台灣',
    etfs: {
      '00991A': '復華台灣未來50',
      '00981A': '主動統一台股增長',
      '00982A': '主動群益台灣強棒',
      '00980A': '主動野村臺灣優選',
    },
  },
  {
    label: '全球',
    etfs: {
      '00988A': '統一全球創新',
      '00990A': '元大全球AI新經濟',
    },
  },
]

interface Props {
  ds: Dataset
  dark: boolean
  onToggleDark: () => void
  etf: string
  onSetEtf: (code: string) => void
  refreshing: boolean
  onRefresh: () => void
}

export function Header({ ds, dark, onToggleDark, etf, onSetEtf, refreshing, onRefresh }: Props) {
  return (
    <header className="border-b border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur sticky top-0 z-20">
      <div className="mx-auto max-w-7xl px-4 py-3 flex items-center gap-3 flex-wrap">
        <a href="/" className="flex items-center gap-1.5 shrink-0 mr-1" title="主動ETF持股雷達">
          <img src="/favicon.svg" alt="logo" className="w-6 h-6" />
          <span className="font-bold text-sm tracking-tight hidden sm:inline" style={{ color: '#863bff' }}>主動ETF持股雷達</span>
        </a>
        <div className="flex items-center gap-2 flex-wrap">
          {ETF_GROUPS.map((group, gi) => (
            <div key={group.label} className="flex items-center gap-1.5">
              {gi > 0 && (
                <span className="text-gray-300 dark:text-gray-700 select-none">│</span>
              )}
              <span className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide">
                {group.label}
              </span>
              <div className="inline-flex rounded-md border border-gray-300 dark:border-gray-700 overflow-hidden text-sm">
                {Object.entries(group.etfs).map(([code, label]) => (
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
            </div>
          ))}
        </div>
        <span className="text-sm text-gray-600 dark:text-gray-400">{ds.fund.name}</span>
        <span className="ml-auto text-xs text-gray-500 dark:text-gray-400 hidden sm:inline">
          資料 {ds.generated_dates.first} ~ {ds.generated_dates.last}（{ds.generated_dates.count} 交易日）
        </span>
        <button
          onClick={onRefresh}
          disabled={refreshing}
          className="rounded-md border border-gray-300 dark:border-gray-700 px-2 py-1 text-sm hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50"
          title="更新資料"
        >
          <span className={refreshing ? 'inline-block animate-spin' : ''}>↻</span>
        </button>
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
