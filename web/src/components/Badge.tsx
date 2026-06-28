import type { ChangeTag } from '../data/analytics'

const MAP: Record<ChangeTag, { label: string; cls: string }> = {
  new: { label: '🆕 新進', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' },
  exit: { label: '🚫 出清', cls: 'bg-gray-200 text-gray-600 dark:bg-gray-600/30 dark:text-gray-300' },
  up: { label: '▲ 增持', cls: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300' },
  down: { label: '▼ 減持', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' },
  flat: { label: '— 持平', cls: 'bg-gray-100 text-gray-400 dark:bg-gray-700/30 dark:text-gray-500' },
}

export function Badge({ tag }: { tag: ChangeTag }) {
  const m = MAP[tag]
  return (
    <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium whitespace-nowrap ${m.cls}`}>
      {m.label}
    </span>
  )
}
