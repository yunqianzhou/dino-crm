import { dashboardTimeZone } from '../dashboardTime'
import { Card, Empty, Segmented, Table } from 'antd'
import { useSearchParams } from 'react-router-dom'
import dayjs from 'dayjs'
import type { Order, Student } from '../types'
import { dashboardPaymentOrders, type DashboardFilters } from '../dashboardData'
import { dashboardNumberCompare } from '../dashboardSort'
import { useDashboardText } from '../dashboardText'
import { useStore } from '../store'
import { Export43, useDashboard43 } from './Dashboard43Shared'
import DashboardMoneyCell from './DashboardMoneyCell'
import { orderDetailSheet } from '../dashboardDetailExport'
import { localMoneySortable, localMoneySortValue } from '../dashboardCurrency'

type Props = { population: Student[]; orders: Order[]; filters: DashboardFilters; rangeLabel: string }
export default function DashboardPayments({ population, orders, filters, rangeLabel }: Props) {
 const d=useDashboardText()
 const {text}=useDashboard43()
 const accounts=useStore(s=>s.accounts)
 const [query,setQuery]=useSearchParams()
 const students=new Map(population.map(s=>[s.studentId,s]))
 const ownerName=(id:string)=>id==='__unassigned__'?d('unassigned'):accounts.find(a=>a.email===id)?.name||id
 // Currency labels never filter the order or payer population.
 const matchingOrders=dashboardPaymentOrders(orders,population,filters)
 const grouping=query.get('revenueGroup')==='cc'?'cc':'date'
 const ownerKey=(o:Order)=>students.get(o.studentId)?.salesOwner||'__unassigned__'
 const dateKey=(o:Order)=>dayjs.utc(o.paidTime).local().format('YYYY-MM-DD')
 const groupKey=grouping==='date'?dateKey:ownerKey
 type Row={id:string;value:string;owner?:string;name:string;orders:Order[];children?:Row[]}
 const rows:Row[]=[...new Set(matchingOrders.map(groupKey))].sort((a,b)=>grouping==='date'?b.localeCompare(a):a.localeCompare(b)).map(id=>{
  const subset=matchingOrders.filter(o=>groupKey(o)===id)
  return {id,value:id,name:grouping==='date'?id:ownerName(id),orders:subset,children:grouping==='date'?[...new Set(subset.map(ownerKey))].sort().map(owner=>({id:JSON.stringify([id,owner]),value:id,owner,name:ownerName(owner),orders:subset.filter(o=>ownerKey(o)===owner)})):undefined}
 })
 const users=(orders:Order[])=>new Set(orders.map(o=>o.studentId)).size
 const clear=(next:URLSearchParams)=>['paymentDetail','paymentValue','paymentOwner','paymentView','paymentUser','paymentCurrency'].forEach(k=>next.delete(k))
 const changeGroup=(value:string)=>{const next=new URLSearchParams(query);clear(next);next.set('revenueGroup',value);setQuery(next)}
 const comparable=localMoneySortable(matchingOrders)
 return <Card title={d('revenueTitle')} className="dashboard-payments" extra={<span className="dashboard-section-note">{d('paidDate')} · {rangeLabel} · {dashboardTimeZone()}</span>}>
  <p className="dashboard-help">{text('按支付日期统计当前业务线的有效订单，展示本地货币实付金额及均值。','Valid orders in the selected business line are counted by payment date, with amounts and averages in local currency.')}</p>
  <div className="dashboard-table-tools">
   <Export43 name="payments" disabled={!matchingOrders.length} scope={[[text('支付日期范围','Payment dates'),rangeLabel],[text('分组方式','Grouping'),grouping==='date'?text('支付日期 → 当前 CC','Payment date → Current CC'):text('当前 CC','Current CC')]]} sheets={()=>[orderDetailSheet(population,matchingOrders,{text,ownerName,calls:[]})]}/>
   <Segmented value={grouping} onChange={v=>changeGroup(String(v))} options={[{value:'cc',label:d('ccTitle')},{value:'date',label:d('paidDate')}]}/>
  </div>
  <div className="dashboard-payment-totals">
   <div><span>{d('revenue')}</span><DashboardMoneyCell orders={matchingOrders} metric="amount"/><small>{rangeLabel}</small></div>
   <div><span>{d('paidUsers')}</span><span className="dashboard-value">{users(matchingOrders).toLocaleString()}</span><small>{d('paidPeriod')}</small></div>
   <div><span>{text('已支付订单数','Paid orders')}</span><span className="dashboard-value">{matchingOrders.length.toLocaleString()}</span><small>{text('按支付日期 · 有效已支付订单','By payment date · valid paid orders')}</small></div>
   <div><span>{d('orderAverage')}</span><DashboardMoneyCell orders={matchingOrders} metric="averagePerOrder"/><small>{d('orderAverageHelp')}</small></div>
   <div><span>{d('aov')}</span><DashboardMoneyCell orders={matchingOrders} metric="averagePerUser"/><small>{d('averageHelp')}</small></div>
  </div>
  <Table<Row> sticky={{offsetHeader:104}} rowKey="id" size="middle" dataSource={rows} scroll={{x:900}} pagination={rows.length>10?{pageSize:10,showSizeChanger:false}:false} locale={{emptyText:<Empty description={d('noPayments')} image={Empty.PRESENTED_IMAGE_SIMPLE}/>}} columns={[
   {title:grouping==='cc'?d('currentCC'):`${d('paidDate')} / CC`,dataIndex:'name',fixed:'left',width:170},
   {title:d('paidOrders'),width:120,sorter:(a,b)=>a.orders.length-b.orders.length,render:(_,row)=><span className="dashboard-value">{row.orders.length.toLocaleString()}</span>},
   {title:d('paidUsers'),width:120,sorter:(a,b)=>users(a.orders)-users(b.orders),render:(_,row)=><span className="dashboard-value">{users(row.orders).toLocaleString()}</span>},
   {title:d('revenue'),width:240,sorter:comparable?(a,b,order)=>dashboardNumberCompare(localMoneySortValue(a.orders,'amount'),localMoneySortValue(b.orders,'amount'),order):undefined,render:(_,row)=><DashboardMoneyCell orders={row.orders} metric="amount"/>},
   {title:d('orderAverage'),width:200,sorter:comparable?(a,b,order)=>dashboardNumberCompare(localMoneySortValue(a.orders,'averagePerOrder'),localMoneySortValue(b.orders,'averagePerOrder'),order):undefined,render:(_,row)=><DashboardMoneyCell orders={row.orders} metric="averagePerOrder"/>},
   {title:d('aov'),width:240,sorter:comparable?(a,b,order)=>dashboardNumberCompare(localMoneySortValue(a.orders,'averagePerUser'),localMoneySortValue(b.orders,'averagePerUser'),order):undefined,render:(_,row)=><DashboardMoneyCell orders={row.orders} metric="averagePerUser"/>},
  ]}/>
 </Card>
}
