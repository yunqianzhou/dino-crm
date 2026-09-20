import type { Order } from './types'
import { dashboardPaymentSummary } from './dashboardData'

/** Ant Table reverses comparators for descending; keep unavailable values last either way. */
export function dashboardNumberCompare(a: number | null, b: number | null, order?: 'ascend' | 'descend' | null) {
  if (a === null && b === null) return 0
  if (a === null) return order === 'descend' ? -1 : 1
  if (b === null) return order === 'descend' ? 1 : -1
  return a - b
}
export function dashboardMoneyValue(orders: Order[], currency: string, metric: 'amount' | 'averagePerOrder') {
  const summary = dashboardPaymentSummary(orders).find(row => row.currency === currency)
  return summary ? summary[metric] : metric === 'amount' ? 0 : null
}
