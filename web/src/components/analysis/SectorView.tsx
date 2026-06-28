import { useMemo } from 'react'
import { Chart } from '../Chart'
import type { Dataset } from '../../data/types'
import { sectorAgg } from '../../data/analytics'
import { fmtSignedPct, upDown } from '../../lib/format'

interface Props {
  ds: Dataset
  sectors: Record<string, string>
  start: string
  end: string
  dark: boolean
}

export function SectorView({ ds, sectors, start, end, dark }: Props) {
  const aggs = useMemo(() => sectorAgg(ds, sectors, start, end), [ds, sectors, start, end])
  const axis = dark ? '#9ca3af' : '#6b7280'

  if (!Object.keys(sectors).length)
    return <div className="text-sm text-gray-400 p-3">產業對照資料 (sectors.json) 尚未載入。</div>

  const pie = {
    tooltip: { trigger: 'item', formatter: '{b}: {c}% ({d}%)' },
    legend: { type: 'scroll', orient: 'vertical', right: 0, top: 8, textStyle: { color: axis }, formatter: (n: string) => (n.length > 6 ? n.slice(0, 6) : n) },
    series: [
      {
        type: 'pie',
        radius: ['38%', '70%'],
        center: ['38%', '50%'],
        data: aggs.map((a) => ({ name: a.sector, value: +a.weight.toFixed(2) })),
        label: { color: axis, formatter: '{b}\n{c}%' },
        labelLine: { length: 6, length2: 6 },
      },
    ],
  }

  return (
    <div className="grid lg:grid-cols-2 gap-3">
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3">
        <div className="text-sm font-medium mb-1">產業權重分布（{end}）</div>
        <Chart option={pie} style={{ height: 340 }} notMerge />
      </div>
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3">
        <div className="text-sm font-medium mb-2">產業權重變化（{start} → {end}）</div>
        <div className="overflow-y-auto thin-scroll" style={{ maxHeight: 320 }}>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-800">
                <th className="px-2 py-1.5 font-medium">產業</th>
                <th className="px-2 py-1.5 font-medium text-right">檔數</th>
                <th className="px-2 py-1.5 font-medium text-right">權重</th>
                <th className="px-2 py-1.5 font-medium text-right">Δ權重</th>
              </tr>
            </thead>
            <tbody>
              {aggs.map((a) => (
                <tr key={a.sector} className="border-b border-gray-50 dark:border-gray-800/60">
                  <td className="px-2 py-1.5">{a.sector}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{a.count}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{a.weight.toFixed(2)}%</td>
                  <td className={`px-2 py-1.5 text-right tabular-nums ${upDown(a.dWeight)}`}>{fmtSignedPct(a.dWeight)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
