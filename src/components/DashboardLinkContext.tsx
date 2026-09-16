import { Alert, Button, Space } from 'antd'
import { ArrowLeftOutlined } from '@ant-design/icons'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useDashboardText } from '../dashboardText'

export function useDashboardContext() {
 const location = useLocation()
 const state = location.state as { dashboardReturn?: string; ordersReturn?: string } | null
 const dashboardReturn = state?.dashboardReturn && /^\/management-dashboard(?:\?|$)/.test(state.dashboardReturn) ? state.dashboardReturn : undefined
 const ordersReturn = state?.ordersReturn && /^\/orders-v3(?:\?|$)/.test(state.ordersReturn) ? state.ordersReturn : undefined
 return { dashboardReturn, ordersReturn, state: { dashboardReturn, ordersReturn } }
}
export default function DashboardLinkContext({ filter = false }: { filter?: boolean }) {
 const d = useDashboardText()
 const navigate = useNavigate()
 const { dashboardReturn } = useDashboardContext()
 const [query, setQuery] = useSearchParams()
 const id = filter ? query.get('studentId') : null
 if (!dashboardReturn && !id) return null
 return <Alert style={{ marginBottom: 16 }} type="info" message={<Space wrap>
   {dashboardReturn && <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(dashboardReturn)}>{d('back')}</Button>}
   {id && <><span>{d('filtered')}: <strong>{id}</strong></span><Button type="link" onClick={() => { const next = new URLSearchParams(query); next.delete('studentId'); setQuery(next, { state: { dashboardReturn } }) }}>{d('clear')}</Button></>}
 </Space>} />
}
