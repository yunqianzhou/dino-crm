import { Card, Empty, Segmented, Select, Table } from 'antd'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import dayjs from 'dayjs'
import type { Order, Student } from '../types'
import { dashboardOwnerIds, dashboardPaymentOrders, dashboardPaymentSummary, type DashboardFilters } from '../dashboardData'
import { useDashboardText } from '../dashboardText'
import { useI18n } from '../i18n'
import { usePerm } from '../perm'
import { useStore } from '../store'
import { Export43 } from './Dashboard43Shared'
import { dashboardListScope } from '../dashboardNavigation'

type Props = { population: Student[]; orders: Order[]; filters: DashboardFilters; rangeLabel: string }

export default function DashboardPayments({ population, orders, filters, rangeLabel }: Props) {
  const d = useDashboardText()
  const { lang } = useI18n()
  const { can } = usePerm()
  const accounts = useStore(s => s.accounts)
  const [query, setQuery] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const students = new Map(population.map(s => [s.studentId, s]))
  const ownerName = (id: string) => id === '__unassigned__' ? d('unassigned') : accounts.find(a => a.email === id)?.name || id
  const selectedOwners = dashboardOwnerIds(filters.owner)
  const ownerLabel = selectedOwners.length ? selectedOwners.map(ownerName).join(' / ') : d('allCC')
  const currencyName = (currency: string) => currency === '__unknown__' ? d('unknownCurrency') : currency
  const summaries = dashboardPaymentSummary(dashboardPaymentOrders(orders, population, filters))
  const selected = summaries.find(row => row.currency === query.get('paymentCurrency')) || summaries[0]
  const matchingOrders = selected?.orders || []
  const currency = selected ? currencyName(selected.currency) : ''
  const money = (value: number) => `${new Intl.NumberFormat(lang === 'zh' ? 'zh-CN' : 'en-US', { maximumFractionDigits: 2 }).format(value)} ${currency}`
  const grouping = query.get('revenueGroup') === 'cc' ? 'cc' : 'date'
  const groupKey = (order: Order) => grouping === 'date'
    ? dayjs.utc(order.paidTime).utcOffset(420).format('YYYY-MM-DD')
    : students.get(order.studentId)?.salesOwner || '__unassigned__'
  const groupName = (id: string) => grouping === 'date' ? id : ownerName(id)
  type PaymentRow = ReturnType<typeof dashboardPaymentSummary>[number] & { id: string; value: string; owner?: string; name: string; children?: PaymentRow[] }
  const ownerKey = (order: Order) => students.get(order.studentId)?.salesOwner || '__unassigned__'
  const rows: PaymentRow[] = [...new Set(matchingOrders.map(groupKey))].sort((a, b) => grouping === 'date' ? b.localeCompare(a) : a.localeCompare(b)).map(id => {
    const subset = matchingOrders.filter(order => groupKey(order) === id)
    return { id, value: id, name: groupName(id), ...dashboardPaymentSummary(subset)[0],
      children: grouping === 'date' ? [...new Set(subset.map(ownerKey))].sort().map(owner => ({ id: JSON.stringify([id, owner]), value: id, owner, name: ownerName(owner), ...dashboardPaymentSummary(subset.filter(order => ownerKey(order) === owner))[0] })) : undefined }
  })
  const rowName = (row: PaymentRow) => row.owner ? `${row.value} / ${row.name}` : row.name
  const clear = (next: URLSearchParams) => ['paymentDetail', 'paymentValue', 'paymentOwner', 'paymentView', 'paymentUser'].forEach(key => next.delete(key))
  const queryForView = () => { const next = new URLSearchParams(query); next.set('view', 'payments'); next.set('start', filters.start); next.set('end', filters.end); return next }
  const change = (values: Record<string, string>) => {
    const next = queryForView()
    clear(next)
    Object.entries(values).forEach(([key, value]) => next.set(key, value))
    setQuery(next)
  }
  const open = (view: 'users' | 'orders', id?: string, owner?: string) => {
    const subset = matchingOrders.filter(order => (!id || groupKey(order) === id) && (!owner || ownerKey(order) === owner))
    const back = queryForView(); clear(back)
    const label = `${d(view === 'users' ? 'paidUsers' : 'paidOrders')} · ${d('paidDate')}: ${grouping === 'date' && id ? id : rangeLabel} · ${owner ? ownerName(owner) : grouping === 'cc' && id ? ownerName(id) : ownerLabel} · ${currency}`
    navigate(view === 'users' ? '/users-v2' : '/orders-v3', { state: { dashboardReturn: location.pathname + '?' + back.toString(), dashboardScope: dashboardListScope(label, subset, view === 'orders' ? subset : undefined) } })
  }
  const link = (label: string, value: string | number, action: () => void, module: 'usersV2' | 'ordersV3' = 'ordersV3') => can(module) === 'none' ? <span>{value}</span> : <button className="dashboard-count" aria-label={`${label} · ${value}`} onClick={action}>{value}</button>

  return <Card title={d('revenueTitle')} className="dashboard-payments" extra={<span className="dashboard-section-note">{d('paidDate')} · {rangeLabel} · UTC+7</span>}>
    <p className="dashboard-help">{d('revenueHelp')}</p>
    <div className="dashboard-table-tools">
      <Export43 name="payments" orders disabled={!matchingOrders.length} sheets={() => [{ name:'Paid orders', headers:['Order ID','CRM ID','Current CC','Paid UTC','Currency','Amount'], rows:matchingOrders.map(o => [o.orderId,o.studentId,ownerName(students.get(o.studentId)?.salesOwner || '__unassigned__'),o.paidTime,o.currency,o.paidAmount]) },{name:'Scope',headers:['Scope','Value'],rows:[['Paid dates UTC+7',rangeLabel],['Current CC',ownerLabel],['Currency',currency],['Exported UTC',dayjs.utc().toISOString()]]}]} />
      <Segmented value={grouping} onChange={v => change({ revenueGroup: String(v) })} options={[{ value: 'cc', label: d('ccTitle') }, { value: 'date', label: d('paidDate') }]} />
      {summaries.length > 1 && <label className="dashboard-column-picker"><span>{d('currency')}</span><Select aria-label={d('currency')} value={selected?.currency} onChange={v => change({ paymentCurrency: v })} style={{ minWidth: 140 }} options={summaries.map(s => ({ value: s.currency, label: currencyName(s.currency) }))} /></label>}
    </div>
    {selected && <div className="dashboard-payment-totals">
      <div><span>{d('revenue')}</span>{link(d('revenue'), money(selected.amount), () => open('orders'))}<small>{d('paidDate')} · {rangeLabel}</small></div>
      <div><span>{d('paidUsers')}</span>{link(d('paidUsers'), selected.users, () => open('users'), 'usersV2')}<small>{d('paidPeriod')}</small></div>
      <div><span>{d('orderAverage')}</span>{link(d('orderAverage'), money(selected.averagePerOrder || 0), () => open('orders'))}<small>{d('orderAverageHelp')}</small></div>
      <div><span>{d('aov')}</span>{link(d('aov'), money(selected.averagePerUser || 0), () => open('orders'))}<small>{d('averageHelp')}</small></div>
    </div>}
    <Table sticky={{ offsetHeader: 104 }} rowKey="id" size="middle" dataSource={rows} scroll={{ x: 1050 }} pagination={rows.length > 10 ? { pageSize: 10, showSizeChanger: false } : false} locale={{ emptyText: <Empty description={d('noPayments')} image={Empty.PRESENTED_IMAGE_SIMPLE} /> }} columns={[
      { title: grouping === 'cc' ? d('currentCC') : `${d('paidDate')} / CC`, dataIndex: 'name', fixed: 'left', width: 160 },
      { title: d('paidOrders'), width: 120, sorter: (a, b) => (a.orders.length || 0) - (b.orders.length || 0), render: (_, row) => link(`${rowName(row)} · ${d('paidOrders')}`, row.orders.length, () => open('orders', row.value, row.owner)) },
      { title: d('paidUsers'), width: 120, sorter: (a, b) => (a.users || 0) - (b.users || 0), render: (_, row) => link(`${rowName(row)} · ${d('paidUsers')}`, row.users, () => open('users', row.value, row.owner), 'usersV2') },
      { title: d('revenue'), width: 210, sorter: (a, b) => (a.amount || 0) - (b.amount || 0), render: (_, row) => link(`${rowName(row)} · ${d('revenue')}`, money(row.amount), () => open('orders', row.value, row.owner)) },
      { title: d('orderAverage'), width: 200, sorter: (a, b) => (a.averagePerOrder || 0) - (b.averagePerOrder || 0), render: (_, row) => money(row.averagePerOrder || 0) },
      { title: d('aov'), width: 210, sorter: (a, b) => (a.averagePerUser || 0) - (b.averagePerUser || 0), render: (_, row) => money(row.averagePerUser || 0) },
    ]} summary={() => selected && <Table.Summary fixed="top"><Table.Summary.Row>
      <Table.Summary.Cell index={0}><strong>{d('paymentTotal')}</strong></Table.Summary.Cell>
      <Table.Summary.Cell index={1}>{link(d('paidOrders'), matchingOrders.length, () => open('orders'))}</Table.Summary.Cell>
      <Table.Summary.Cell index={2}>{link(d('paidUsers'), selected.users, () => open('users'), 'usersV2')}</Table.Summary.Cell>
      <Table.Summary.Cell index={3}>{money(selected.amount)}</Table.Summary.Cell>
      <Table.Summary.Cell index={4}>{money(selected.averagePerOrder || 0)}</Table.Summary.Cell>
      <Table.Summary.Cell index={5}>{money(selected.averagePerUser || 0)}</Table.Summary.Cell>
    </Table.Summary.Row></Table.Summary>} />
    {grouping === 'date' && <p className="dashboard-help dashboard-bottom-note">{d('datePeriodHelp')}</p>}
  </Card>
}
