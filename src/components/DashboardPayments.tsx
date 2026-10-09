import { Card, Empty, Segmented, Table } from 'antd'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import dayjs from 'dayjs'
import type { Order, Student } from '../types'
import { dashboardOwnerIds, dashboardPaymentOrders, type DashboardFilters } from '../dashboardData'
import { dashboardNumberCompare } from '../dashboardSort'
import { useDashboardText } from '../dashboardText'
import { usePerm } from '../perm'
import { useStore } from '../store'
import { Export43, useDashboard43 } from './Dashboard43Shared'
import { dashboardListScope } from '../dashboardNavigation'
import DashboardMoneyCell from './DashboardMoneyCell'
import { useDashboardCurrency, currencyExportHeaders, currencyExportRow } from './DashboardCurrency'

type Props = { population: Student[]; orders: Order[]; filters: DashboardFilters; rangeLabel: string }
export default function DashboardPayments({ population, orders, filters, rangeLabel }: Props) {
 const d=useDashboardText()
 const {text}=useDashboard43()
 const {can}=usePerm()
 const accounts=useStore(s=>s.accounts)
 const [query,setQuery]=useSearchParams()
 const location=useLocation()
 const navigate=useNavigate()
 const currency=useDashboardCurrency()
 const students=new Map(population.map(s=>[s.studentId,s]))
 const ownerName=(id:string)=>id==='__unassigned__'?d('unassigned'):accounts.find(a=>a.email===id)?.name||id
 const owners=dashboardOwnerIds(filters.owner)
 const ownerLabel=owners.length?owners.map(ownerName).join(' / '):d('allCC')
 // Display currency never filters the order or payer population.
 const matchingOrders=dashboardPaymentOrders(orders,population,filters)
 const grouping=query.get('revenueGroup')==='cc'?'cc':'date'
 const ownerKey=(o:Order)=>students.get(o.studentId)?.salesOwner||'__unassigned__'
 const dateKey=(o:Order)=>dayjs.utc(o.paidTime).utcOffset(420).format('YYYY-MM-DD')
 const groupKey=grouping==='date'?dateKey:ownerKey
 type Row={id:string;value:string;owner?:string;name:string;orders:Order[];children?:Row[]}
 const rows:Row[]=[...new Set(matchingOrders.map(groupKey))].sort((a,b)=>grouping==='date'?b.localeCompare(a):a.localeCompare(b)).map(id=>{
  const subset=matchingOrders.filter(o=>groupKey(o)===id)
  return {id,value:id,name:grouping==='date'?id:ownerName(id),orders:subset,children:grouping==='date'?[...new Set(subset.map(ownerKey))].sort().map(owner=>({id:JSON.stringify([id,owner]),value:id,owner,name:ownerName(owner),orders:subset.filter(o=>ownerKey(o)===owner)})):undefined}
 })
 const users=(orders:Order[])=>new Set(orders.map(o=>o.studentId)).size
 const clear=(next:URLSearchParams)=>['paymentDetail','paymentValue','paymentOwner','paymentView','paymentUser','paymentCurrency'].forEach(k=>next.delete(k))
 const changeGroup=(value:string)=>{const next=new URLSearchParams(query);clear(next);next.set('revenueGroup',value);setQuery(next)}
 const open=(view:'users'|'orders',subset:Order[],name='')=>{
  const back=new URLSearchParams(query);clear(back)
  navigate(view==='users'?'/users-v2':'/orders-v3',{state:{dashboardReturn:location.pathname+'?'+back.toString(),dashboardScope:dashboardListScope(`${d(view==='users'?'paidUsers':'paidOrders')} · ${rangeLabel} · ${name||ownerLabel} · ${currency.mode==='USD'?'USD':text('当地货币','Local currency')}`,subset,view==='orders'?subset:undefined)}})
 }
 const link=(title:string,value:React.ReactNode,action:()=>void,module:'usersV2'|'ordersV3'='ordersV3')=>can(module)==='none'?<span>{value}</span>:<button className="dashboard-count" aria-label={title} onClick={action}>{value}</button>
 const name=(row:Row)=>row.owner?`${row.value} / ${row.name}`:row.name
 const comparable=currency.summary(matchingOrders).length<=1
 return <Card title={d('revenueTitle')} className="dashboard-payments" extra={<span className="dashboard-section-note">{d('paidDate')} · {rangeLabel} · UTC+7</span>}>
  <p className="dashboard-help">{text('按支付日期统计同一批有效订单；币种切换仅换算金额，支付人数和订单数不变。多业务线的当地货币分列，美元换算后汇总。','The same valid orders are selected by payment date. Currency switches convert amounts without changing payers or orders. Local currencies remain separate; USD is aggregated after conversion.')}</p>
  <div className="dashboard-table-tools">
   <Export43 name="payments" disabled={!matchingOrders.length} sheets={()=>[
    {name:'Paid orders',headers:['Order ID','CRM ID','Current CC','Paid UTC',...currencyExportHeaders],rows:matchingOrders.map(o=>[o.orderId,o.studentId,ownerName(ownerKey(o)),o.paidTime,...currencyExportRow(o,currency)])},
    {name:'Scope',headers:['Scope','Value'],rows:[['Paid dates UTC+7',rangeLabel],['Current CC',ownerLabel],['Display currency',currency.mode],['FX','Fixed demo rates; not market quotes; missing rates are unavailable, never zero'],['Exported UTC',dayjs.utc().toISOString()]]}
   ]}/>
   <Segmented value={grouping} onChange={v=>changeGroup(String(v))} options={[{value:'cc',label:d('ccTitle')},{value:'date',label:d('paidDate')}]}/>
  </div>
  <div className="dashboard-payment-totals">
   <div><span>{d('revenue')}</span>{link(d('revenue'),<DashboardMoneyCell orders={matchingOrders} metric="amount"/>,()=>open('orders',matchingOrders))}<small>{rangeLabel}</small></div>
   <div><span>{d('paidUsers')}</span>{link(d('paidUsers'),users(matchingOrders),()=>open('users',matchingOrders),'usersV2')}<small>{d('paidPeriod')}</small></div>
   <div><span>{d('orderAverage')}</span>{link(d('orderAverage'),<DashboardMoneyCell orders={matchingOrders} metric="averagePerOrder"/>,()=>open('orders',matchingOrders))}<small>{d('orderAverageHelp')}</small></div>
   <div><span>{d('aov')}</span>{link(d('aov'),<DashboardMoneyCell orders={matchingOrders} metric="averagePerUser"/>,()=>open('orders',matchingOrders))}<small>{d('averageHelp')}</small></div>
  </div>
  <Table<Row> sticky={{offsetHeader:104}} rowKey="id" size="middle" dataSource={rows} scroll={{x:900}} pagination={rows.length>10?{pageSize:10,showSizeChanger:false}:false} locale={{emptyText:<Empty description={d('noPayments')} image={Empty.PRESENTED_IMAGE_SIMPLE}/>}} columns={[
   {title:grouping==='cc'?d('currentCC'):`${d('paidDate')} / CC`,dataIndex:'name',fixed:'left',width:170},
   {title:d('paidOrders'),width:120,sorter:(a,b)=>a.orders.length-b.orders.length,render:(_,row)=>link(`${name(row)} · ${d('paidOrders')}`,row.orders.length,()=>open('orders',row.orders,name(row)))},
   {title:d('paidUsers'),width:120,sorter:(a,b)=>users(a.orders)-users(b.orders),render:(_,row)=>link(`${name(row)} · ${d('paidUsers')}`,users(row.orders),()=>open('users',row.orders,name(row)),'usersV2')},
   {title:d('revenue'),width:240,sorter:comparable?(a,b,order)=>dashboardNumberCompare(currency.sortValue(a.orders,'amount'),currency.sortValue(b.orders,'amount'),order):undefined,render:(_,row)=>link(`${name(row)} · ${d('revenue')}`,<DashboardMoneyCell orders={row.orders} metric="amount"/>,()=>open('orders',row.orders,name(row)))},
   {title:d('orderAverage'),width:200,sorter:comparable?(a,b,order)=>dashboardNumberCompare(currency.sortValue(a.orders,'averagePerOrder'),currency.sortValue(b.orders,'averagePerOrder'),order):undefined,render:(_,row)=><DashboardMoneyCell orders={row.orders} metric="averagePerOrder"/>},
   {title:d('aov'),width:240,sorter:comparable?(a,b,order)=>dashboardNumberCompare(currency.sortValue(a.orders,'averagePerUser'),currency.sortValue(b.orders,'averagePerUser'),order):undefined,render:(_,row)=><DashboardMoneyCell orders={row.orders} metric="averagePerUser"/>},
  ]} summary={()=><Table.Summary fixed="top"><Table.Summary.Row>
   <Table.Summary.Cell index={0}>{d('paymentTotal')}</Table.Summary.Cell><Table.Summary.Cell index={1}>{link(d('paidOrders'),matchingOrders.length,()=>open('orders',matchingOrders))}</Table.Summary.Cell><Table.Summary.Cell index={2}>{link(d('paidUsers'),users(matchingOrders),()=>open('users',matchingOrders),'usersV2')}</Table.Summary.Cell><Table.Summary.Cell index={3}><DashboardMoneyCell orders={matchingOrders} metric="amount"/></Table.Summary.Cell><Table.Summary.Cell index={4}><DashboardMoneyCell orders={matchingOrders} metric="averagePerOrder"/></Table.Summary.Cell><Table.Summary.Cell index={5}><DashboardMoneyCell orders={matchingOrders} metric="averagePerUser"/></Table.Summary.Cell>
  </Table.Summary.Row></Table.Summary>}/>
 </Card>
}
