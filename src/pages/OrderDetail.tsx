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
const STATUS_LABEL: Record<OrderStatus, string> = {
  已退款: '已退费',
  已取消: '已取消',
  已支付: '已支付',
  待支付: '待支付',
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
  const { orderId = '' } = useParams()
  const orders = useStore((s) => s.orders)
  const students = useStore((s) => s.students)
  const { allowedLines } = usePerm()
  const scope = allowedLines()
  const order = useMemo(() => orders.find((item) => item.orderId === orderId), [orders, orderId])
  const student = useMemo(() => students.find((item) => item.studentId === order?.studentId), [students, order?.studentId])
  const inScope = order && (!scope || (student && scope.includes(student.businessLine)))
  const back = <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(backPath)}>返回订单中心</Button>

  if (!order || !inScope) {
    return (
      <Card className="page-card" bordered={false} title={<span className="section-title">订单详情</span>} extra={back}>
        <Text type="secondary">未找到该订单，或你没有访问权限。</Text>
      </Card>
    )
  }

  const country = student?.country || student?.businessLine
  const couponCode = order.payMethod.startsWith('Airwallex') ? student?.couponCode : undefined
  const userType = student ? resolveUserType(student) : undefined
  const transactions = [...(order.transactions ?? [])].sort((a, b) => b.time.localeCompare(a.time))
  const columns: ColumnsType<OrderTransaction> = [
    { title: '子订单号', dataIndex: 'id', width: 190, render: (id) => <Text code>{id}</Text> },
    { title: '发生时间', dataIndex: 'time', width: 190, render: (time) => <LocalTime time={time} country={country} /> },
    { title: '订单状态', dataIndex: 'status', width: 120, render: (status: OrderStatus) => <Tag color={STATUS_COLOR[status]}>{STATUS_LABEL[status]}</Tag> },
    { title: '金额', dataIndex: 'amount', width: 150, align: 'right', render: (amount) => <Text type={amount < 0 ? 'danger' : undefined}>{money(amount, order.currency)}</Text> },
    { title: '支付方式', dataIndex: 'paymentMethod', width: 130, render: (method) => method || <Text type="secondary">—</Text> },
  ]

  return (
    <Space direction="vertical" size={16} style={{ display: 'flex' }}>
      <Card className="page-card" bordered={false} title={<span className="section-title">订单详情</span>} extra={back}>
        <Descriptions column={2} bordered size="small">
          <Descriptions.Item label="订单 ID"><Text code>{order.orderId}</Text></Descriptions.Item>
          <Descriptions.Item label="商品名称">{order.productName}</Descriptions.Item>
          <Descriptions.Item label="用户 ID"><Text code>{order.studentId}</Text></Descriptions.Item>
          <Descriptions.Item label="优惠码">{couponCode ? <Tag color="blue">{couponCode}</Tag> : '—'}</Descriptions.Item>
          <Descriptions.Item label="用户类型">{userType ? <Tag color={USER_TYPE_COLOR[userType]}>{userType}</Tag> : '—'}</Descriptions.Item>
          <Descriptions.Item label="国家">{country ? <Tag>{country}</Tag> : '—'}</Descriptions.Item>
          <Descriptions.Item label="用户状态"><Tag color={USER_STATUS_COLOR[order.userStatus]}>{order.userStatus}</Tag></Descriptions.Item>
          <Descriptions.Item label="订单状态"><Tag color={STATUS_COLOR[order.orderStatus]}>{STATUS_LABEL[order.orderStatus]}</Tag></Descriptions.Item>
          <Descriptions.Item label="原价">{money(order.originalPrice, order.currency)}</Descriptions.Item>
          <Descriptions.Item label="实际付款金额">{money(order.paidAmount, order.currency)}</Descriptions.Item>
          <Descriptions.Item label="支付方式">{order.payMethod}</Descriptions.Item>
          <Descriptions.Item label="成功支付时间"><LocalTime time={order.paidTime} country={country} /></Descriptions.Item>
          <Descriptions.Item label="有效期到期时间"><LocalTime time={order.validUntil} country={country} /></Descriptions.Item>
        </Descriptions>
      </Card>

      <Card className="page-card" bordered={false} title={<span className="section-title">订单流水</span>}>
        <Table rowKey="id" columns={columns} dataSource={transactions} scroll={{ x: 900 }} pagination={false} />
      </Card>
    </Space>
  )
}
