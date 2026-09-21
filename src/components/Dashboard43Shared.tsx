import { useState } from 'react'
import { Button, Empty, Select, Table } from 'antd'
import { DownloadOutlined } from '@ant-design/icons'
import { useLocation, useNavigate } from 'react-router-dom'
import * as XLSX from 'xlsx'
import { useI18n } from '../i18n'
import { usePerm } from '../perm'
import { useStore } from '../store'
import type { Order, Student } from '../types'
import { dashboardListScope, dashboardMetricDestination } from '../dashboardNavigation'
import { dashboardPaymentSummary, inVietnamRange } from '../dashboardData'
import { dashboardMoneyValue, dashboardNumberCompare } from '../dashboardSort'
import { l2s, type PeopleMetrics } from '../dashboard43'
import DashboardMoneyCell from './DashboardMoneyCell'

const copy: Record<string, [string, string]> = {
 leads:['线索数（含已付费）','Leads (including paid)'], called:['外呼人数','Users called'], connected:['接通人数','Users connected'], booked:['预约人数','Users with bookings'], trialCompleted:['体验课完成人数','Trial completed'], paid:['已支付人数','Paid users'], attended:['预约出席人数','Appointment attended'], completed:['咨询完成人数','Consultation completed'], rejected:['电话拒绝人数','Phone-stage rejected'], closedAfter:['咨询后关闭人数','Closed after consultation'], closedUnknown:['历史关闭 · 环节未知','Legacy closure · stage unknown'],
 total:['当前销售线索','Current sales leads'], assigned:['已分配','Assigned'], unassigned:['未分配','Unassigned'], '待外呼':['待外呼','Call pending'], '未接通待跟进':['未接通 · 待跟进','Not reached · follow-up'], '已接通待预约':['待预约','Appointment pending'], '已预约':['已预约 · 待出席','Booked · awaiting attendance'], '已出席待咨询':['已出席 · 待咨询','Attended · consultation pending'], '未出勤待跟进':['未出席 · 待跟进','No show · follow-up'], '咨询未完成待跟进':['咨询未完成','Incomplete consultation'], '咨询完成待支付':['待支付','Payment pending'], '暂不跟进':['暂不跟进','Paused'], '已关闭':['当前已关闭','Currently closed'],
 noShow:['未出席原因','No-show reasons'], incomplete:['咨询未完成原因','Incomplete consultation reasons'], paymentConcern:['待支付顾虑','Payment concerns'], paused:['暂停原因','Pause reasons'],
 future:['待发生','Upcoming'], unconfirmed:['已到时间 · 待确认','Due · unconfirmed'], cancelled:['已取消','Cancelled'], rescheduled:['已改期','Rescheduled'],
}
export function useDashboard43() {
 const { lang, t } = useI18n()
 const { can } = usePerm()
 const accounts = useStore(s => s.accounts)
 const navigate = useNavigate()
 const location = useLocation()
 const text = (zh: string, en: string) => lang === 'zh' || lang === 'zhTW' ? zh : en
 const label = (key: string) => copy[key] ? text(...copy[key]) : key
 const ownerName = (id: string) => id === '__unassigned__' ? text('未分配','Unassigned') : accounts.find(a => a.email === id)?.name || id
 const open = (users: Student[], description: string, metric = 'leads') => navigate(dashboardMetricDestination(metric).path, { state: { dashboardReturn: location.pathname + location.search, dashboardScope: dashboardListScope(description, users) } })
 const count = (users: Student[], description: string, metric = 'leads') => can(dashboardMetricDestination(metric).module) === 'none' ? <span>{users.length}</span> : <button className="dashboard-count" aria-label={`${description} · ${users.length}`} onClick={() => open(users, description, metric)}>{users.length.toLocaleString()}</button>
 const reason = (id: string) => id === '__unknown__' ? text('未记录 / 历史未知','Not recorded / legacy unknown') : t(`sales.consultation.reasonOption.${id}`) === `sales.consultation.reasonOption.${id}` ? id : t(`sales.consultation.reasonOption.${id}`)
 return { text, label, ownerName, open, count, reason, can }
}
export const rateText = (value: number | null) => value === null ? '—' : `${Number(value.toFixed(1))}%`
export type MetricRow43 = { id: string; name: string; metrics: PeopleMetrics; activityDate?: string; scopeName?: string; children?: MetricRow43[] }
export function MetricTable43({ rows, total, keys, firstTitle, context, conversion = false, orders, labels = {}, currentKeys }: { rows: MetricRow43[]; total: PeopleMetrics; keys: readonly string[]; firstTitle: string; context: string; conversion?: boolean; orders?: Order[]; labels?: Record<string,string>; currentKeys?: readonly string[] }) {
 const { text, label, count } = useDashboard43()
 const [sortBy, setSortBy] = useState<'amount' | 'averagePerOrder'>('amount')
 const [currency, setCurrency] = useState('VND')
 const currencies = dashboardPaymentSummary(orders || []).map(s => s.currency)
 const selectedCurrency = currencies.includes(currency) ? currency : currencies[0] || 'VND'
 const rowOrders = (metrics: PeopleMetrics, date?: string) => { const ids = new Set((metrics.leads || metrics.paid || []).map(s => s.studentId)); return (orders || []).filter(o => ids.has(o.studentId) && (!date || inVietnamRange(o.paidTime,date,date))) }
 const metricLabel = (key:string) => labels[key] || label(key)
 const numeric = (metrics: PeopleMetrics, key: string, name = '', date?: string) => date && currentKeys?.includes(key) ? <span className="dashboard-not-applicable" title={text('当前快照不按历史日期重复展示','Current snapshot is not repeated for historical dates')}>—</span> : count(metrics[key] || [], `${currentKeys?.includes(key) ? text('当前待处理 · 截至当前','Current workload · as of now') : date ? text('活动日期','Activity date') + ': ' + date : context} · ${name} · ${metricLabel(key)}`, key)
 const moneyTitle = <div className="dashboard-money-header"><span>{text('实付金额 / AOV','Amount paid / AOV')}</span><div onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}><Select aria-label={text('金额排序依据','Money sort metric')} size="small" value={sortBy} onChange={setSortBy} options={[{ value:'amount', label:text('按金额','By revenue') },{value:'averagePerOrder',label:text('按 AOV','By AOV')}]} />{currencies.length > 1 && <Select size="small" aria-label={text('排序币种','Sort currency')} value={selectedCurrency} onChange={setCurrency} options={currencies.map(value => ({ value, label:value }))} />}</div></div>
 const metricColumns = (selectedKeys: readonly string[]) => selectedKeys.map(key => ({
  title:metricLabel(key), key, width:135,
  sorter:(a:MetricRow43,b:MetricRow43,order?:'ascend'|'descend'|null) => dashboardNumberCompare(a.activityDate && currentKeys?.includes(key) ? null : a.metrics[key]?.length || 0,b.activityDate && currentKeys?.includes(key) ? null : b.metrics[key]?.length || 0,order),
  render:(_:unknown,row:MetricRow43) => numeric(row.metrics,key,row.scopeName || row.name,row.activityDate),
 }))
 const moneyColumns = orders ? [{title:moneyTitle,key:'money',width:210,sorter:(a:MetricRow43,b:MetricRow43,order?:'ascend'|'descend'|null) => dashboardNumberCompare(dashboardMoneyValue(rowOrders(a.metrics,a.activityDate),selectedCurrency,sortBy),dashboardMoneyValue(rowOrders(b.metrics,b.activityDate),selectedCurrency,sortBy),order),render:(_:unknown,row:MetricRow43) => <DashboardMoneyCell orders={rowOrders(row.metrics,row.activityDate)} />}] : []
 return <Table<MetricRow43> rowKey="id" size="middle" sticky={{ offsetHeader: 94 }} dataSource={rows} pagination={rows.length > 12 ? { pageSize:12,showSizeChanger:false } : false} scroll={{x:190 + keys.length * 135 + (conversion ? 135 : 0) + (orders ? 210 : 0)}} locale={{emptyText:<Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={text('当前范围暂无数据','No data in this scope')} />}} columns={[
  {title:firstTitle,dataIndex:'name',fixed:'left',width:190},
  ...(currentKeys ? [
   {title:<span className="dashboard-snapshot-heading">{text('当前待处理','Current workload')}<small>{text('截至当前','As of now')}</small></span>,key:'current',children:metricColumns(currentKeys)},
   {title:<span className="dashboard-period-heading">{text('所选期间','Selected period')}<small>{context}</small></span>,key:'period',children:[...metricColumns(keys.filter(key=>!currentKeys.includes(key))),...moneyColumns]},
  ] : metricColumns(keys)),
  ...(conversion ? [{title:'L2S',key:'l2s',width:130,sorter:(a:MetricRow43,b:MetricRow43,order?:'ascend'|'descend'|null) => dashboardNumberCompare(l2s(a.metrics),l2s(b.metrics),order),render:(_:unknown,row:MetricRow43) => rateText(l2s(row.metrics))}] : []),
  ...(!currentKeys ? moneyColumns : []),
 ]} summary={() => <Table.Summary fixed="top"><Table.Summary.Row><Table.Summary.Cell index={0}>{text('合计（去重）','Total (unique users)')}</Table.Summary.Cell>{keys.map((key,i) => <Table.Summary.Cell index={i+1} key={key}>{numeric(total,key)}</Table.Summary.Cell>)}{conversion && <Table.Summary.Cell index={keys.length+1}>{rateText(l2s(total))}</Table.Summary.Cell>}{orders && <Table.Summary.Cell index={keys.length+1+(conversion?1:0)}><DashboardMoneyCell orders={rowOrders(total)} /></Table.Summary.Cell>}</Table.Summary.Row></Table.Summary>} />
}
export type ExportSheet43 = { name: string; headers: string[]; rows: unknown[][] }
export function Export43({ name, sheets, disabled = false, orders = false }: { name: string; sheets: () => ExportSheet43[]; disabled?:boolean; orders?:boolean }) {
 const { text, can } = useDashboard43()
 if (can(orders ? 'ordersV3_export' : 'usersV2_export') !== 'operate') return null
 return <Button size="small" icon={<DownloadOutlined />} disabled={disabled} onClick={() => {
  const workbook = XLSX.utils.book_new()
  sheets().forEach(sheet => { const ws = XLSX.utils.aoa_to_sheet([sheet.headers,...sheet.rows]); ws['!cols'] = sheet.headers.map(() => ({wch:24})); XLSX.utils.book_append_sheet(workbook,ws,sheet.name.slice(0,31)) })
  XLSX.writeFile(workbook,`${name}.xlsx`)
 }}>{text('下载原始数据','Download raw data')}</Button>
}
