import { useMemo, useState } from 'react'
import type { Dataset } from '../../data/types'
import { events } from '../../data/analytics'
import { fmtInt, fmtLots } from '../../lib/format'

interface Props {
  ds: Dataset
  onSelect: (code: string) => void
}

export function EventsTimeline({ ds, onSelect }: Props) {
  const all = useMemo(() => events(ds), [ds])
  const [hideRamp, setHideRamp] = useState(true)
  // inception ramp: the first few trading days where the portfolio was first built
  const rampCutoff = ds.fund_series[5]?.date ?? ds.generated_dates.first
  const rows = hideRamp ? all.filter((e) => e.date > rampCutoff) : all

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3">
      <div className="flex items-center mb-2">
        <div className="text-sm font-medium">新進 / 剔除事件時間軸</div>
        <label className="ml-auto flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
          <input type="checkbox" checked={hideRamp} onChange={(e) => setHideRamp(e.target.checked)} />
          排除建倉期（{rampCutoff} 前）
        </label>
        <span className="ml-3 text-xs text-gray-400">{rows.length} 筆</span>
      </div>
      <div className="overflow-y-auto thin-scroll" style={{ maxHeight: 360 }}>
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-white dark:bg-gray-900">
            <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-800">
              <th className="px-2 py-1.5 font-medium">日期</th>
              <th className="px-2 py-1.5 font-medium">事件</th>
              <th className="px-2 py-1.5 font-medium">代號</th>
              <th className="px-2 py-1.5 font-medium">名稱</th>
              <th className="px-2 py-1.5 font-medium text-right">張數</th>
              <th className="px-2 py-1.5 font-medium text-right">股數</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((e, i) => (
              <tr
                key={i}
                onClick={() => onSelect(e.code)}
                className="border-b border-gray-50 dark:border-gray-800/60 hover:bg-indigo-50/50 dark:hover:bg-indigo-500/10 cursor-pointer"
              >
                <td className="px-2 py-1.5 font-mono text-xs">{e.date}</td>
                <td className="px-2 py-1.5">
                  <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${e.type === 'new' ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' : 'bg-gray-200 text-gray-600 dark:bg-gray-600/30 dark:text-gray-300'}`}>
                    {e.type === 'new' ? '🆕 新進' : '🚫 出清'}
                  </span>
                </td>
                <td className="px-2 py-1.5 font-mono text-xs text-gray-500">{e.code}</td>
                <td className="px-2 py-1.5 font-medium">{e.name}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{fmtLots(e.lots)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{fmtInt(e.shares)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={6} className="px-2 py-6 text-center text-gray-400">無事件</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
