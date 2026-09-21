import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import type { Order } from './types'
dayjs.extend(utc)
export type OrderFilters5 = {
  product?: string; cc?: string; currency?: string
  dateField: 'paidTime' | 'createdTime' | 'validUntil'; from?: string; to?: string
}
export const emptyOrderFilters5: OrderFilters5 = { dateField: 'paidTime' }
export function orderCreatedTime(order: Order) {
  return order.transactions.map(transaction => transaction.time).filter(Boolean).sort()[0]
}
export function matchesOrderFilters5(order: Order, filters: OrderFilters5, owner?: string) {
  if (filters.product && order.productName !== filters.product) return false
  if (filters.cc && filters.cc !== (owner || '__unassigned__')) return false
  if (filters.currency && order.currency !== filters.currency) return false
  if (filters.from || filters.to) {
    const value = filters.dateField === 'createdTime' ? orderCreatedTime(order) : order[filters.dateField]
    if (!value || !dayjs.utc(value).isValid()) return false
    const date = dayjs.utc(value).utcOffset(480).format('YYYY-MM-DD')
    if (filters.from && date < filters.from) return false
    if (filters.to && date > filters.to) return false
  }
  return true
}
export const orderTime5 = (value?: string) => value ? dayjs.utc(value).utcOffset(480).format('YYYY-MM-DD HH:mm') : '—'
