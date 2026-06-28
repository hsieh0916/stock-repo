import { useMemo } from 'react'
import { Chart } from '../Chart'
import type { Dataset } from '../../data/types'
import { holdingsMap, tradingDates } from '../../data/analytics'

interface Props {
  ds: Dataset
  dark: boolean
  onSelect: (code: string) => void
}

const TOP_N = 40

export function Heatmap({ ds, dark, onSelect }: Props) {
  const { dates, codes, names, data, maxAbs } = useMemo(() => {
    const dates = tradingDates(ds)
    const last = dates[dates.length - 1]
    const latest = [...holdingsMap(ds, last).entries()]
      .sort((a, b) => b[1].weight - a[1].weight)
      .slice(0, TOP_N)
    const codes = latest.map(([c]) => c)
    const names = codes.map((c) => ds.securities[c] ?? c)
    const maps = dates.map((d) => holdingsMap(ds, d))
    const data: [number, number, number][] = []
    let maxAbs = 1
    codes.forEach((code, y) => {
      let prev = 0
      dates.forEach((_, x) => {
        const sh = maps[x].get(code)?.shares ?? 0
        const dLots = (sh - prev) / 1000
        prev = sh
        if (dLots !== 0) {
          data.push([x, y, Math.round(dLots)])
          maxAbs = Math.max(maxAbs, Math.abs(dLots))
        }
      })
    })
    return { dates, codes, names, data, maxAbs }
  }, [ds])

  const axis = dark ? '#9ca3af' : '#6b7280'
  const cap = Math.min(maxAbs, 500) // clip extreme inception-period values for contrast

  const option = {
    grid: { left: 70, right: 16, top: 10, bottom: 70 },
    tooltip: {
      position: 'top',
      formatter: (p: { data: [number, number, number] }) =>
        `${names[p.data[1]]}<br/>${dates[p.data[0]]}: ${p.data[2] > 0 ? '+' : ''}${p.data[2].toLocaleString()} 張`,
    },
    xAxis: { type: 'category', data: dates, axisLabel: { color: axis, interval: Math.floor(dates.length / 12) }, splitArea: { show: false } },
    yAxis: { type: 'category', data: names, axisLabel: { color: axis, fontSize: 10 } },
    visualMap: {
      min: -cap, max: cap, calculable: true, orient: 'horizontal', left: 'center', bottom: 6,
      inRange: { color: ['#059669', '#a7f3d0', '#f8fafc', '#fecaca', '#e11d48'] },
      textStyle: { color: axis }, text: ['加碼', '減碼'],
    },
    dataZoom: [{ type: 'inside', xAxisIndex: 0 }, { type: 'slider', xAxisIndex: 0, height: 14, bottom: 40 }],
    series: [{ type: 'heatmap', data, progressive: 2000, itemStyle: { borderColor: dark ? '#0a0a0a' : '#fff', borderWidth: 0.5 } }],
  }

  const onEvents = { click: (p: { data: [number, number, number] }) => onSelect(codes[p.data[1]]) }

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3">
      <div className="text-sm font-medium mb-2">每日持股變化熱力圖（前 {TOP_N} 大持股 × 全期；紅=加碼、綠=減碼）</div>
      <Chart option={option} style={{ height: 760 }} notMerge onEvents={onEvents} />
      <p className="text-xs text-gray-400 mt-1">色階上限裁切於 ±{cap} 張以保留對比；點格子可開個股明細。</p>
    </div>
  )
}
