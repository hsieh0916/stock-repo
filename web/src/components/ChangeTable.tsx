import { useMemo, useState } from 'react'
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from '@tanstack/react-table'
import type { Dataset } from '../data/types'
import { diffRows, type ChangeRow, type ChangeTag } from '../data/analytics'
import { Badge } from './Badge'
import {
  fmtLots,
  fmtPct,
  fmtSignedLots,
  fmtSignedPct,
  upDown,
} from '../lib/format'

type Mode = 'all' | 'up' | 'down' | 'new' | 'exit'

interface Props {
  ds: Dataset
  baseDate: string
  compareDate: string
  onSelect: (code: string) => void
  isWatched: (code: string) => boolean
  onToggleWatch: (code: string) => void
}

const MODES: { key: Mode; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'up', label: '增持' },
  { key: 'down', label: '減持' },
  { key: 'new', label: '新進' },
  { key: 'exit', label: '出清' },
]

const ch = createColumnHelper<ChangeRow>()

export function ChangeTable({ ds, baseDate, compareDate, onSelect, isWatched, onToggleWatch }: Props) {
  const [mode, setMode] = useState<Mode>('all')
  const [query, setQuery] = useState('')
  const [sorting, setSorting] = useState<SortingState>([{ id: 'weight', desc: true }])

  const allRows = useMemo(
    () => diffRows(ds, baseDate, compareDate),
    [ds, baseDate, compareDate],
  )

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return allRows.filter((r) => {
      if (mode !== 'all' && r.tag !== mode) return false
      if (q && !(r.code.toLowerCase().includes(q) || r.name.toLowerCase().includes(q))) return false
      return true
    })
  }, [allRows, mode, query])

  const columns = useMemo(
    () => [
      ch.display({
        id: 'watch',
        header: '',
        cell: (c) => {
          const code = c.row.original.code
          const on = isWatched(code)
          return (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onToggleWatch(code)
              }}
              className={on ? 'text-amber-400' : 'text-gray-300 dark:text-gray-600 hover:text-amber-400'}
              title="加入/移除關注"
            >
              ★
            </button>
          )
        },
      }),
      ch.accessor('code', {
        header: '代號',
        cell: (c) => <span className="font-mono text-xs text-gray-500">{c.getValue()}</span>,
      }),
      ch.accessor('name', { header: '名稱', cell: (c) => <span className="font-medium">{c.getValue()}</span> }),
      ch.accessor('tag', {
        header: '標記',
        cell: (c) => <Badge tag={c.getValue() as ChangeTag} />,
      }),
      ch.accessor('price', {
        header: '購入金額',
        cell: (c) => <span className="tabular-nums">{Math.round(c.getValue()).toLocaleString('en-US')} 元</span>,
      }),
      ch.accessor('shares', {
        header: '今日張數',
        cell: (c) => <span className="tabular-nums">{fmtLots(c.getValue() / 1000)}</span>,
      }),
      ch.accessor('dLots', {
        header: 'Δ張數',
        sortingFn: (a, b) => Math.abs(a.original.dLots) - Math.abs(b.original.dLots),
        cell: (c) => <span className={`tabular-nums ${upDown(c.getValue())}`}>{fmtSignedLots(c.getValue())}</span>,
      }),
      ch.accessor('weight', {
        header: '今日權重',
        cell: (c) => <span className="tabular-nums">{fmtPct(c.getValue())}</span>,
      }),
      ch.accessor('dWeight', {
        header: 'Δ權重',
        sortingFn: (a, b) => Math.abs(a.original.dWeight) - Math.abs(b.original.dWeight),
        cell: (c) => <span className={`tabular-nums ${upDown(c.getValue())}`}>{fmtSignedPct(c.getValue())}</span>,
      }),
    ],
    [isWatched, onToggleWatch],
  )

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  function exportCsv() {
    const header = ['代號', '名稱', '標記', '今日張數', 'Δ張數', '今日權重%', 'Δ權重%', 'Δ金額']
    const tagText: Record<ChangeTag, string> = { new: '新進', exit: '出清', up: '增持', down: '減持', flat: '持平' }
    const lines = table.getSortedRowModel().rows.map((r) => {
      const d = r.original
      return [d.code, d.name, tagText[d.tag], (d.shares / 1000).toFixed(0), d.dLots, d.weight, d.dWeight.toFixed(3), d.dAmount].join(',')
    })
    const csv = '﻿' + [header.join(','), ...lines].join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `${ds.fund.code}_持股變化_${baseDate}_${compareDate}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
      {/* controls */}
      <div className="flex flex-wrap items-center gap-3 p-3 border-b border-gray-100 dark:border-gray-800">

        <div className="inline-flex rounded-md border border-gray-300 dark:border-gray-700 overflow-hidden text-sm">
          {MODES.map((m) => (
            <button
              key={m.key}
              onClick={() => setMode(m.key)}
              className={`px-2.5 py-1 ${mode === m.key ? 'bg-gray-800 text-white dark:bg-gray-200 dark:text-gray-900' : 'bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
            >
              {m.label}
            </button>
          ))}
        </div>

        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜尋代號/名稱"
          className="rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1 text-sm w-36"
        />

        <div className="ml-auto flex items-center gap-3">
          <span className="text-sm text-gray-500 dark:text-gray-400">{rows.length} 檔</span>
          <button
            onClick={exportCsv}
            className="rounded-md bg-emerald-600 text-white px-2.5 py-1 text-sm hover:bg-emerald-700"
          >
            匯出 CSV
          </button>
        </div>
      </div>

      {/* table */}
      <div className="overflow-x-auto thin-scroll">
        <table className="w-full text-sm">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-800">
                {hg.headers.map((h) => (
                  <th
                    key={h.id}
                    onClick={h.column.getToggleSortingHandler()}
                    className={`px-3 py-2 font-medium whitespace-nowrap ${h.column.getCanSort() ? 'cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200' : ''}`}
                  >
                    {flexRender(h.column.columnDef.header, h.getContext())}
                    {{ asc: ' ▲', desc: ' ▼' }[h.column.getIsSorted() as string] ?? ''}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((r) => (
              <tr
                key={r.id}
                onClick={() => onSelect(r.original.code)}
                className="border-b border-gray-50 dark:border-gray-800/60 hover:bg-indigo-50/50 dark:hover:bg-indigo-500/10 cursor-pointer"
              >
                {r.getVisibleCells().map((c) => (
                  <td key={c.id} className="px-3 py-1.5 whitespace-nowrap">
                    {flexRender(c.column.columnDef.cell, c.getContext())}
                  </td>
                ))}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-3 py-8 text-center text-gray-400">
                  此門檻/條件下沒有符合的變化
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="px-3 py-2 text-xs text-gray-400 dark:text-gray-500">
        ⚠️ 股數變化未必等於買賣，亦可能來自除權息／減資／股票分割等股本變動；大量申購會使多數個股同步增持，建議搭配「權重視角」判讀經理人意圖。1 張 = 1,000 股。
      </p>
    </div>
  )
}
