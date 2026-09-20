import { Alert, Button, Space } from 'antd'
import { ArrowLeftOutlined } from '@ant-design/icons'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import type { DashboardListScope } from '../dashboardNavigation'
import { useDashboardText } from '../dashboardText'

export function useDashboardContext() {
 const location = useLocation()
 const state = location.state as { dashboardReturn?: string; ordersReturn?: string; dashboardScope?: DashboardListScope } | null
 const dashboardReturn = state?.dashboardReturn && /^\/management-dashboard(?:\?|$)/.test(state.dashboardReturn) ? state.dashboardReturn : undefined
 const ordersReturn = state?.ordersReturn && /^\/orders-v3(?:\?|$)/.test(state.ordersReturn) ? state.ordersReturn : undefined
 const candidate = state?.dashboardScope
 const dashboardScope = dashboardReturn && candidate && typeof candidate.label === 'string' && Array.isArray(candidate.studentIds) && candidate.studentIds.every(id => typeof id === 'string') && (candidate.orderIds === undefined || (Array.isArray(candidate.orderIds) && candidate.orderIds.every(id => typeof id === 'string'))) ? candidate : undefined
 return { dashboardReturn, ordersReturn, dashboardScope, state: { dashboardReturn, ordersReturn, dashboardScope } }
}
export default function DashboardLinkContext({ filter = false }: { filter?: boolean }) {
 const d = useDashboardText()
 const navigate = useNavigate()
 const { dashboardReturn, dashboardScope } = useDashboardContext()
 const [query, setQuery] = useSearchParams()
 const id = filter ? query.get('studentId') : null
 if (!dashboardReturn && !id) return null
 return <Alert style={{ marginBottom: 16 }} type="info" message={<Space wrap>
   {dashboardReturn && <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(dashboardReturn)}>{d('back')}</Button>}
   {dashboardScope && <><span>{d('dashboardSelection')}: <strong>{dashboardScope.label}</strong></span><Button type="link" onClick={() => setQuery(query, { replace: true, state: { dashboardReturn } })}>{d('clearDashboardSelection')}</Button></>}
   {id && <><span>{d('filtered')}: <strong>{id}</strong></span><Button type="link" onClick={() => { const next = new URLSearchParams(query); next.delete('studentId'); setQuery(next, { state: { dashboardReturn } }) }}>{d('clear')}</Button></>}
 </Space>} />
}
