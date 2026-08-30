// Shape of /public/dataset.json produced by pipeline/backfill.py

export interface AssetAllocation {
  stock: number // % of NAV
  futures: number // % of NAV (0 when the source doesn't separate it out)
  cash_other: number // % of NAV; residual bucket for cash + anything unclassified
}

export interface FundDay {
  date: string // YYYY-MM-DD
  nav_total: number // 基金資產淨值
  units: number // 在外流通單位數
  nav_per_unit: number // 每單位淨值
  n_holdings: number
  allocation?: AssetAllocation
}

// [code, shares, amount, weight]
export type HoldingRow = [string, number, number, number]

export interface Dataset {
  fund: { code: string; name: string }
  generated_dates: { first: string; last: string; count: number }
  columns: string[]
  securities: Record<string, string> // code -> name
  fund_series: FundDay[]
  holdings_by_date: Record<string, HoldingRow[]>
}
