import { useMemo } from 'react'
import { Chart } from './Chart'
import type { Dataset } from '../data/types'
import { stockSeries, stockSummary } from '../data/analytics'
import { usePrices } from '../data/usePrices'
import { useAllEtfWeights } from '../data/useAllEtfWeights'
import { fmtInt, fmtLots, fmtPct, fmtSignedLots, upDown } from '../lib/format'

interface Props {
  ds: Dataset
  code: string
  dark: boolean
  isWatched: (c: string) => boolean
  onToggleWatch: (c: string) => void
  onClose: () => void
}

export function StockDetail({ ds, code, dark, isWatched, onToggleWatch, onClose }: Props) {
  const name = ds.securities[code] ?? code
  const marketPrices = usePrices()
  const etfWeights = useAllEtfWeights(code)
  const full = useMemo(() => stockSeries(ds, code), [ds, code])
  const summary = useMemo(() => stockSummary(full), [full])

  // trim leading days before first appearance for cleaner charts
  const startIdx = summary.firstDate ? full.findIndex((p) => p.date === summary.firstDate) : 0
  const series = full.slice(Math.max(0, startIdx))

  const axis = dark ? '#9ca3af' : '#6b7280'
  const split = dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'
  const dates = series.map((p) => p.date)

  const prices = series.map((p) => (p.shares > 0 ? p.amount : null))

  // average cost basis: resets on exit, increases on buy (weighted avg), unchanged on sell
  const costBasis = useMemo(() => {
    const out: (number | null)[] = []
    let cost = 0
    let prevShares = 0
    for (const p of series) {
      if (p.shares === 0) {
        cost = 0; prevShares = 0; out.push(null)
      } else {
        const px = p.amount
        if (prevShares === 0) {
          cost = px
        } else if (p.shares > prevShares) {
          cost = (prevShares * cost + (p.shares - prevShares) * px) / p.shares
        }
        out.push(+cost.toFixed(2))
        prevShares = p.shares
      }
    }
    return out
  }, [series])

  const estimatedPrice = prices[prices.length - 1]           // amount/shares from PCF
  const twsePrice = marketPrices[code] ?? null               // TWSE/TPEX actual close
  const currentPrice = twsePrice ?? estimatedPrice           // prefer actual
  const lastCost = costBasis[costBasis.length - 1]
  const unrealizedPct = currentPrice && lastCost && lastCost > 0 ? (currentPrice - lastCost) / lastCost * 100 : null

  const lotsOption = {
    grid: { left: 55, right: 110, top: 34, bottom: 64 },
    tooltip: { trigger: 'axis' },
    legend: { data: ['持股(張)', '權重(%)', '股價(元)', '持有成本(元)'], textStyle: { color: axis }, top: 4 },
    xAxis: { type: 'category', data: dates, axisLabel: { color: axis }, axisLine: { lineStyle: { color: split } } },
    yAxis: [
      { type: 'value', name: '張', nameTextStyle: { color: axis }, axisLabel: { color: axis }, splitLine: { lineStyle: { color: split } } },
      { type: 'value', name: '%', position: 'right', nameTextStyle: { color: axis }, axisLabel: { color: axis }, splitLine: { show: false } },
      { type: 'value', name: '元', position: 'right', offset: 55, nameTextStyle: { color: axis }, axisLabel: { color: axis, formatter: (v: number) => v >= 1000 ? (v / 1000).toFixed(1) + 'K' : String(v) }, splitLine: { show: false } },
    ],
    dataZoom: [{ type: 'inside' }, { type: 'slider', height: 18, bottom: 18 }],
    series: [
      { name: '持股(張)', type: 'line', smooth: true, showSymbol: false, data: series.map((p) => Math.round(p.lots)), areaStyle: { opacity: 0.08 }, lineStyle: { color: '#6366f1' }, itemStyle: { color: '#6366f1' } },
      { name: '權重(%)', type: 'line', yAxisIndex: 1, showSymbol: false, data: series.map((p) => p.weight), lineStyle: { color: '#f59e0b' }, itemStyle: { color: '#f59e0b' } },
      { name: '股價(元)', type: 'line', yAxisIndex: 2, showSymbol: false, data: prices, lineStyle: { color: '#10b981', width: 1.5 }, itemStyle: { color: '#10b981' } },
      { name: '持有成本(元)', type: 'line', yAxisIndex: 2, showSymbol: false, data: costBasis, lineStyle: { color: '#f97316', width: 1.5, type: 'dashed' }, itemStyle: { color: '#f97316' } },
    ],
  }

  const flowOption = {
    grid: { left: 55, right: 20, top: 20, bottom: 64 },
    tooltip: { trigger: 'axis', valueFormatter: (v: number) => fmtSignedLots(v) + ' 張' },
    xAxis: { type: 'category', data: dates, axisLabel: { color: axis }, axisLine: { lineStyle: { color: split } } },
    yAxis: { type: 'value', name: '張', nameTextStyle: { color: axis }, axisLabel: { color: axis }, splitLine: { lineStyle: { color: split } } },
    dataZoom: [{ type: 'inside' }, { type: 'slider', height: 18, bottom: 18 }],
    series: [
      {
        type: 'bar',
        data: series.map((p) => ({
          value: Math.round(p.dLots),
          itemStyle: { color: p.dLots >= 0 ? '#e11d48' : '#059669' },
        })),
      },
    ],
  }

  const recent = [...series].reverse().slice(0, 20)

  function exportCsv() {
    const header = ['日期', '股數', '張數', 'Δ股數', 'Δ張數', '權重%', '購入金額(元)', '持有成本(元)']
    const lines = series.map((p, i) => [p.date, p.shares, Math.round(p.lots), p.dShares, p.dLots, p.weight, prices[i] ?? '', costBasis[i] ?? ''].join(','))
    const csv = '﻿' + [header.join(','), ...lines].join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `00991A_${code}_${name}_持股歷史.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="fixed inset-0 z-30 bg-black/40 flex justify-end" onClick={onClose}>
      <div
        className="w-full max-w-3xl h-full overflow-y-auto thin-scroll bg-gray-50 dark:bg-gray-950 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div className="sticky top-0 z-10 bg-white/90 dark:bg-gray-900/90 backdrop-blur border-b border-gray-200 dark:border-gray-800 px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => onToggleWatch(code)}
            className={isWatched(code) ? 'text-amber-400 text-lg' : 'text-gray-300 dark:text-gray-600 hover:text-amber-400 text-lg'}
            title="加入/移除關注"
          >
            ★
          </button>
          <span className="font-mono text-sm text-gray-500">{code}</span>
          <span className="text-lg font-bold">{name}</span>
          {[
            { label: 'Goodinfo', href: `https://goodinfo.tw/tw/StockDetail.asp?STOCK_ID=${code}` },
            { label: 'TradingView', href: `https://www.tradingview.com/symbols/TWSE-${code}/` },
            { label: '玩股網', href: `https://www.wantgoo.com/stock/${code}` },
            { label: '財報狗', href: `https://statementdog.com/analysis/${code}` },
            { label: '嗨投資', href: `https://histock.tw/stock/${code}` },
          ].map(({ label, href }) => (
            <a key={label} href={href} target="_blank" rel="noreferrer"
              className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline">
              {label} ↗
            </a>
          ))}
          <button onClick={onClose} className="ml-auto rounded-md px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-800">✕</button>
        </div>

        <div className="p-4 space-y-4">
          {/* stat strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
            <Stat label="目前持股" value={`${fmtLots(summary.currentLots)} 張`} sub={`${fmtInt(summary.currentShares)} 股`} />
            <Stat label="目前權重" value={fmtPct(summary.currentWeight)} />
            <Stat label="持有天數" value={`${summary.heldDays} 天`} sub={summary.everExited ? '曾出清再買回' : undefined} />
            <Stat
              label="連續變動"
              value={summary.streak === 0 ? '—' : `${Math.abs(summary.streak)} 天 ${summary.streak > 0 ? '增持' : '減持'}`}
              valueCls={upDown(summary.streak)}
            />
            <Stat label="首次進場" value={summary.firstDate ?? '—'} />
            <Stat label="最大單日變動" value={`${fmtSignedLots(summary.maxDayLots)} 張`} valueCls={upDown(summary.maxDayLots)} />
            <Stat
              label={twsePrice ? '目前股價 (TWSE)' : '目前股價 (估)'}
              value={currentPrice ? `${currentPrice.toLocaleString()} 元` : '—'}
            />
            <Stat label="持有成本" value={lastCost ? `${lastCost.toLocaleString()} 元` : '—'} />
            <Stat
              label="含報酬"
              value={unrealizedPct != null ? `${unrealizedPct > 0 ? '+' : ''}${unrealizedPct.toFixed(2)}%` : '—'}
              valueCls={unrealizedPct != null ? upDown(unrealizedPct) : undefined}
            />
          </div>

          <Panel title="七大主動 ETF 持股概況">
            {etfWeights.length === 0 ? (
              <div className="text-xs text-gray-400 py-2">載入中…</div>
            ) : (
              <div className="overflow-x-auto thin-scroll">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-800">
                      <th className="px-2 py-1.5 font-medium">ETF</th>
                      <th className="px-2 py-1.5 font-medium">名稱</th>
                      <th className="px-2 py-1.5 font-medium text-right">增減(張)</th>
                      <th className="px-2 py-1.5 font-medium text-right">權重</th>
                    </tr>
                  </thead>
                  <tbody>
                    {etfWeights.map((r) => {
                      const isCurrent = r.etfCode === ds.fund.code
                      const held = r.weight != null && r.weight > 0
                      const dim = 'text-gray-400 dark:text-gray-600'
                      return (
                        <tr
                          key={r.etfCode}
                          className={`border-b border-gray-50 dark:border-gray-800/60 ${isCurrent ? 'bg-indigo-50 dark:bg-indigo-950/30' : ''}`}
                        >
                          <td className={`px-2 py-1.5 font-mono text-xs ${held ? '' : dim}`}>
                            {r.etfCode}
                          </td>
                          <td className={`px-2 py-1.5 text-xs ${held ? '' : dim}`}>
                            {r.etfName}
                          </td>
                          <td className={`px-2 py-1.5 text-right tabular-nums ${r.dLots != null && r.dLots !== 0 ? upDown(r.dLots) : dim}`}>
                            {r.dLots != null && r.dLots !== 0 ? fmtSignedLots(r.dLots) : '—'}
                          </td>
                          <td className={`px-2 py-1.5 text-right tabular-nums font-medium ${held ? 'text-indigo-600 dark:text-indigo-400' : dim}`}>
                            {r.weight != null ? fmtPct(r.weight) : '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <Panel title="持股張數走勢 ＆ 權重 ＆ 股價">
            <Chart option={lotsOption} style={{ height: 280 }} notMerge />
          </Panel>

          <Panel title="每日買賣超（張）">
            <Chart option={flowOption} style={{ height: 220 }} notMerge />
          </Panel>

          <Panel
            title="逐日明細（近 20 日）"
            action={
              <button onClick={exportCsv} className="rounded-md bg-emerald-600 text-white px-2 py-0.5 text-xs hover:bg-emerald-700">
                匯出全期 CSV
              </button>
            }
          >
            <div className="overflow-x-auto thin-scroll">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-800">
                    <th className="px-2 py-1.5 font-medium">日期</th>
                    <th className="px-2 py-1.5 font-medium text-right">張數</th>
                    <th className="px-2 py-1.5 font-medium text-right">Δ張數</th>
                    <th className="px-2 py-1.5 font-medium text-right">權重</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((p) => (
                    <tr key={p.date} className="border-b border-gray-50 dark:border-gray-800/60">
                      <td className="px-2 py-1 font-mono text-xs">{p.date}</td>
                      <td className="px-2 py-1 text-right tabular-nums">{fmtLots(p.lots)}</td>
                      <td className={`px-2 py-1 text-right tabular-nums ${upDown(p.dLots)}`}>{p.dLots === 0 ? '—' : fmtSignedLots(p.dLots)}</td>
                      <td className="px-2 py-1 text-right tabular-nums">{fmtPct(p.weight)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value, sub, valueCls }: { label: string; value: React.ReactNode; sub?: string; valueCls?: string }) {
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-2">
      <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
      <div className={`font-semibold tabular-nums ${valueCls ?? ''}`}>{value}</div>
      {sub && <div className="text-xs text-gray-400">{sub}</div>}
    </div>
  )
}

function Panel({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3">
      <div className="flex items-center mb-2">
        <div className="text-sm font-medium">{title}</div>
        {action && <div className="ml-auto">{action}</div>}
      </div>
      {children}
    </div>
  )
}
