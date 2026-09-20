import { Button, Card, Empty, Modal, Segmented, Select, Space, Table } from 'antd'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import dayjs from 'dayjs'
import type { Order, Student } from '../types'
import { dashboardPaymentOrders, dashboardPaymentSummary, type DashboardFilters } from '../dashboardData'
import { useDashboardText } from '../dashboardText'
import { useI18n } from '../i18n'
import { usePerm } from '../perm'
import { useStore } from '../store'
import LocalTime from './LocalTime'

type Props = { population: Student[]; orders: Order[]; filters: DashboardFilters; rangeLabel: string }

export default function DashboardPayments({ population, orders, filters, rangeLabel }: Props) {
  const d = useDashboardText()
  const { t, lang } = useI18n()
  const { can } = usePerm()
  const accounts = useStore(s => s.accounts)
  const [query, setQuery] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const students = new Map(population.map(s => [s.studentId, s]))
  const ownerName = (id: string) => id === '__unassigned__' ? d('unassigned') : accounts.find(a => a.email === id)?.name || id
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
    const next = queryForView()
    clear(next)
    next.set('paymentDetail', '1')
    next.set('paymentView', view)
    if (id) next.set('paymentValue', id)
    if (owner) next.set('paymentOwner', owner)
    setQuery(next)
  }
  const setView = (view: string, user?: string) => {
    const next = queryForView()
    next.set('paymentView', view)
    if (user) next.set('paymentUser', user)
    else next.delete('paymentUser')
    setQuery(next)
  }
  const close = () => { const next = queryForView(); clear(next); setQuery(next) }
  const go = (path: string, studentId?: string) => navigate(path, { state: {
    dashboardReturn: location.pathname + location.search,
    ordersReturn: studentId ? `/orders-v3?studentId=${encodeURIComponent(studentId)}` : undefined,
  } })
  const selectedGroup = query.get('paymentValue')
  const selectedOwner = query.get('paymentOwner')
  const detailOrders = matchingOrders.filter(order => (!selectedGroup || groupKey(order) === selectedGroup) && (!selectedOwner || ownerKey(order) === selectedOwner))
  const detailUsers = [...new Set(detailOrders.map(order => order.studentId))].map(id => students.get(id)!).filter(Boolean)
  const selectedUser = query.get('paymentUser')
  const orderRows = detailOrders.filter(order => !selectedUser || order.studentId === selectedUser).sort((a, b) => (b.paidTime || '').localeCompare(a.paidTime || ''))
  const view = query.get('paymentView') === 'users' ? 'users' : 'orders'
  const link = (label: string, value: string | number, action: () => void) => <button className="dashboard-count" aria-label={`${label} · ${value}`} onClick={action}>{value}</button>

  return <Card title={d('revenueTitle')} className="dashboard-payments" extra={<span className="dashboard-section-note">{d('paidDate')} · {rangeLabel} · UTC+7</span>}>
    <p className="dashboard-help">{d('revenueHelp')}</p>
    <div className="dashboard-table-tools">
      <Segmented value={grouping} onChange={v => change({ revenueGroup: String(v) })} options={[{ value: 'cc', label: d('ccTitle') }, { value: 'date', label: d('paidDate') }]} />
      {summaries.length > 1 && <label className="dashboard-column-picker"><span>{d('currency')}</span><Select aria-label={d('currency')} value={selected?.currency} onChange={v => change({ paymentCurrency: v })} style={{ minWidth: 140 }} options={summaries.map(s => ({ value: s.currency, label: currencyName(s.currency) }))} /></label>}
    </div>
    {selected && <div className="dashboard-payment-totals">
      <div><span>{d('revenue')}</span>{link(d('revenue'), money(selected.amount), () => open('orders'))}<small>{d('paidDate')} · {rangeLabel}</small></div>
      <div><span>{d('paidUsers')}</span>{link(d('paidUsers'), selected.users, () => open('users'))}<small>{d('paidPeriod')}</small></div>
      <div><span>{d('orderAverage')}</span>{link(d('orderAverage'), money(selected.averagePerOrder || 0), () => open('orders'))}<small>{d('orderAverageHelp')}</small></div>
      <div><span>{d('aov')}</span>{link(d('aov'), money(selected.averagePerUser || 0), () => open('orders'))}<small>{d('averageHelp')}</small></div>
    </div>}
    <Table rowKey="id" size="middle" dataSource={rows} scroll={{ x: 1050 }} pagination={rows.length > 10 ? { pageSize: 10, showSizeChanger: false } : false} locale={{ emptyText: <Empty description={d('noPayments')} image={Empty.PRESENTED_IMAGE_SIMPLE} /> }} columns={[
      { title: grouping === 'cc' ? d('currentCC') : `${d('paidDate')} / CC`, dataIndex: 'name', fixed: 'left', width: 160 },
      { title: d('paidOrders'), width: 120, render: (_, row) => link(`${rowName(row)} · ${d('paidOrders')}`, row.orders.length, () => open('orders', row.value, row.owner)) },
      { title: d('paidUsers'), width: 120, render: (_, row) => link(`${rowName(row)} · ${d('paidUsers')}`, row.users, () => open('users', row.value, row.owner)) },
      { title: d('revenue'), width: 210, render: (_, row) => link(`${rowName(row)} · ${d('revenue')}`, money(row.amount), () => open('orders', row.value, row.owner)) },
      { title: d('orderAverage'), width: 200, render: (_, row) => money(row.averagePerOrder || 0) },
      { title: d('aov'), width: 210, render: (_, row) => money(row.averagePerUser || 0) },
    ]} summary={() => selected && <Table.Summary.Row>
      <Table.Summary.Cell index={0}><strong>{d('paymentTotal')}</strong></Table.Summary.Cell>
      <Table.Summary.Cell index={1}>{link(d('paidOrders'), matchingOrders.length, () => open('orders'))}</Table.Summary.Cell>
      <Table.Summary.Cell index={2}>{link(d('paidUsers'), selected.users, () => open('users'))}</Table.Summary.Cell>
      <Table.Summary.Cell index={3}>{money(selected.amount)}</Table.Summary.Cell>
      <Table.Summary.Cell index={4}>{money(selected.averagePerOrder || 0)}</Table.Summary.Cell>
      <Table.Summary.Cell index={5}>{money(selected.averagePerUser || 0)}</Table.Summary.Cell>
    </Table.Summary.Row>} />
    {grouping === 'date' && <p className="dashboard-help dashboard-bottom-note">{d('datePeriodHelp')}</p>}
    <Modal width={1120} open={query.get('paymentDetail') === '1'} onCancel={close} title={`${d('paymentDetails')} · ${selectedGroup ? groupName(selectedGroup) : d('allPayments')}${selectedOwner ? ' / ' + ownerName(selectedOwner) : ''}`} footer={<Button onClick={close}>{t('common.close')}</Button>}>
      <p className="dashboard-help">{d('paidDate')}：{grouping === 'date' && selectedGroup ? selectedGroup : rangeLabel} · {selectedOwner ? ownerName(selectedOwner) : filters.owner ? ownerName(filters.owner) : d('allCC')} · {currency} · UTC+7<br />{d('paymentScope')}</p>
      <Space wrap style={{ marginBottom: 16 }}>
        <Segmented value={view} onChange={v => setView(String(v))} options={[{ value: 'users', label: d('users') }, { value: 'orders', label: d('paymentOrders') }]} />
        {selectedUser && <><span>{students.get(selectedUser)?.name || selectedUser}</span><Button size="small" onClick={() => setView(view)}>{d('allUsers')}</Button></>}
      </Space>
      {view === 'users' ? <Table rowKey="studentId" dataSource={detailUsers} size="small" scroll={{ x: 820, y: 'min(50vh, 440px)' }} pagination={{ pageSize: 10, showSizeChanger: false }} columns={[
        { title: t('user.col.id'), dataIndex: 'studentId', width: 210 },
        { title: t('user.col.name'), dataIndex: 'name', width: 170 },
        { title: d('currentCC'), width: 140, render: (_, s) => ownerName(s.salesOwner || '__unassigned__') },
        { title: t('common.action'), width: 260, fixed: 'right', render: (_, s) => <Space>
          {can('usersV2') !== 'none' && <Button type="link" size="small" onClick={() => go(`/users-v2/${encodeURIComponent(s.studentId)}`)}>{d('userAction')}</Button>}
          <Button type="link" size="small" onClick={() => setView('orders', s.studentId)}>{d('orderAction')}</Button>
        </Space> },
      ]} /> : <Table rowKey="orderId" dataSource={orderRows} size="small" scroll={{ x: 970, y: 'min(50vh, 440px)' }} pagination={{ pageSize: 10, showSizeChanger: false }} columns={[
        { title: t('order.col.id'), dataIndex: 'orderId', width: 230, render: (id, order) => can('ordersV3') !== 'none' ? <Button type="link" size="small" onClick={() => go(`/orders-v3/${encodeURIComponent(id)}`, order.studentId)}>{id}</Button> : id },
        { title: t('user.col.name'), width: 160, render: (_, order) => students.get(order.studentId)?.name || order.studentId },
        { title: t('user.col.id'), dataIndex: 'studentId', width: 210 },
        { title: t('order.col.paidTime'), width: 190, render: (_, order) => <LocalTime time={order.paidTime} country="越南" /> },
        { title: d('revenue'), width: 180, render: (_, order) => money(order.paidAmount) },
      ]} />}
    </Modal>
  </Card>
}
