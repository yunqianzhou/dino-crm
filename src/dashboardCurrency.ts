import { LINE_CURRENCY, type BusinessLine, type Order } from './types'

export type DashboardCurrencyMode = 'local' | 'USD'
// Synthetic prototype fixtures, not market quotes. Production must provide a versioned rate table.
export const DASHBOARD_FX_VERSION = 'demo-2026-10-09'
export const DASHBOARD_FX: Record<string, number> = { USD:1, VND:25000, KRW:1400, MYR:4.5, IDR:16000, THB:35, SGD:1.35, SAR:3.75 }
export type CurrencyTargets = Record<string, string | undefined>
export const localCurrency = (line: string) => LINE_CURRENCY[line as BusinessLine]?.code
export function convertedPayment(order: Order, mode: DashboardCurrencyMode, targets: CurrencyTargets, rates = DASHBOARD_FX) {
  const source = order.currency?.trim().toUpperCase() || '__unknown__'
  const currency = mode === 'USD' ? 'USD' : targets[order.studentId] || '__unknown__'
  const rate = source === currency && source !== '__unknown__' ? 1 : Number.isFinite(rates[source]) && rates[source] > 0 && Number.isFinite(rates[currency]) && rates[currency] > 0 ? rates[currency] / rates[source] : null
  return {order,currency,source,rate,amount:rate === null ? null : order.paidAmount * rate}
}
export function convertedSummary(orders: Order[], mode: DashboardCurrencyMode, targets: CurrencyTargets, rates = DASHBOARD_FX) {
  const values = orders.map(o=>convertedPayment(o,mode,targets,rates))
  return [...new Set(values.map(v=>v.currency))].sort().map(currency=>{
    const rows=values.filter(v=>v.currency===currency)
    const missing=rows.filter(v=>v.amount===null).length
    const amount=missing ? null : rows.reduce((n,v)=>n+v.amount!,0)
    const users=new Set(rows.map(v=>v.order.studentId)).size
    return {currency,orders:rows.map(v=>v.order),users,missing,amount,averagePerOrder:amount===null?null:amount/rows.length,averagePerUser:amount===null?null:amount/users}
  })
}
export function convertedSortValue(orders: Order[], mode: DashboardCurrencyMode, targets: CurrencyTargets, metric: 'amount'|'averagePerOrder'|'averagePerUser') {
  const summaries=convertedSummary(orders,mode,targets)
  if (!summaries.length) return metric==='amount'?0:null
  // Local currencies cannot form a single comparable monetary value.
  return summaries.length===1 ? summaries[0][metric] : null
}
