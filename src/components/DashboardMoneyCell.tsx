import type { Order } from '../types'
import { localPaymentSummary } from '../dashboardCurrency'
import { useDashboardText } from '../dashboardText'
import { useI18n } from '../i18n'
export default function DashboardMoneyCell({ orders, metric }: { orders:Order[]; metric?:'amount'|'averagePerOrder'|'averagePerUser' }) {
 const d=useDashboardText()
 const {lang}=useI18n()
 const summaries=localPaymentSummary(orders)
 const money=(value:number)=>new Intl.NumberFormat(lang==='zh'?'zh-CN':'en-US',{maximumFractionDigits:2}).format(value)
 return <div className="dashboard-money-cell">{summaries.length?summaries.map(s=><div key={s.currency} title={`${d(metric==='averagePerUser'?'averageHelp':'orderAverageHelp')} · ${s.orders.length} ${d('paidOrders')}`}>
  <span className="dashboard-money-number"><span className="dashboard-money-amount">{s[metric||'amount']===null?'—':money(s[metric||'amount']!)}</span> <span className="dashboard-money-currency">{s.currency==='__unknown__'?d('unknownCurrency'):s.currency}</span></span>
  {!metric&&<small>AOV {s.averagePerOrder===null?'—':money(s.averagePerOrder)}</small>}
 </div>):<div><span className="dashboard-money-amount">{metric&&metric!=='amount'?'—':'0'}</span>{!metric&&<small>AOV —</small>}</div>}</div>
}
