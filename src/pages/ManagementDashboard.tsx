import { useState } from 'react'
import { Button, Card, DatePicker, Empty, Modal, Progress, Segmented, Select, Space, Table, Tag, Typography } from 'antd'
import { ArrowRightOutlined } from '@ant-design/icons'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import dayjs from 'dayjs'
import type { ColumnsType } from 'antd/es/table'
import { useStore } from '../store'
import { usePerm } from '../perm'
import { useI18n } from '../i18n'
import { useDashboardText, type DashboardWord } from '../dashboardText'
import { dashboardMetrics, dashboardPopulation, dashboardDateRows, dashboardGroupRows, dashboardReasonRows, REASON_KINDS, PERIOD_METRICS, type DashboardFilters, type DashboardGrouping, type ReasonKind } from '../dashboardData'
import { consultationStage, CONSULTATION_STAGES, CONSULTATION_STAGE_COLOR } from '../salesLifecycle'
import { isSalesLead } from '../funnel'
import type { Student } from '../types'
import LocalTime from '../components/LocalTime'
import './ManagementDashboard.css'

export default function ManagementDashboard() {
 const d = useDashboardText()
 const [rulesOpen, setRulesOpen] = useState(false)
 const { t, lang } = useI18n()
 const { can, allowedLines, actor } = usePerm()
 const students = useStore(s => s.students)
 const calls = useStore(s => s.callRecords ?? [])
 const lessons = useStore(s => s.lessons ?? [])
 const orders = useStore(s => s.orders)
 const accounts = useStore(s => s.accounts)
 const [query, setQuery] = useSearchParams()
 const location = useLocation()
 const navigate = useNavigate()
 const date = (key: string) => { const v = query.get(key) || ''; return /^\d{4}-\d{2}-\d{2}$/.test(v) && dayjs(v).isValid() ? v : '' }
 const filters: DashboardFilters = { mode: query.get('mode') === 'period' ? 'period' : 'current', start: date('start'), end: date('end'), owner: query.get('cc') || '', userType: '正式用户' }
 const clearDetail = (params: URLSearchParams) => ['detail', 'detailCC', 'detailDate', 'detailGroup', 'detailValue', 'detailReason', 'detailKind', 'type'].forEach(key => params.delete(key))
 const change = (values: Record<string, string>) => { const next = new URLSearchParams(query); Object.entries(values).forEach(([k, v]) => next.set(k, v)); clearDetail(next); setQuery(next) }
 const scope = allowedLines()
 const population = dashboardPopulation(students, scope, scope === null || can('salesV3_reassign') === 'operate', actor)
 const metrics = dashboardMetrics(population, calls, lessons, filters, orders)
 const ownerName = (id: string) => id === '__unassigned__' ? d('unassigned') : accounts.find(a => a.email === id)?.name || id
 const ownerIds = [...new Set(population.map(s => s.salesOwner || '__unassigned__'))].sort()
 const title = (metric: string) => (CONSULTATION_STAGES as readonly string[]).includes(metric) ? t(`sales.consultation.stage.${metric}`) : d(metric as DashboardWord)
 const keys = filters.mode === 'current' ? ['total', ...CONSULTATION_STAGES, 'paid'] : [...PERIOD_METRICS]
 const groupValues: DashboardGrouping[] = ['cc', 'date', 'intent', 'age', 'registrationAge']
 const grouping = (groupValues.includes(query.get('group') as DashboardGrouping) ? query.get('group') : 'cc') as DashboardGrouping
 const groupLabels = { cc: d('ccTitle'), date: d('dateTitle'), intent: d('groupIntent'), age: d('groupAge'), registrationAge: d('groupRegistrationAge') }
 const groupName = (group: DashboardGrouping, id: string): string => group === 'cc' ? ownerName(id) : id === '__unknown__' ? d('unknown') : group === 'intent' ? t(`sales.purchaseIntention.${id === '有意向' ? 'yes' : id === '无意向' ? 'no' : 'none'}`) : group === 'registrationAge' ? `${id} ${d('days')}` : id
 const dateRows = dashboardDateRows(population, calls, lessons, filters, orders)
 const breakdownRows = (grouping === 'date' ? dateRows : dashboardGroupRows(metrics, grouping)).map(row => ({ ...row, name: groupName(grouping, row.id) }))
 const reasonKind = (REASON_KINDS.includes(query.get('reasonKind') as ReasonKind) ? query.get('reasonKind') : 'noShow') as ReasonKind
 const reasonRows = dashboardReasonRows(population, calls, lessons, filters, reasonKind)
 const reasonName = (id: string) => id === '__unknown__' ? d('unknown') : t(`sales.consultation.reasonOption.${id}`)
 const open = (metric: string, group?: DashboardGrouping, value?: string) => { const next = new URLSearchParams(query); clearDetail(next); next.set('detail', metric); if (group && value) { next.set('detailGroup', group); next.set('detailValue', value) }; setQuery(next) }
 const openReason = (id: string) => { const next = new URLSearchParams(query); clearDetail(next); next.set('detailReason', id); next.set('detailKind', reasonKind); setQuery(next) }
 const rawDetail = query.get('detail') || ''
 const detail = [...keys, 'assigned', 'unassigned'].includes(rawDetail) ? rawDetail : ''
 const legacyGroup = query.has('detailDate') ? 'date' : query.has('detailCC') ? 'cc' : ''
 const detailGroup = query.get('detailGroup') || legacyGroup
 const detailValue = query.get('detailValue') || query.get('detailDate') || query.get('detailCC') || ''
 const detailKind = (REASON_KINDS.includes(query.get('detailKind') as ReasonKind) ? query.get('detailKind') : reasonKind) as ReasonKind
 const detailReason = query.get('detailReason') || ''
 const detailMetricRows = detailGroup === 'date' ? dateRows.find(row => row.id === detailValue)?.metrics || {} : groupValues.includes(detailGroup as DashboardGrouping) ? dashboardGroupRows(metrics, detailGroup as Exclude<DashboardGrouping, 'date'>).find(row => row.id === detailValue)?.metrics || {} : metrics
 const detailRows = detailReason ? dashboardReasonRows(population, calls, lessons, filters, detailKind).find(row => row.id === detailReason)?.users || [] : detailMetricRows[detail] || []
 const detailLabel = detailReason ? `${d(detailKind)} · ${reasonName(detailReason)}` : `${detail ? title(detail) : ''}${detailValue && groupValues.includes(detailGroup as DashboardGrouping) ? ' · ' + groupName(detailGroup as DashboardGrouping, detailValue) : ''}`
 const close = () => { const next = new URLSearchParams(query); clearDetail(next); setQuery(next) }
 const reset = () => change({ start: '', end: '', cc: '' })
 const today = dayjs().utcOffset(420)
 const go = (path: string) => navigate(path, { state: { dashboardReturn: location.pathname + location.search } })
 const count = (key: string, n = (metrics[key] || []).length, group?: DashboardGrouping, value?: string) => <button className="dashboard-count" onClick={() => open(key, group, value)} aria-label={`${title(key)} · ${group && value ? groupName(group, value) + ' · ' : ''}${n}`}>{n.toLocaleString(lang === 'zh' ? 'zh-CN' : 'en-US')}</button>
 const columns: ColumnsType<Student> = [
   { title: t('user.col.id'), dataIndex: 'studentId', width: 200, render: (id, s) => can('usersV2') !== 'none' ? <Button type="link" style={{ padding: 0 }} onClick={() => go(`/users-v2/${encodeURIComponent(s.studentId)}`)}>{id}</Button> : id },
   { title: t('user.col.name'), dataIndex: 'name', width: 130 },
   { title: d('currentCC'), width: 150, render: (_, s) => ownerName(s.salesOwner || '__unassigned__') },
   { title: t('user.col.regTime'), width: 180, render: (_, s) => <LocalTime time={s.registerTime} country="越南" /> },
   { title: d('intent'), width: 130, render: (_, s) => groupName('intent', s.purchaseIntention || '未填写') },
   { title: d('age'), dataIndex: 'ageGroup', width: 100, render: v => v || d('unknown') },
   { title: d('stageTitle'), width: 180, render: (_, s) => isSalesLead(s, lessons) ? <Tag color={CONSULTATION_STAGE_COLOR[consultationStage(s, calls)]}>{title(consultationStage(s, calls))}</Tag> : t(`enum.status.${s.status}`) },
   { title: t('common.action'), width: 260, render: (_, s) => <Space wrap>
     {can('salesV3') !== 'none' && isSalesLead(s, lessons) && <Button size="small" type="link" onClick={() => go(`/sales-v3?studentId=${encodeURIComponent(s.studentId)}&tab=${s.salesOwner ? 'follow' : 'pool'}`)}>{d('salesAction')}</Button>}
     {can('usersV2') !== 'none' && <Button size="small" type="link" onClick={() => go(`/users-v2/${encodeURIComponent(s.studentId)}`)}>{d('userAction')}</Button>}
     {can('ordersV3') !== 'none' && <Button size="small" type="link" onClick={() => go(`/orders-v3?studentId=${encodeURIComponent(s.studentId)}`)}>{d('orderAction')}</Button>}
   </Space> },
 ]
 return <div className="management-dashboard">
   <header className="dashboard-heading"><div><Space><Tag color="blue">{d('scope')}</Tag><Tag>{d('demoTag')}</Tag></Space><Typography.Title level={2}>{d('title')}</Typography.Title><Typography.Text type="secondary">{d('subtitle')}</Typography.Text></div><Button onClick={() => setRulesOpen(true)}>{d('rules')}</Button></header>
   <Card className="dashboard-filters"><Space wrap size={16}>
     <Segmented value={filters.mode} onChange={v => change({ mode: String(v) })} options={[{ value: 'current', label: d('current') }, { value: 'period', label: d('period') }]} />
     <Select aria-label={d('currentCC')} value={filters.owner} style={{ minWidth: 180 }} onChange={v => change({ cc: v })} options={[{ value: '', label: d('allCC') }, ...ownerIds.map(id => ({ value: id, label: ownerName(id) }))]} />
     <div className="dashboard-date"><span>{d(filters.mode === 'current' ? 'registerDates' : 'recordDates')}</span><DatePicker.RangePicker value={filters.start && filters.end ? [dayjs(filters.start), dayjs(filters.end)] : null} placeholder={[d('allDates'), d('allDates')]} presets={[{ label: d('today'), value: [today, today] }, { label: d('last7'), value: [today.subtract(6, 'day'), today] }, { label: d('thisMonth'), value: [today.startOf('month'), today] }]} onChange={v => change({ start: v?.[0]?.format('YYYY-MM-DD') || '', end: v?.[1]?.format('YYYY-MM-DD') || '' })} /></div>
     {(filters.owner || filters.start || filters.end) && <Button type="text" onClick={reset}>{d('resetFilters')}</Button>}
   </Space><p className="dashboard-help">{d(filters.mode === 'current' ? 'currentHelp' : 'periodHelp')}</p></Card>
   <div className={`dashboard-kpis ${filters.mode === 'period' ? 'dashboard-period' : ''}`}>
     {(filters.mode === 'current' ? ['total', 'assigned', 'unassigned', 'paid'] : [...PERIOD_METRICS]).map(key => <Card key={key} className={key === 'paid' ? 'dashboard-paid' : undefined}><div className="dashboard-kpi-label">{title(key)}</div>{count(key)}{key === 'paid' && <p className="dashboard-paid-hint">{d(filters.mode === 'current' ? 'paidCurrent' : 'paidPeriod')}</p>}<ArrowRightOutlined /></Card>)}
   </div>
   {filters.mode === 'current' && <Card title={d('stageTitle')}><p className="dashboard-help">{d('stageHelp')}</p><div className="dashboard-stages">{CONSULTATION_STAGES.map(stage => <div key={stage}><div className="dashboard-stage-line"><span>{title(stage)}</span>{count(stage)}</div><Progress percent={metrics.total?.length ? Math.round((metrics[stage]?.length || 0) / metrics.total.length * 1000) / 10 : 0} size="small" strokeColor="#5086ee" format={p => `${p}%`} /><span className="dashboard-stage-share">{d('stageShare')}</span></div>)}</div></Card>}
   <Card title={d('breakdown')}>
    <Segmented style={{ marginBottom: 16 }} value={grouping} onChange={v => change({ group: String(v) })} className="dashboard-grouping" options={groupValues.map(value => ({ value, label: groupLabels[value] }))} />
    <p className="dashboard-help">{d(grouping === 'cc' ? 'ccHelp' : grouping === 'date' ? filters.mode === 'current' ? 'dateCurrentHelp' : 'datePeriodHelp' : grouping === 'registrationAge' ? 'registrationAgeHelp' : 'groupHelp')}</p>
    <Table rowKey="id" size="middle" dataSource={breakdownRows} scroll={{ x: filters.mode === 'current' ? 1650 : 1200 }} pagination={grouping === 'date' ? { pageSize: 10, showSizeChanger: false } : false} locale={{ emptyText: <Empty description={d('noRows')} image={Empty.PRESENTED_IMAGE_SIMPLE} /> }} columns={[
     { title: grouping === 'cc' ? d('currentCC') : grouping === 'date' ? d(filters.mode === 'current' ? 'registerDates' : 'recordDates') : d(grouping), dataIndex: 'name', key: 'group', fixed: 'left', width: 170 },
     ...keys.map(key => ({ title: title(key), key, width: 135, render: (_: unknown, row: typeof breakdownRows[number]) => count(key, (row.metrics[key] || []).length, grouping, row.id) })),
    ]} summary={() => breakdownRows.length ? <Table.Summary.Row>
      <Table.Summary.Cell index={0}><strong>{d(filters.mode === 'current' ? 'currentTotal' : 'periodTotal')}</strong></Table.Summary.Cell>
      {keys.map((key, i) => <Table.Summary.Cell index={i + 1} key={key}>{count(key)}</Table.Summary.Cell>)}
    </Table.Summary.Row> : null} />
   </Card>
   <Card title={d('reasons')}>
     <Segmented className="dashboard-grouping" value={reasonKind} onChange={v => change({ reasonKind: String(v) })} options={REASON_KINDS.map(value => ({ value, label: d(value) }))} />
     <p className="dashboard-help" style={{ marginTop: 16 }}>{d(filters.mode === 'current' ? 'currentReasonHelp' : 'periodReasonHelp')}</p>
     <Table rowKey="id" size="middle" pagination={false} dataSource={reasonRows} locale={{ emptyText: <Empty description={d('noReasons')} image={Empty.PRESENTED_IMAGE_SIMPLE} /> }} columns={[
       { title: d('reason'), dataIndex: 'id', render: id => reasonName(id) },
       { title: d('usersCount'), width: 150, render: (_, row) => <button className="dashboard-count" aria-label={`${d(reasonKind)} · ${reasonName(row.id)} · ${row.users.length}`} onClick={() => openReason(row.id)}>{row.users.length}</button> },
       ...(filters.mode === 'current' ? [{ title: d('share'), width: 220, render: (_: unknown, row: typeof reasonRows[number]) => <Progress size="small" percent={Math.round(row.users.length / (reasonRows.reduce((sum, r) => sum + r.users.length, 0) || 1) * 1000) / 10} /> }] : []),
     ]} />
   </Card>
   <p className="dashboard-footnote">{d('demo')} <Button type="link" size="small" onClick={() => setRulesOpen(true)}>{d('rules')}</Button></p>
   <Modal open={rulesOpen} onCancel={() => setRulesOpen(false)} footer={<Button onClick={() => setRulesOpen(false)}>{t('common.close')}</Button>} title={d('rules')}>
     {[d('formalOnly'), d('paidRule'), d('currentHelp'), d('periodHelp'), d('periodNote'), d('registrationAgeHelp'), d('intentNote'), d('limits')].map(text => <p key={text}>{text}</p>)}
   </Modal>
   <Modal open={!!detail || !!detailReason} onCancel={close} footer={<Button onClick={close}>{t('common.close')}</Button>} width={1280} title={`${d('users')} · ${detailLabel}`}>
    <p className="dashboard-help">{detailRows.length} {d('count')} · {d('currentCC')} · UTC+7</p>
    <Table rowKey="studentId" columns={columns} dataSource={detailRows} scroll={{ x: 1100 }} pagination={{ pageSize: 10, showSizeChanger: false, showTotal: n => t('common.total', { n }) }} locale={{ emptyText: d('noRows') }} />
   </Modal>
 </div>
}
