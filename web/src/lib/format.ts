export const fmtInt = (n: number) => Math.round(n).toLocaleString('en-US')

export const fmtSigned = (n: number) =>
  (n > 0 ? '+' : '') + Math.round(n).toLocaleString('en-US')

export const fmtLots = (n: number) =>
  n.toLocaleString('en-US', { maximumFractionDigits: 0 })

export const fmtSignedLots = (n: number) =>
  (n > 0 ? '+' : '') + n.toLocaleString('en-US', { maximumFractionDigits: 0 })

export const fmtPct = (n: number, d = 2) => n.toFixed(d) + '%'

export const fmtSignedPct = (n: number, d = 2) =>
  (n > 0 ? '+' : '') + n.toFixed(d) + '%'

export const fmtYi = (n: number) =>
  (n / 1e8).toLocaleString('en-US', { maximumFractionDigits: 1 }) + ' 億'

export const fmtSignedYi = (n: number) =>
  (n > 0 ? '+' : '') + (n / 1e8).toLocaleString('en-US', { maximumFractionDigits: 1 }) + ' 億'

/** Taiwan convention: up = red, down = green. */
export const upDown = (n: number) =>
  n > 0
    ? 'text-rose-600 dark:text-rose-400'
    : n < 0
      ? 'text-emerald-600 dark:text-emerald-400'
      : 'text-gray-400 dark:text-gray-500'

export const rocDate = (iso: string) => iso // keep ISO; placeholder if 民國 needed later
