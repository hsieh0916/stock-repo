interface Props {
  dates: string[]
  baseDate: string
  compareDate: string
  onBase: (d: string) => void
  onCompare: (d: string) => void
}

export function DateControls({ dates, baseDate, compareDate, onBase, onCompare }: Props) {
  // base must be strictly before compare
  const compareIdx = dates.indexOf(compareDate)
  const baseOptions = dates.filter((_, i) => i < compareIdx)
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <label className="flex items-center gap-1.5">
        <span className="text-gray-500 dark:text-gray-400">基準日</span>
        <select
          value={baseDate}
          onChange={(e) => onBase(e.target.value)}
          className="rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1"
        >
          {baseOptions.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
      </label>
      <span className="text-gray-400">→</span>
      <label className="flex items-center gap-1.5">
        <span className="text-gray-500 dark:text-gray-400">比較日</span>
        <select
          value={compareDate}
          onChange={(e) => onCompare(e.target.value)}
          className="rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1"
        >
          {dates.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
      </label>
    </div>
  )
}
