import ReactEChartsCore from 'echarts-for-react/esm/core'
import type { CSSProperties } from 'react'
import echarts from '../lib/echarts'

// Thin wrapper around echarts-for-react's core build, wired to our tree-shaken
// echarts instance. Drop-in replacement for the default echarts-for-react export.
interface Props {
  option: object
  style?: CSSProperties
  notMerge?: boolean
  onEvents?: Record<string, (params: any) => void>
}

export function Chart({ option, style, notMerge, onEvents }: Props) {
  return <ReactEChartsCore echarts={echarts} option={option} style={style} notMerge={notMerge} onEvents={onEvents} />
}
