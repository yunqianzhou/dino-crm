import { useI18n } from '../i18n'
import { useDashboardText } from '../dashboardText'
import DashboardLinkContext, { useDashboardContext } from '../components/DashboardLinkContext'
import { useMemo } from 'react'
import { ArrowLeftOutlined } from '@ant-design/icons'
import { Button, Card, Descriptions, Space, Table, Tag, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useNavigate, useParams } from 'react-router-dom'
import { useStore } from '../store'
import type { OrderStatus, OrderTransaction, UserStatus, UserType } from '../types'
import { usePerm } from '../perm'
import LocalTime from '../components/LocalTime'
import { resolveUserType } from '../userType'

const { Text } = Typography

const STATUS_COLOR: Record<OrderStatus, string> = {
  待支付: 'orange',
  已支付: 'green',
  已退款: 'red',
  已取消: 'default',
}
const USER_STATUS_COLOR: Record<UserStatus, string> = {
  '未付费-未体验': 'default',
  '未付费-体验中': 'gold',
  '未付费-已体验': 'blue',
  付费: 'green',
  付费逾期: 'red',
}

const USER_TYPE_COLOR: Record<UserType, string> = {
  测试用户: 'gold',
  正式用户: 'green',
}

function money(amount: number, currency: string) {
  return `${currency} ${amount.toLocaleString()}`
}

export default function OrderDetail({ backPath = '/orders' }: { backPath?: string }) {
  const navigate = useNavigate()
  const { t } = useI18n()
  const d = useDashboardText()
  const dashboardContext = useDashboardContext()
  const { orderId = '' } = useParams()
  const orders = useStore((s) => s.orders)
  const students = useStore((s) => s.students)
  const { allowedLines } = usePerm()
  const scope = allowedLines()
  const order = useMemo(() => orders.find((item) => item.orderId === orderId), [orders, orderId])
  const student = useMemo(() => students.find((item) => item.studentId === order?.studentId), [students, order?.studentId])
  const inScope = order && (!scope || (student && scope.includes(student.businessLine)))
  const back = <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(dashboardContext.ordersReturn || backPath, { state: dashboardContext.state })}>{d('backOrders')}</Button>

  if (!order || !inScope) {
    return (
      <Card className="page-card" bordered={false} title={<span className="section-title">{d('orderDetail')}</span>} extra={back}>
        <Text type="secondary">{d('noOrder')}</Text>
      </Card>
    )
  }

  const country = student?.country || student?.businessLine
  const couponCode = order.payMethod.startsWith('Airwallex') ? student?.couponCode : undefined
  const userType = student ? resolveUserType(student) : undefined
  const transactions = [...(order.transactions ?? [])].sort((a, b) => b.time.localeCompare(a.time))
  const columns: ColumnsType<OrderTransaction> = [
    { title: d('subOrder'), dataIndex: 'id', width: 190, render: (id) => <Text code>{id}</Text> },
    { title: d('recordTime'), dataIndex: 'time', width: 190, render: (time) => <LocalTime time={time} country={country} /> },
    { title: t('order.col.orderStatus'), dataIndex: 'status', width: 120, render: (status: OrderStatus) => <Tag color={STATUS_COLOR[status]}>{t(`enum.order.${status}`)}</Tag> },
    { title: d('amount'), dataIndex: 'amount', width: 150, align: 'right', render: (amount) => <Text type={amount < 0 ? 'danger' : undefined}>{money(amount, order.currency)}</Text> },
    { title: t('order.col.payMethod'), dataIndex: 'paymentMethod', width: 130, render: (method) => method || <Text type="secondary">—</Text> },
  ]

  return (
    <Space direction="vertical" size={16} style={{ display: 'flex' }}>
      <DashboardLinkContext />
      <Card className="page-card" bordered={false} title={<span className="section-title">{d('orderDetail')}</span>} extra={back}>
        <Descriptions column={2} bordered size="small">
          <Descriptions.Item label={t('order.col.id')}><Text code>{order.orderId}</Text></Descriptions.Item>
          <Descriptions.Item label={t('order.col.product')}>{order.productName}</Descriptions.Item>
          <Descriptions.Item label={t('user.col.id')}><Text code>{order.studentId}</Text></Descriptions.Item>
          <Descriptions.Item label={t('user.col.couponCode')}>{couponCode ? <Tag color="blue">{couponCode}</Tag> : '—'}</Descriptions.Item>
          <Descriptions.Item label={t('user.col.userType')}>{userType ? <Tag color={USER_TYPE_COLOR[userType]}>{t(`enum.userType.${userType}`)}</Tag> : '—'}</Descriptions.Item>
          <Descriptions.Item label={t('user.col.country')}>{country ? <Tag>{country}</Tag> : '—'}</Descriptions.Item>
          <Descriptions.Item label={t('user.col.status')}><Tag color={USER_STATUS_COLOR[order.userStatus]}>{t(`enum.status.${order.userStatus}`)}</Tag></Descriptions.Item>
          <Descriptions.Item label={t('order.col.orderStatus')}><Tag color={STATUS_COLOR[order.orderStatus]}>{t(`enum.order.${order.orderStatus}`)}</Tag></Descriptions.Item>
          <Descriptions.Item label={t('order.col.original')}>{money(order.originalPrice, order.currency)}</Descriptions.Item>
          <Descriptions.Item label={t('order.col.paid')}>{money(order.paidAmount, order.currency)}</Descriptions.Item>
          <Descriptions.Item label={t('order.col.payMethod')}>{order.payMethod}</Descriptions.Item>
          <Descriptions.Item label={t('order.col.paidTime')}><LocalTime time={order.paidTime} country={country} /></Descriptions.Item>
          <Descriptions.Item label={t('order.col.validUntil')}><LocalTime time={order.validUntil} country={country} /></Descriptions.Item>
        </Descriptions>
      </Card>

      <Card className="page-card" bordered={false} title={<span className="section-title">{d('orderTransactions')}</span>}>
        <Table rowKey="id" columns={columns} dataSource={transactions} scroll={{ x: 900 }} pagination={false} />
      </Card>
    </Space>
  )
}
