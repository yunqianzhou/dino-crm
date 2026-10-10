import type { Order } from './types'
import { l2s, type PeopleMetrics } from './dashboard43'
import { inDashboardRange } from './dashboardData'
import { localPaymentSummary } from './dashboardCurrency'

export type ExportMetricRow = { name: string; metrics: PeopleMetrics; activityDate?: string; children?: ExportMetricRow[] }
type Text = (zh: string, en: string) => string
export const exportRate = (value: number | null) => value === null ? '—' : `${Number(value.toFixed(1))}%`
const amount = (value: number | null) => value === null ? '—' : Number(value.toFixed(2))

/** Split the page's amount/AOV cell into numeric columns without changing its population. */
export function exportMoney(orders: Order[], text: Text, perUser = false): unknown[][] {
 const summaries = localPaymentSummary(orders)
 return summaries.length ? summaries.map(s => [s.currency === '__unknown__' ? text('币种未填写', 'Currency not recorded') : s.currency, amount(s.amount), amount(s.averagePerOrder), ...(perUser ? [amount(s.averagePerUser)] : [])]) : [['—', 0, '—', ...(perUser ? ['—'] : [])]]
}

/** Export all page groups, including collapsed children and groups on other pages. */
export function exportMetricTable({ rows, total, keys, primary, text, orders, conversion = false, currentKeys = [], datedCurrent = false }: {
 rows: ExportMetricRow[]; total: PeopleMetrics; keys: readonly string[]; primary: 'date' | 'cc'; text: Text
 orders?: Order[]; conversion?: boolean; currentKeys?: readonly string[]; datedCurrent?: boolean
}): unknown[][] {
 const values = (metrics: PeopleMetrics, date?: string) => {
  const ids = new Set((metrics.leads || metrics.paid || []).map(s => s.studentId))
  const paid = (orders || []).filter(o => ids.has(o.studentId) && (!date || inDashboardRange(o.paidTime, date, date)))
  const counts = keys.map(key => date && !datedCurrent && currentKeys.includes(key) ? '—' : (metrics[key] || []).length)
  return (orders ? exportMoney(paid, text) : [[]]).map(money => [...counts, ...(conversion ? [exportRate(l2s(metrics))] : []), ...money])
 }
 const result = values(total).map(v => [text('合计（去重）', 'Total (unique users)'), text('所选范围', 'Selected scope'), text('所选范围', 'Selected scope'), ...v])
 const dimensions = (first: string, second = '—') => primary === 'date' ? [first, second] : [second, first]
 for (const row of rows) {
  result.push(...values(row.metrics, row.activityDate).map(v => [text('一级分组', 'Primary group'), ...dimensions(row.name), ...v]))
  for (const child of row.children || []) result.push(...values(child.metrics, child.activityDate).map(v => [text('二级分组', 'Secondary group'), ...dimensions(row.name, child.name), ...v]))
 }
 return result
}

export const exportGroupHeaders = (dateTitle: string, text: Text) => [text('行类型', 'Row type'), dateTitle, text('当前 CC', 'Current CC')]
export const exportMoneyHeaders = (text: Text, perUser = false) => [text('币种', 'Currency'), text('实付金额', 'Amount paid'), text('平均订单金额（AOV）', 'Average order value (AOV)'), ...(perUser ? [text('人均支付金额', 'Amount per payer')] : [])]
