import { useMemo, useState } from 'react'
import { Chart } from './Chart'
import type { Dataset } from '../data/types'
import { holdingsMap, tradingDates } from '../data/analytics'
import { useSectors } from '../data/useSectors'
import { DateControls } from './DateControls'
import { ChangeTable } from './ChangeTable'
import { RangeRanking } from './analysis/RangeRanking'
import { SectorView } from './analysis/SectorView'
import { Heatmap } from './analysis/Heatmap'
import { EventsTimeline } from './analysis/EventsTimeline'

interface Props {
  ds: Dataset
  dark: boolean
  onSelect: (code: string) => void
  isWatched: (code: string) => boolean
  onToggleWatch: (code: string) => void
}

export function AnalysisView({ ds, dark, onSelect, isWatched, onToggleWatch }: Props) {
  const dates = tradingDates(ds)
  const last = dates[dates.length - 1]
  const sectors = useSectors()
  // default range: ~last month
  const [start, setStart] = useState(dates[Math.max(0, dates.length - 21)])
  const [end, setEnd] = useState(last)

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3 flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium">區間分析</span>
        <DateControls dates={dates} baseDate={start} compareDate={end} onBase={setStart} onCompare={setEnd} />
        <span className="text-xs text-gray-400">選定區間套用到下方排行、完整清單與產業分布</span>
      </div>

      <Section title="區間加碼 / 減碼排行">
        <RangeRanking ds={ds} start={start} end={end} dark={dark} onSelect={onSelect} />
      </Section>

      <Section title="區間完整變化清單">
        <ChangeTable ds={ds} baseDate={start} compareDate={end} onSelect={onSelect} isWatched={isWatched} onToggleWatch={onToggleWatch} />
      </Section>

      <Section title="產業 / 類股分布">
        <SectorView ds={ds} sectors={sectors} start={start} end={end} dark={dark} />
      </Section>

      <Section title="每日持股變化熱力圖">
        <Heatmap ds={ds} dark={dark} onSelect={onSelect} />
      </Section>

      <Section title="新進 / 剔除事件時間軸">
        <EventsTimeline ds={ds} onSelect={onSelect} />
      </Section>

      <Section title="基金規模 / 集中度走勢（全期）">
        <FundTrends ds={ds} dark={dark} />
      </Section>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">{title}</h3>
      {children}
    </div>
  )
}

function FundTrends({ ds, dark }: { ds: Dataset; dark: boolean }) {
  const axis = dark ? '#9ca3af' : '#6b7280'
  const split = dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'
  const { dates, aum, nh, top10, hhi } = useMemo(() => {
    const dates = ds.fund_series.map((d) => d.date)
    const aum = ds.fund_series.map((d) => +(d.nav_total / 1e8).toFixed(1))
    const nh = ds.fund_series.map((d) => d.n_holdings)
    const top10: number[] = []
    const hhi: number[] = []
    for (const d of dates) {
      const w = [...holdingsMap(ds, d).values()].map((h) => h.weight).sort((a, b) => b - a)
      top10.push(+w.slice(0, 10).reduce((s, x) => s + x, 0).toFixed(1))
      hhi.push(Math.round(w.reduce((s, x) => s + x * x, 0)))
    }
    return { dates, aum, nh, top10, hhi }
  }, [ds])

  const aumOption = {
    grid: { left: 60, right: 55, top: 34, bottom: 50 },
    tooltip: { trigger: 'axis' },
    legend: { data: ['規模(億)', '持股檔數'], textStyle: { color: axis }, top: 4 },
    xAxis: { type: 'category', data: dates, axisLabel: { color: axis }, axisLine: { lineStyle: { color: split } } },
    yAxis: [
      { type: 'value', name: '億', nameTextStyle: { color: axis }, axisLabel: { color: axis }, splitLine: { lineStyle: { color: split } } },
      { type: 'value', name: '檔', position: 'right', nameTextStyle: { color: axis }, axisLabel: { color: axis }, splitLine: { show: false } },
    ],
    dataZoom: [{ type: 'inside' }, { type: 'slider', height: 16, bottom: 12 }],
    series: [
      { name: '規模(億)', type: 'line', smooth: true, showSymbol: false, areaStyle: { opacity: 0.08 }, data: aum, lineStyle: { color: '#6366f1' }, itemStyle: { color: '#6366f1' } },
      { name: '持股檔數', type: 'line', yAxisIndex: 1, step: 'end', showSymbol: false, data: nh, lineStyle: { color: '#10b981' }, itemStyle: { color: '#10b981' } },
    ],
  }

  const concOption = {
    grid: { left: 55, right: 55, top: 34, bottom: 50 },
    tooltip: { trigger: 'axis' },
    legend: { data: ['前10大權重(%)', 'HHI'], textStyle: { color: axis }, top: 4 },
    xAxis: { type: 'category', data: dates, axisLabel: { color: axis }, axisLine: { lineStyle: { color: split } } },
    yAxis: [
      { type: 'value', name: '%', nameTextStyle: { color: axis }, axisLabel: { color: axis }, splitLine: { lineStyle: { color: split } } },
      { type: 'value', name: 'HHI', position: 'right', nameTextStyle: { color: axis }, axisLabel: { color: axis }, splitLine: { show: false } },
    ],
    dataZoom: [{ type: 'inside' }, { type: 'slider', height: 16, bottom: 12 }],
    series: [
      { name: '前10大權重(%)', type: 'line', smooth: true, showSymbol: false, data: top10, lineStyle: { color: '#f59e0b' }, itemStyle: { color: '#f59e0b' } },
      { name: 'HHI', type: 'line', yAxisIndex: 1, smooth: true, showSymbol: false, data: hhi, lineStyle: { color: '#ef4444' }, itemStyle: { color: '#ef4444' } },
    ],
  }

  return (
    <div className="grid lg:grid-cols-2 gap-3">
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3">
        <Chart option={aumOption} style={{ height: 300 }} notMerge />
      </div>
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3">
        <Chart option={concOption} style={{ height: 300 }} notMerge />
      </div>
    </div>
  )
}
