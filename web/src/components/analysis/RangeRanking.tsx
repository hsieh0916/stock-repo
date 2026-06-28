import { useMemo } from 'react'
import { Chart } from '../Chart'
import type { Dataset } from '../../data/types'
import { diffRows, type ChangeRow } from '../../data/analytics'

interface Props {
  ds: Dataset
  start: string
  end: string
  dark: boolean
  onSelect: (code: string) => void
}

const toYi = (n: number) => +(n / 1e8).toFixed(2)
const fmtYi = (v: number) => (v > 0 ? '+' : '') + v.toFixed(2) + ' 億'

export function RangeRanking({ ds, start, end, dark, onSelect }: Props) {
  const { buys, sells } = useMemo(() => {
    const rows = diffRows(ds, start, end).filter((r) => r.dShares !== 0)
    const buys = rows.filter((r) => r.dShares > 0).sort((a, b) => b.dAmount - a.dAmount).slice(0, 15).reverse()
    const sells = rows.filter((r) => r.dShares < 0).sort((a, b) => a.dAmount - b.dAmount).slice(0, 15).reverse()
    return { buys, sells }
  }, [ds, start, end])

  const axis = dark ? '#9ca3af' : '#6b7280'
  const split = dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'

  const opt = (rows: ChangeRow[], color: string, title: string) => ({
    grid: { left: 90, right: 80, top: 34, bottom: 16 },
    title: { text: title, left: 0, top: 4, textStyle: { color: axis, fontSize: 13, fontWeight: 'normal' as const } },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      valueFormatter: (v: number) => fmtYi(v),
    },
    xAxis: { type: 'value', axisLabel: { color: axis, formatter: (v: number) => v.toFixed(0) + '億' }, splitLine: { lineStyle: { color: split } } },
    yAxis: { type: 'category', data: rows.map((r) => r.name), axisLabel: { color: axis } },
    series: [
      {
        type: 'bar',
        data: rows.map((r) => ({ value: toYi(r.dAmount), code: r.code })),
        itemStyle: { color, borderRadius: 3 },
        label: {
          show: true,
          position: 'right' as const,
          color: axis,
          formatter: (p: { value: number }) => fmtYi(p.value),
        },
      },
    ],
  })

  const onEvents = { click: (p: { data?: { code?: string } }) => p.data?.code && onSelect(p.data.code) }

  return (
    <div className="grid md:grid-cols-2 gap-3">
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3">
        <Chart option={opt(buys, '#e11d48', '加碼 Top 15（億元）')} style={{ height: 360 }} notMerge onEvents={onEvents} />
      </div>
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3">
        <Chart option={opt(sells, '#059669', '減碼 Top 15（億元）')} style={{ height: 360 }} notMerge onEvents={onEvents} />
      </div>
    </div>
  )
}
