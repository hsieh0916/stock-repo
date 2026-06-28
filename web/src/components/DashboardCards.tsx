import { useMemo } from 'react'
import type { Dataset } from '../data/types'
import { dashboard } from '../data/analytics'
import { fmtInt, fmtPct, fmtSignedLots, fmtYi, upDown } from '../lib/format'

function Card({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3">
      <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
      <div className="mt-1 text-lg font-semibold tabular-nums">{value}</div>
      {sub != null && <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{sub}</div>}
    </div>
  )
}

interface Props {
  ds: Dataset
  baseDate: string
  compareDate: string
  onSelect: (code: string) => void
}

export function DashboardCards({ ds, baseDate, compareDate, onSelect }: Props) {
  const d = useMemo(() => dashboard(ds, baseDate, compareDate), [ds, baseDate, compareDate])

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card label="基金規模" value={fmtYi(d.day.nav_total)} />
        <Card label="每單位淨值" value={d.day.nav_per_unit?.toFixed(2)} />
        <Card label="持股檔數" value={d.day.n_holdings} sub={`新進 ${d.newCount}／出清 ${d.exitCount}`} />
        <Card label="當日換手率(估)" value={fmtPct(d.turnover * 100, 1)} sub="Σ|Δ持股市值|/規模" />
        <Card label="前10大權重" value={fmtPct(d.top10Weight, 1)} />
        <Card label="集中度 HHI" value={fmtInt(d.hhi)} sub="Σ權重²" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <MoverList title="當日買超 Top 5（張）" rows={d.topBuys} onSelect={onSelect} ds={ds} />
        <MoverList title="當日賣超 Top 5（張）" rows={d.topSells} onSelect={onSelect} ds={ds} />
      </div>
    </div>
  )
}

function MoverList({
  title,
  rows,
  onSelect,
  ds,
}: {
  title: string
  rows: ReturnType<typeof dashboard>['topBuys']
  onSelect: (code: string) => void
  ds: Dataset
}) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3">
      <div className="text-sm font-medium mb-2">{title}</div>
      {rows.length === 0 ? (
        <div className="text-xs text-gray-400 py-2">無</div>
      ) : (
        <ul className="space-y-1">
          {rows.map((r) => (
            <li key={r.code}>
              <button
                onClick={() => onSelect(r.code)}
                className="w-full flex items-center gap-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 rounded px-1.5 py-1"
              >
                <span className="font-mono text-xs text-gray-500 w-12 text-left">{r.code}</span>
                <span className="truncate text-left flex-1">{ds.securities[r.code]}</span>
                <span className={`tabular-nums ${upDown(r.dShares)}`}>{fmtSignedLots(r.dLots)} 張</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
