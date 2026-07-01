import { useState } from 'react'
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

const GH_REPO = 'hsieh0916/stock-repo'
const GH_WORKFLOW = 'daily.yml'
const TOKEN_KEY = 'gh_pat'

type TriggerStatus = 'idle' | 'prompting' | 'pending' | 'ok' | 'err'

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
  const [triggerStatus, setTriggerStatus] = useState<TriggerStatus>('idle')
  const [tokenInput, setTokenInput] = useState('')
  const [errMsg, setErrMsg] = useState('')

  async function dispatchWorkflow(token: string) {
    setTriggerStatus('pending')
    try {
      const res = await fetch(
        `https://api.github.com/repos/${GH_REPO}/actions/workflows/${GH_WORKFLOW}/dispatches`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github+json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ ref: 'main' }),
        },
      )
      if (res.status === 204) {
        localStorage.setItem(TOKEN_KEY, token)
        setTriggerStatus('ok')
        setTimeout(() => setTriggerStatus('idle'), 4000)
      } else {
        const body = await res.json().catch(() => ({}))
        setErrMsg(body.message ?? `HTTP ${res.status}`)
        setTriggerStatus('err')
      }
    } catch (e) {
      setErrMsg(String(e))
      setTriggerStatus('err')
    }
  }

  function handleTriggerClick() {
    const saved = localStorage.getItem(TOKEN_KEY)
    if (saved) {
      dispatchWorkflow(saved)
    } else {
      setTokenInput('')
      setTriggerStatus('prompting')
    }
  }

  function handleTokenSubmit() {
    const t = tokenInput.trim()
    if (t) dispatchWorkflow(t)
  }

  return (
    <header className="border-b border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur sticky top-0 z-20">
      <div className="mx-auto max-w-7xl px-4 py-3 flex items-center gap-3 flex-wrap">
        <a href="/" className="flex items-center gap-1.5 shrink-0 mr-1" title="主動ETF持股雷達">
          <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="logo" className="w-6 h-6" />
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

        {/* CI trigger button */}
        <div className="relative">
          {triggerStatus === 'prompting' && (
            <div className="absolute right-0 top-full mt-1 z-30 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg shadow-lg p-3 w-72">
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                輸入 GitHub PAT（需 <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">workflow</code> 權限）
              </p>
              <input
                autoFocus
                type="password"
                value={tokenInput}
                onChange={e => setTokenInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleTokenSubmit()}
                placeholder="github_pat_..."
                className="w-full rounded border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-2 py-1 text-xs mb-2 outline-none"
              />
              <div className="flex gap-2 justify-end">
                <button onClick={() => setTriggerStatus('idle')} className="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800">取消</button>
                <button onClick={handleTokenSubmit} className="text-xs px-2 py-1 rounded bg-indigo-600 text-white hover:bg-indigo-700">確認</button>
              </div>
            </div>
          )}
          {triggerStatus === 'err' && (
            <div className="absolute right-0 top-full mt-1 z-30 bg-white dark:bg-gray-900 border border-red-300 dark:border-red-700 rounded-lg shadow-lg p-3 w-64 text-xs text-red-600 dark:text-red-400">
              觸發失敗：{errMsg}
              <div className="flex gap-2 mt-2 justify-end">
                <button onClick={() => { localStorage.removeItem(TOKEN_KEY); setTriggerStatus('prompting') }} className="underline">重設 Token</button>
                <button onClick={() => setTriggerStatus('idle')} className="underline">關閉</button>
              </div>
            </div>
          )}
          <button
            onClick={handleTriggerClick}
            disabled={triggerStatus === 'pending' || triggerStatus === 'ok'}
            className={`rounded-md border px-2 py-1 text-xs disabled:opacity-60
              ${triggerStatus === 'ok'
                ? 'border-emerald-400 text-emerald-600 dark:text-emerald-400'
                : 'border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
            title="觸發 CI 重新抓取所有 ETF 資料"
          >
            {triggerStatus === 'pending' ? '排程中…' : triggerStatus === 'ok' ? '已排程 ✓' : '⚡ 更新資料'}
          </button>
        </div>

        <button
          onClick={onRefresh}
          disabled={refreshing}
          className="rounded-md border border-gray-300 dark:border-gray-700 px-2 py-1 text-sm hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50"
          title="重新載入頁面資料"
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
