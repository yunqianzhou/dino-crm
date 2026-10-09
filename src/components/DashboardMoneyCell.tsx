import type { Order } from '../types'
import { useDashboardCurrency } from './DashboardCurrency'
import { useDashboardText } from '../dashboardText'
import { useI18n } from '../i18n'
export default function DashboardMoneyCell({ orders, metric }: { orders:Order[]; metric?:'amount'|'averagePerOrder'|'averagePerUser' }) {
 const d=useDashboardText()
 const {lang}=useI18n()
 const {summary}=useDashboardCurrency()
 const summaries=summary(orders)
 const money=(value:number)=>new Intl.NumberFormat(lang==='zh'?'zh-CN':'en-US',{maximumFractionDigits:2}).format(value)
 return <div className="dashboard-money-cell">{summaries.length?summaries.map(s=><div key={s.currency} title={`${d(metric==='averagePerUser'?'averageHelp':'orderAverageHelp')} · ${s.orders.length} ${d('paidOrders')}`}>
  <span>{s[metric||'amount']===null?'—':money(s[metric||'amount']!)} {s.currency==='__unknown__'?d('unknownCurrency'):s.currency}</span>
  {!metric&&<small>AOV {s.averagePerOrder===null?'—':money(s.averagePerOrder)}</small>}
  {s.missing>0&&<small>{lang==='zh'?`缺少汇率：${s.missing} 笔订单`:`Missing rate: ${s.missing} orders`}</small>}
 </div>):<div><span>{metric&&metric!=='amount'?'—':'0'}</span>{!metric&&<small>AOV —</small>}</div>}</div>
}
