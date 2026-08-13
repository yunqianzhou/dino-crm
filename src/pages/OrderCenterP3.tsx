import { Alert, Space, Tag, Typography } from 'antd'
import OrderCenter from './OrderCenter'

const { Text } = Typography

export default function OrderCenterP3() {
  return (
    <Space direction="vertical" size={16} style={{ display: 'flex' }}>
      <Alert
        showIcon
        type="info"
        message={<span><Text strong>三期功能 · 订单详情</Text><Tag color="purple" style={{ marginLeft: 8 }}>三期</Tag>点击订单 ID 查看订单详情及全部交易流水。</span>}
      />
      <OrderCenter detailsPath="/orders-v3" exportPermission="ordersV3_export" />
    </Space>
  )
}
