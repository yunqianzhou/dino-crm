import type { Order } from './types'
import { dashboardPaymentSummary } from './dashboardData'

/** Use recorded local amounts. Different currencies must never be added together. */
export function localPaymentSummary(orders: Order[]) {
 return dashboardPaymentSummary(orders).map(row => row.currency === '__unknown__'
  ? {...row, amount: null, averagePerOrder: null, averagePerUser: null}
  : row)
}
export function localMoneySortable(orders: Order[]) {
 const rows = localPaymentSummary(orders)
 return !rows.length || (rows.length === 1 && rows[0].currency !== '__unknown__')
}
export function localMoneySortValue(orders: Order[], metric: 'amount'|'averagePerOrder'|'averagePerUser') {
 const rows = localPaymentSummary(orders)
 if (!rows.length) return metric === 'amount' ? 0 : null
 return rows.length === 1 ? rows[0][metric] : null
}
export const currencyExportHeaders = ['Currency', 'Paid amount']
export function currencyExportRow(order: Order) {
 return [order.currency?.trim() || 'Currency not recorded', order.paidAmount]
}
