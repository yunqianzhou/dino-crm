import { Alert, Button, Card, DatePicker, Empty, Modal, Segmented, Select, Space, Table, Tag, Typography } from 'antd'
import { ArrowRightOutlined, TeamOutlined } from '@ant-design/icons'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import dayjs from 'dayjs'
import type { ColumnsType } from 'antd/es/table'
import { useStore } from '../store'
import { usePerm } from '../perm'
import { useI18n } from '../i18n'
import { useDashboardText, type DashboardWord } from '../dashboardText'
import { dashboardMetrics, dashboardPopulation, dashboardDateRows, PERIOD_METRICS, type DashboardFilters } from '../dashboardData'
import { consultationStage, CONSULTATION_STAGES, CONSULTATION_STAGE_COLOR } from '../salesLifecycle'
import { isSalesLead } from '../funnel'
import type { Student } from '../types'
import LocalTime from '../components/LocalTime'
import './ManagementDashboard.css'

export default function ManagementDashboard() {
 const d = useDashboardText()
 const { t, lang } = useI18n()
 const { can, allowedLines, actor } = usePerm()
 const students = useStore(s => s.students)
 const calls = useStore(s => s.callRecords ?? [])
 const lessons = useStore(s => s.lessons ?? [])
 const accounts = useStore(s => s.accounts)
 const [query, setQuery] = useSearchParams()
 const location = useLocation()
 const navigate = useNavigate()
 const date = (key: string) => { const v = query.get(key) || ''; return /^\d{4}-\d{2}-\d{2}$/.test(v) && dayjs(v).isValid() ? v : '' }
 const filters: DashboardFilters = { mode: query.get('mode') === 'period' ? 'period' : 'current', start: date('start'), end: date('end'), owner: query.get('cc') || '', userType: query.has('type') ? query.get('type') || '' : '正式用户' }
 const change = (values: Record<string, string>) => { const next = new URLSearchParams(query); Object.entries(values).forEach(([k, v]) => next.set(k, v)); next.delete('detail'); next.delete('detailCC'); next.delete('detailDate'); setQuery(next) }
 const scope = allowedLines()
 const population = dashboardPopulation(students, scope, scope === null || can('salesV3_reassign') === 'operate', actor)
 const metrics = dashboardMetrics(population, calls, lessons, filters)
 const ownerName = (id: string) => id === '__unassigned__' ? d('unassigned') : accounts.find(a => a.email === id)?.name || id
 const ownerIds = [...new Set(population.map(s => s.salesOwner || '__unassigned__'))].sort()
 const title = (metric: string) => (CONSULTATION_STAGES as readonly string[]).includes(metric) ? t(`sales.consultation.stage.${metric}`) : d(metric as DashboardWord)
 const keys = filters.mode === 'current' ? ['total', ...CONSULTATION_STAGES] : [...PERIOD_METRICS]
 const ccRows = ownerIds.filter(id => !filters.owner || filters.owner === id).map(id => ({ id, name: ownerName(id), metrics: Object.fromEntries(Object.entries(metrics).map(([key, rows]) => [key, rows.filter(s => (s.salesOwner || '__unassigned__') === id)])) })).filter(row => Object.values(row.metrics).some(rows => rows.length))
 const grouping = query.get('group') === 'date' ? 'date' : 'cc'
 const dateRows = dashboardDateRows(population, calls, lessons, filters)
 const breakdownRows = grouping === 'date' ? dateRows : ccRows
 const open = (metric: string, cc?: string, day?: string) => { const next = new URLSearchParams(query); next.set('detail', metric); if (cc) next.set('detailCC', cc); else next.delete('detailCC'); if (day) next.set('detailDate', day); else next.delete('detailDate'); setQuery(next) }
 const rawDetail = query.get('detail') || ''
 const detail = [...keys, 'assigned', 'unassigned'].includes(rawDetail) ? rawDetail : ''
 const detailCC = query.get('detailCC') || ''
 const detailDate = date('detailDate')
 const detailMetrics = detailDate ? dateRows.find(row => row.id === detailDate)?.metrics || {} : metrics
 const detailRows = (detailMetrics[detail] || []).filter(s => !detailCC || (s.salesOwner || '__unassigned__') === detailCC)
 const close = () => { const next = new URLSearchParams(query); next.delete('detail'); next.delete('detailCC'); next.delete('detailDate'); setQuery(next) }
 const go = (path: string) => navigate(path, { state: { dashboardReturn: location.pathname + location.search } })
 const count = (key: string, cc?: string, n = (metrics[key] || []).length, day?: string) => <button className="dashboard-count" onClick={() => open(key, cc, day)} aria-label={`${title(key)} · ${cc ? ownerName(cc) + ' · ' : ''}${day ? day + ' · ' : ''}${n}`}>{n.toLocaleString(lang === 'zh' ? 'zh-CN' : 'en-US')}</button>
 const columns: ColumnsType<Student> = [
   { title: t('user.col.id'), dataIndex: 'studentId', width: 200, render: (id, s) => can('usersV2') !== 'none' ? <Button type="link" style={{ padding: 0 }} onClick={() => go(`/users-v2/${encodeURIComponent(s.studentId)}`)}>{id}</Button> : id },
   { title: t('user.col.name'), dataIndex: 'name', width: 130 },
   { title: d('currentCC'), width: 150, render: (_, s) => ownerName(s.salesOwner || '__unassigned__') },
   { title: t('user.col.regTime'), width: 180, render: (_, s) => <LocalTime time={s.registerTime} country="越南" /> },
   { title: d('stageTitle'), width: 180, render: (_, s) => isSalesLead(s, lessons) ? <Tag color={CONSULTATION_STAGE_COLOR[consultationStage(s, calls)]}>{title(consultationStage(s, calls))}</Tag> : t(`enum.status.${s.status}`) },
   { title: t('common.action'), width: 260, render: (_, s) => <Space wrap>
     {can('salesV3') !== 'none' && isSalesLead(s, lessons) && <Button size="small" type="link" onClick={() => go(`/sales-v3?studentId=${encodeURIComponent(s.studentId)}&tab=${s.salesOwner ? 'follow' : 'pool'}`)}>{d('salesAction')}</Button>}
     {can('usersV2') !== 'none' && <Button size="small" type="link" onClick={() => go(`/users-v2/${encodeURIComponent(s.studentId)}`)}>{d('userAction')}</Button>}
     {can('ordersV3') !== 'none' && <Button size="small" type="link" onClick={() => go(`/orders-v3?studentId=${encodeURIComponent(s.studentId)}`)}>{d('orderAction')}</Button>}
   </Space> },
 ]
 return <div className="management-dashboard">
   <header className="dashboard-heading"><div><Tag color="blue">{lang === 'zh' ? '越南' : 'Vietnam'} · UTC+7</Tag><Typography.Title level={2}>{d('title')}</Typography.Title><Typography.Text type="secondary">{d('subtitle')}</Typography.Text></div><TeamOutlined className="dashboard-heading-icon" /></header>
   <Card className="dashboard-filters"><Space wrap size={16}>
     <Segmented value={filters.mode} onChange={v => change({ mode: String(v) })} options={[{ value: 'current', label: d('current') }, { value: 'period', label: d('period') }]} />
     <Select aria-label={d('currentCC')} value={filters.owner} style={{ minWidth: 180 }} onChange={v => change({ cc: v })} options={[{ value: '', label: d('allCC') }, ...ownerIds.map(id => ({ value: id, label: ownerName(id) }))]} />
     <Select aria-label={t('user.col.userType')} value={filters.userType} style={{ minWidth: 160 }} onChange={v => change({ type: v })} options={[{ value: '', label: d('allTypes') }, ...['正式用户', '测试用户'].map(v => ({ value: v, label: t(`enum.userType.${v}`) }))]} />
     <div className="dashboard-date"><span>{d(filters.mode === 'current' ? 'registerDates' : 'recordDates')}</span><DatePicker.RangePicker value={filters.start && filters.end ? [dayjs(filters.start), dayjs(filters.end)] : null} placeholder={[d('allDates'), d('allDates')]} onChange={v => change({ start: v?.[0]?.format('YYYY-MM-DD') || '', end: v?.[1]?.format('YYYY-MM-DD') || '' })} /></div>
   </Space><p className="dashboard-help">{d(filters.mode === 'current' ? 'currentHelp' : 'periodHelp')}</p></Card>
   <Alert type="info" showIcon message={d('demo')} />
   <div className={`dashboard-kpis ${filters.mode === 'period' ? 'dashboard-period' : ''}`}>
     {(filters.mode === 'current' ? ['total', 'assigned', 'unassigned'] : [...PERIOD_METRICS]).map(key => <Card key={key}><div className="dashboard-kpi-label">{title(key)}</div>{count(key)}<ArrowRightOutlined /></Card>)}
   </div>
   {filters.mode === 'current' && <Card title={d('stageTitle')}><p className="dashboard-help">{d('stageHelp')}</p><div className="dashboard-stages">{CONSULTATION_STAGES.map(stage => <div key={stage}><span>{title(stage)}</span>{count(stage)}</div>)}</div></Card>}
   {filters.mode === 'period' && <Alert type="info" message={d('periodNote')} />}
   <Card title={d('breakdown')}>
    <Segmented style={{ marginBottom: 16 }} value={grouping} onChange={v => change({ group: String(v) })} options={[{ value: 'cc', label: d('ccTitle') }, { value: 'date', label: d('dateTitle') }]} />
    <p className="dashboard-help">{d(grouping === 'cc' ? 'ccHelp' : filters.mode === 'current' ? 'dateCurrentHelp' : 'datePeriodHelp')}</p>
    <Table rowKey="id" size="middle" dataSource={breakdownRows} scroll={{ x: filters.mode === 'current' ? 1500 : 1050 }} pagination={grouping === 'date' ? { pageSize: 10, showSizeChanger: false } : false} locale={{ emptyText: <Empty description={d('noRows')} image={Empty.PRESENTED_IMAGE_SIMPLE} /> }} columns={[
     { title: d(grouping === 'cc' ? 'currentCC' : filters.mode === 'current' ? 'registerDates' : 'recordDates'), dataIndex: 'name', key: 'group', fixed: 'left', width: 170 },
     ...keys.map(key => ({ title: title(key), key, width: 135, render: (_: unknown, row: typeof breakdownRows[number]) => count(key, grouping === 'cc' ? row.id : undefined, (row.metrics[key] || []).length, grouping === 'date' ? row.id : undefined) })),
    ]} summary={() => breakdownRows.length ? <Table.Summary.Row>
      <Table.Summary.Cell index={0}><strong>{d(filters.mode === 'current' ? 'currentTotal' : 'periodTotal')}</strong></Table.Summary.Cell>
      {keys.map((key, i) => <Table.Summary.Cell index={i + 1} key={key}>{count(key)}</Table.Summary.Cell>)}
    </Table.Summary.Row> : null} />
   </Card>
   <p className="dashboard-footnote">{d('unavailable')}</p>
   <Modal open={!!detail && (keys.includes(detail) || ['assigned', 'unassigned'].includes(detail))} onCancel={close} footer={<Button onClick={close}>{t('common.close')}</Button>} width={1180} title={`${d('users')} · ${detail ? title(detail) : ''}${detailCC ? ' · ' + ownerName(detailCC) : ''}${detailDate ? ' · ' + detailDate : ''}`}>
    <p className="dashboard-help">{detailRows.length} {d('count')} · {detailDate ? `${d(filters.mode === 'current' ? 'registerDates' : 'recordDates')}: ${detailDate}` : d('currentCC')} · UTC+7</p>
    <Table rowKey="studentId" columns={columns} dataSource={detailRows} scroll={{ x: 1100 }} pagination={{ pageSize: 10, showSizeChanger: false, showTotal: n => t('common.total', { n }) }} locale={{ emptyText: d('noRows') }} />
   </Modal>
 </div>
}
