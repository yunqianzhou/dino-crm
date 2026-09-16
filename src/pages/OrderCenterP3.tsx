import { Alert, Space } from 'antd'
import OrderCenter from './OrderCenter'
import { useDashboardText } from '../dashboardText'
export default function OrderCenterP3() {
 const d = useDashboardText()
 return <Space direction="vertical" size={16} style={{ display: 'flex' }}>
   <Alert showIcon type="info" message={d('ordersIntro')} />
   <OrderCenter detailsPath="/orders-v3" exportPermission="ordersV3_export" />
 </Space>
}
