import type { Order } from '../types'
import { dashboardPaymentSummary } from '../dashboardData'
import { useDashboardText } from '../dashboardText'
import { useI18n } from '../i18n'

export default function DashboardMoneyCell({ orders }: { orders: Order[] }) {
  const d = useDashboardText()
  const { lang } = useI18n()
  const summaries = dashboardPaymentSummary(orders)
  const money = (value: number) => new Intl.NumberFormat(lang === 'zh' ? 'zh-CN' : 'en-US', { maximumFractionDigits: 2 }).format(value)
  return <div className="dashboard-money-cell">{summaries.length ? summaries.map(summary => <div key={summary.currency} title={`${d('orderAverageHelp')} · ${summary.orders.length} ${d('paidOrders')}`}>
    <span>{money(summary.amount)} {summary.currency === '__unknown__' ? d('unknownCurrency') : summary.currency}</span>
    <small>AOV {money(summary.averagePerOrder || 0)}</small>
  </div>) : <div><span>0</span><small>AOV —</small></div>}</div>
}
