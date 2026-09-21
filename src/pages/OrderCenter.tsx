import { useEffect, useMemo, useState } from 'react'
import { Button, Card, DatePicker, Input, Select, Space, Table, Tag, Typography, message } from 'antd'
import { DownOutlined, UpOutlined, DownloadOutlined, SearchOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { useStore } from '../store'
import type { Order, OrderStatus, UserStatus, UserType } from '../types'
import { USER_TYPES } from '../types'
import { useI18n } from '../i18n'
import { resolveUserType } from '../userType'
import { useLineScope } from '../useLineScope'
import LineFilter from '../components/LineFilter'
import LocalTime from '../components/LocalTime'
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import DashboardLinkContext, { useDashboardContext } from '../components/DashboardLinkContext'
import { matchesDashboardScope } from '../dashboardNavigation'
import { dashboardPopulation } from '../dashboardData'
import { useDashboardText } from '../dashboardText'
import { usePerm } from '../perm'
import { downloadCsv } from '../export'

import dayjs from 'dayjs'
import CCSelect from '../components/CCSelect'
import { businessLineOf } from '../channel'
import { emptyOrderFilters5, matchesOrderFilters5, orderCreatedTime, orderTime5 } from '../phase5Orders'
import type { OrderFilters5 } from '../phase5Orders'

const { Text } = Typography

const USER_STATUS_COLOR: Record<UserStatus, string> = {
  '未付费-未体验': 'default',
  '未付费-体验中': 'gold',
  '未付费-已体验': 'blue',
  付费: 'green',
  付费逾期: 'red',
}
const USER_TYPE_COLOR: Record<UserType, string> = {
  正式用户: 'green',
  测试用户: 'gold',
}
const ORDER_STATUS_COLOR: Record<OrderStatus, string> = {
  待支付: 'orange',
  已支付: 'green',
  已退款: 'red',
  已取消: 'default',
}
const ORDER_STATUS_CODE: Record<OrderStatus, string> = {
  已退款: 'REFUNDED',
  已取消: 'CANCELED',
  已支付: 'PAID',
  待支付: 'PENDING',
}
const ORDER_STATUS_PRIORITY: Record<OrderStatus, number> = {
  已退款: 0,
  已取消: 1,
  已支付: 2,
  待支付: 3,
}
const ORDER_STATUS_ORDER: OrderStatus[] = ['已退款', '已取消', '已支付', '待支付']

function fmtMoney(amount: number, currency: string) {
  return `${currency} ${amount.toLocaleString()}`
}

export default function OrderCenter({ detailsPath, exportPermission = 'orders_export', phase5 = false }: { detailsPath?: string; exportPermission?: 'orders_export' | 'ordersV3_export'; phase5?: boolean }) {
  const { t } = useI18n()
  const navigate = useNavigate()
  const location = useLocation()
  const [query] = useSearchParams()
  const targetStudentId = query.get('studentId') || ''
  const dashboardContext = useDashboardContext()
  const d = useDashboardText()
  const { can, actor, allowedLines } = usePerm()
  const canExport = can(exportPermission) === 'operate'
  const accounts = useStore(state => state.accounts)
  const [moreFilters, setMoreFilters] = useState(false)
  const [filters5, setFilters5] = useState<OrderFilters5>(emptyOrderFilters5)
  const [page5, setPage5] = useState(1)
  const update5 = (patch: Partial<OrderFilters5>) => setFilters5(current => ({ ...current, ...patch }))
  const orders = useStore((s) => s.orders)
  const students = useStore((s) => s.students)
  const dashboardScope = detailsPath === '/orders-v3' ? dashboardContext.dashboardScope : undefined
  const permittedDashboardIds = dashboardScope ? new Set(dashboardPopulation(students, allowedLines(), allowedLines() === null || can('salesV3_reassign') === 'operate', actor).map(s => s.studentId)) : undefined
  const channels = useStore((s) => s.channels)
  const [keyword, setKeyword] = useState('')
  const [orderStatus, setOrderStatus] = useState<string | undefined>()
  const [payMethod, setPayMethod] = useState<string | undefined>()
  const [countryFilter, setCountryFilter] = useState<string | undefined>()
  const [typeFilter, setTypeFilter] = useState<string | undefined>()
  const { selected: lineSel, setSelected: setLineSel, matchLine, disabled: lineDisabled, filterOptions } = useLineScope()

  useEffect(() => { if (targetStudentId || dashboardScope) setLineSel([]) }, [targetStudentId, dashboardScope])

  const lineOptions = useMemo(
    () => Array.from(new Set([...channels.map((c) => c.name), ...students.map((s) => s.businessLine)].filter(Boolean))),
    [channels, students],
  )

  const lineOf = useMemo(() => {
    const map = new Map(students.map((s) => [s.studentId, phase5 ? businessLineOf(channels, s) : s.businessLine]))
    return (studentId: string) => map.get(studentId) ?? '—'
  }, [students, channels, phase5])

  const typeOf = useMemo(() => {
    const map = new Map(students.map((s) => [s.studentId, resolveUserType(s)]))
    return (studentId: string) => map.get(studentId)
  }, [students])

  const countryOf = useMemo(() => {
    const map = new Map(students.map((s) => [s.studentId, s.country || s.businessLine]))
    return (studentId: string) => map.get(studentId)
  }, [students])

  const couponCodeOf = useMemo(() => {
    const map = new Map(students.map((s) => [s.studentId, s.couponCode]))
    return (studentId: string, method: Order['payMethod']) =>
      method.startsWith('Airwallex') ? map.get(studentId) : undefined
  }, [students])

  const countries = useMemo(() => {
    return Array.from(new Set(students.map((s) => s.country || s.businessLine).filter(Boolean))) as string[]
  }, [students])

  const userMap = useMemo(() => new Map(students.map(student => [student.studentId, student])), [students])
  const ownerOf = (order: Order) => userMap.get(order.studentId)?.salesOwner || userMap.get(order.studentId)?.ccName
  const ccNameOf = (order: Order) => accounts.find(account => account.email === ownerOf(order))?.name || ownerOf(order) || userMap.get(order.studentId)?.ccName || '未分配'
  const scopedOrders = orders.filter(order => matchLine(lineOf(order.studentId)))
  const productOptions = [...new Set(scopedOrders.map(order => order.productName))]
  const currencyOptions = [...new Set(scopedOrders.map(order => order.currency))]
  const payOptions = [...new Set(scopedOrders.map(order => order.payMethod))]
  const resetFilters5 = () => {
    setKeyword(''); setOrderStatus(undefined); setPayMethod(undefined); setCountryFilter(undefined); setTypeFilter(undefined); setLineSel([]); setFilters5(emptyOrderFilters5)
  }
  const filterKey5 = JSON.stringify([keyword, orderStatus, payMethod, countryFilter, typeFilter, lineSel, filters5])
  useEffect(() => { setPage5(1) }, [filterKey5])

  const data = useMemo(
    () =>
      orders.filter((o) => {
        if (dashboardScope && (!matchesDashboardScope(dashboardScope, o.studentId, o.orderId) || !permittedDashboardIds?.has(o.studentId))) return false
        if (targetStudentId && o.studentId !== targetStudentId) return false
        if (!matchLine(lineOf(o.studentId))) return false
        if (phase5 && !matchesOrderFilters5(o, filters5, ownerOf(o))) return false
        const kw = keyword.trim().toLowerCase()
        const matchKw =
          !kw ||
          (phase5 && `${userMap.get(o.studentId)?.name || ''} ${userMap.get(o.studentId)?.localName || ''} ${userMap.get(o.studentId)?.account || ''}`.toLowerCase().includes(kw)) ||
          o.orderId.toLowerCase().includes(kw) ||
          o.studentId.toLowerCase().includes(kw) ||
          o.productName.toLowerCase().includes(kw) ||
          (couponCodeOf(o.studentId, o.payMethod) ?? '').toLowerCase().includes(kw)
        return (
          matchKw &&
          (!orderStatus || o.orderStatus === orderStatus) &&
          (!payMethod || o.payMethod === payMethod) &&
          (!countryFilter || countryOf(o.studentId) === countryFilter) &&
          (phase5 || !typeFilter || typeOf(o.studentId) === typeFilter)
        )
      }).sort((a, b) => ORDER_STATUS_PRIORITY[a.orderStatus] - ORDER_STATUS_PRIORITY[b.orderStatus]),
    [phase5, filters5, userMap, orders, dashboardScope, permittedDashboardIds, targetStudentId, keyword, orderStatus, payMethod, countryFilter, typeFilter, lineOf, countryOf, typeOf, couponCodeOf, lineSel, matchLine],
  )

  const exportOrders = () => {
    if (!canExport) return
    if (!data.length) { message.info('暂无可导出数据'); return }
    downloadCsv(
      `订单中心_${new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '')}.csv`,
      ['订单ID', '商品名称', '用户ID', '用户类型', '国家', '用户状态', '订单状态', '优惠码', '原价', '实际付款金额', '币种', '支付方式', phase5 ? '成功支付时间（UTC+08:00）' : '成功支付时间', phase5 ? '有效期到期时间（UTC+08:00）' : '有效期到期时间', ...(phase5 ? ['当前 CC', '创建时间（UTC+08:00）'] : [])],
      data.map((order) => [
        order.orderId, order.productName, order.studentId, typeOf(order.studentId), countryOf(order.studentId),
        order.userStatus, ORDER_STATUS_CODE[order.orderStatus], couponCodeOf(order.studentId, order.payMethod), order.originalPrice, order.paidAmount, order.currency,
        order.payMethod, phase5 ? orderTime5(order.paidTime) : order.paidTime, phase5 ? orderTime5(order.validUntil) : order.validUntil, ...(phase5 ? [ccNameOf(order), orderTime5(orderCreatedTime(order))] : []),
      ]),
    )
    message.success(`已导出 ${data.length} 条订单数据`)
  }

  const columns: ColumnsType<Order> = [
    {
      title: t('order.col.id'),
      dataIndex: 'orderId',
      width: 180,
      fixed: 'left',
      render: (id: string) => detailsPath ? <a onClick={() => navigate(`${detailsPath}/${id}`, { state: { ...dashboardContext.state, ordersReturn: location.pathname + location.search } })}>{id}</a> : <Text code>{id}</Text>,
    },
    { title: t('order.col.product'), dataIndex: 'productName', width: 180 },
    { title: t('order.col.studentId'), dataIndex: 'studentId', width: 190 },
    {
      title: t('user.col.couponCode'),
      dataIndex: 'studentId',
      key: 'couponCode',
      width: 140,
      render: (id: string, order: Order) => {
        const code = couponCodeOf(id, order.payMethod)
        return code ? <Tag color="blue">{code}</Tag> : <Text type="secondary">—</Text>
      },
    },
    {
      title: t('user.col.userType'),
      dataIndex: 'studentId',
      key: 'userType',
      width: 110,
      render: (id: string) => {
        const tp = typeOf(id)
        return tp ? <Tag color={USER_TYPE_COLOR[tp]}>{t(`enum.userType.${tp}`)}</Tag> : <Text type="secondary">—</Text>
      },
    },
    {
      title: t('user.col.country'),
      dataIndex: 'studentId',
      key: 'country',
      width: 100,
      render: (id: string) => <Tag>{countryOf(id) ?? '—'}</Tag>,
    },
    {
      title: t('order.col.userStatus'),
      dataIndex: 'userStatus',
      width: 100,
      render: (v: UserStatus) => <Tag color={USER_STATUS_COLOR[v]}>{t(`enum.status.${v}`)}</Tag>,
    },
    {
      title: t('order.col.orderStatus'),
      dataIndex: 'orderStatus',
      width: 100,
      render: (v: OrderStatus) => <Tag color={ORDER_STATUS_COLOR[v]}>{phase5 ? v : ORDER_STATUS_CODE[v]}</Tag>,
    },
    {
      title: t('order.col.original'),
      dataIndex: 'originalPrice',
      width: 140,
      align: 'right',
      render: (v, r) => <Text type="secondary">{fmtMoney(v, r.currency)}</Text>,
    },
    {
      title: t('order.col.paid'),
      dataIndex: 'paidAmount',
      width: 150,
      align: 'right',
      render: (v, r) => <Text strong>{fmtMoney(v, r.currency)}</Text>,
    },
    {
      title: t('order.col.payMethod'),
      dataIndex: 'payMethod',
      width: 130,
      render: (v) => <Tag>{v}</Tag>,
    },
    {
      title: t('order.col.paidTime'),
      dataIndex: 'paidTime',
      width: 200,
      render: (v: string | undefined, r: Order) => phase5 ? orderTime5(v) : <LocalTime time={v} country={countryOf(r.studentId)} />,
    },
    {
      title: t('order.col.validUntil'),
      dataIndex: 'validUntil',
      width: 200,
      render: (v: string | undefined, r: Order) => phase5 ? orderTime5(v) : <LocalTime time={v} country={countryOf(r.studentId)} />,
    },
  ]

  const activeTags: { label: string; clear: () => void }[] = [
    ...(keyword ? [{ label: `搜索：${keyword}`, clear: () => setKeyword('') }] : []),
    ...(orderStatus ? [{ label: `订单状态：${orderStatus}`, clear: () => setOrderStatus(undefined) }] : []),
    ...(payMethod ? [{ label: `支付方式：${payMethod}`, clear: () => setPayMethod(undefined) }] : []),
    ...(countryFilter ? [{ label: `国家：${countryFilter}`, clear: () => setCountryFilter(undefined) }] : []),
    ...(lineSel.length ? [{ label: `业务线：${lineSel.join('、')}`, clear: () => setLineSel([]) }] : []),
    ...(filters5.product ? [{ label: `商品：${filters5.product}`, clear: () => update5({ product: undefined }) }] : []),
    ...(filters5.cc ? [{ label: `CC：${accounts.find(a => a.email === filters5.cc)?.name || (filters5.cc === '__unassigned__' ? '未分配' : filters5.cc)}`, clear: () => update5({ cc: undefined }) }] : []),
    ...(filters5.currency ? [{ label: `币种：${filters5.currency}`, clear: () => update5({ currency: undefined }) }] : []),
    ...(filters5.from || filters5.to ? [{ label: `${{ paidTime: '支付', createdTime: '创建', validUntil: '到期' }[filters5.dateField]}日期：${filters5.from || '不限'} — ${filters5.to || '不限'}`, clear: () => update5({ from: undefined, to: undefined }) }] : []),
  ]
  const extraCount = Number(!!filters5.cc) + Number(!!filters5.currency)
  const paidAmounts = new Map<string, number>()
  data.filter(order => order.orderStatus === '已支付').forEach(order => paidAmounts.set(order.currency, (paidAmounts.get(order.currency) || 0) + order.paidAmount))
  const phase5Filters = <div className="phase5-orders-filters">
    <div className="phase5-filter-grid">
      <div className="phase5-filter-field wide"><label>搜索订单 / 用户</label><Input allowClear prefix={<SearchOutlined />} value={keyword} onChange={event => setKeyword(event.target.value)} placeholder="订单号 / 用户 ID / 姓名 / 登录账号 / 优惠码" /></div>
      <div className="phase5-filter-field"><label>业务线</label><LineFilter value={lineSel} onChange={setLineSel} options={filterOptions(lineOptions)} disabled={lineDisabled} width={0} /></div>
      <div className="phase5-filter-field"><label>国家</label><Select aria-label="国家" allowClear showSearch placeholder="全部国家" value={countryFilter} onChange={setCountryFilter} options={countries.map(value => ({ label: value, value }))} /></div>
      <div className="phase5-filter-field"><label>订单状态</label><Select aria-label="订单状态" allowClear placeholder="全部状态" value={orderStatus} onChange={setOrderStatus} options={['待支付', '已支付', '已退款', '已取消'].map(value => ({ label: value, value }))} /></div>
      <div className="phase5-filter-field"><label>商品</label><Select aria-label="商品" allowClear showSearch placeholder="搜索商品名称" value={filters5.product} onChange={product => update5({ product })} options={productOptions.map(value => ({ label: value, value }))} /></div>
      <div className="phase5-filter-field"><label>支付方式</label><Select aria-label="支付方式" allowClear placeholder="全部支付方式" value={payMethod} onChange={setPayMethod} options={payOptions.map(value => ({ label: value, value }))} /></div>
      <div className="phase5-filter-field"><label>时间类型 · UTC+08:00</label><Select aria-label="时间类型" value={filters5.dateField} onChange={dateField => update5({ dateField })} options={[{ label: '成功支付时间', value: 'paidTime' }, { label: '订单创建时间', value: 'createdTime' }, { label: '有效期到期时间', value: 'validUntil' }]} /></div>
      <div className="phase5-filter-field wide"><label>日期范围 · 含开始与结束日期</label><DatePicker.RangePicker aria-label="订单日期范围" value={filters5.from && filters5.to ? [dayjs(filters5.from), dayjs(filters5.to)] : null} onChange={value => update5({ from: value?.[0]?.format('YYYY-MM-DD'), to: value?.[1]?.format('YYYY-MM-DD') })} presets={[{ label: '今天', value: [dayjs.utc().utcOffset(480), dayjs.utc().utcOffset(480)] }, { label: '近 7 天', value: [dayjs.utc().utcOffset(480).subtract(6, 'day'), dayjs.utc().utcOffset(480)] }, { label: '近 30 天', value: [dayjs.utc().utcOffset(480).subtract(29, 'day'), dayjs.utc().utcOffset(480)] }]} /></div>
    </div>
    {moreFilters && <div className="phase5-filter-grid" style={{ marginTop: 16, paddingTop: 16, borderTop: '1px dashed #dce2ed' }}>
      <div className="phase5-filter-field"><label>当前 CC</label><CCSelect accounts={accounts.filter(a => a.businessLines.some(matchLine))} owners={scopedOrders.map(order => ownerOf(order) || '')} value={filters5.cc} onChange={cc => update5({ cc })} /></div>
      <div className="phase5-filter-field"><label>币种</label><Select aria-label="币种" allowClear placeholder="全部币种" value={filters5.currency} onChange={currency => update5({ currency })} options={currencyOptions.map(value => ({ label: value, value }))} /></div>
    </div>}
    <div className="phase5-filter-footer"><Space><Button type="link" style={{ paddingLeft: 0 }} icon={moreFilters ? <UpOutlined /> : <DownOutlined />} onClick={() => setMoreFilters(!moreFilters)}>{moreFilters ? '收起更多筛选' : '更多筛选'}{extraCount ? ` (${extraCount})` : ''}</Button><Text type="secondary">选择后自动筛选</Text></Space><Space><Button onClick={resetFilters5}>重置筛选</Button>{canExport && <Button icon={<DownloadOutlined />} onClick={exportOrders}>导出筛选结果</Button>}</Space></div>
    {!!activeTags.length && <Space wrap style={{ marginTop: 14 }}>{activeTags.map(tag => <Tag key={tag.label} closable onClose={event => { event.preventDefault(); tag.clear() }}>{tag.label}</Tag>)}</Space>}
  </div>

  return (
    <Card className="page-card" bordered={false} title={<span className="section-title">{phase5 ? '订单列表' : t('order.title')}</span>}>
      <DashboardLinkContext filter />
      {phase5 ? phase5Filters : <Space wrap style={{ marginBottom: 16 }}>
        <Input
          allowClear
          prefix={<SearchOutlined />}
          placeholder={t('order.searchPlaceholder')}
          style={{ width: 260 }}
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
        />
        <LineFilter value={lineSel} onChange={setLineSel} options={filterOptions(lineOptions)} disabled={lineDisabled} />
        <Select
          allowClear
          placeholder={t('user.col.country')}
          style={{ width: 140 }}
          value={countryFilter}
          onChange={setCountryFilter}
          options={countries.map((l) => ({ label: l, value: l }))}
        />
        <Select
          allowClear
          placeholder={t('user.col.userType')}
          style={{ width: 140 }}
          value={typeFilter}
          onChange={setTypeFilter}
          options={USER_TYPES.map((tp) => ({ label: t(`enum.userType.${tp}`), value: tp }))}
        />
        <Select
          allowClear
          placeholder={t('order.filterStatus')}
          style={{ width: 150 }}
          value={orderStatus}
          onChange={setOrderStatus}
          options={ORDER_STATUS_ORDER.map((l) => ({ label: ORDER_STATUS_CODE[l], value: l }))}
        />
        <Select
          allowClear
          placeholder={t('order.filterPay')}
          style={{ width: 160 }}
          value={payMethod}
          onChange={setPayMethod}
          options={['App Store', 'Google Play', 'Airwallex - Card', 'Airwallex - Kakaopay'].map((l) => ({ label: l, value: l }))}
        />
        {canExport && <Button icon={<DownloadOutlined />} onClick={exportOrders}>{d('export')}</Button>}
      </Space>}
      {phase5 && <div className="phase5-summary"><span>共 <strong>{data.length}</strong> 笔订单</span><Text type="secondary">已支付订单实付：{[...paidAmounts].map(([currency, amount]) => `${currency} ${amount.toLocaleString()}`).join(' / ') || '—'}</Text><Text type="secondary" style={{ fontSize: 12 }}>金额分币种展示 · CC 按当前用户归属 · 时间 UTC+08:00</Text></div>}

      <Table
        rowKey="orderId"
        columns={phase5 ? [...columns.slice(0, 3), { title: '当前 CC', key: 'currentCC', width: 160, render: (_: unknown, order: Order) => ccNameOf(order) }, ...columns.slice(3), { title: '订单创建时间', key: 'createdTime', width: 180, render: (_: unknown, order: Order) => orderTime5(orderCreatedTime(order)) }] : columns}
        dataSource={data}
        locale={targetStudentId ? { emptyText: d('noOrders') } : undefined}
        scroll={{ x: phase5 ? 2220 : 1880 }}
        pagination={{ ...(phase5 ? { current: page5, onChange: (page: number) => setPage5(page) } : {}), showTotal: (n) => t('common.total', { n }), showSizeChanger: true }}
      />
    </Card>
  )
}
