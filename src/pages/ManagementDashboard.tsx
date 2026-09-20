import { useState } from 'react'
import { Button, Card, DatePicker, Empty, Modal, Progress, Radio, Segmented, Select, Space, Table, Tag, Typography } from 'antd'
import { ArrowRightOutlined } from '@ant-design/icons'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import dayjs from 'dayjs'
import type { ColumnsType } from 'antd/es/table'
import { useStore } from '../store'
import { usePerm } from '../perm'
import { useI18n } from '../i18n'
import { useDashboardText, type DashboardWord } from '../dashboardText'
import { dashboardMetrics, dashboardPopulation, dashboardDateRows, dashboardGroupRows, dashboardReasonRows, dashboardCohortMetrics, dashboardCohortRows, dashboardCohortRates, dashboardBreakdownPayments, dashboardPaymentOrders, COHORT_METRICS, type CohortMetric, type CohortDimension, type CohortRow, REASON_KINDS, PERIOD_METRICS, type DashboardFilters, type DashboardGrouping, type ReasonKind } from '../dashboardData'
import { consultationStage, CONSULTATION_STAGES, CONSULTATION_STAGE_COLOR } from '../salesLifecycle'
import { isSalesLead } from '../funnel'
import type { Student } from '../types'
import LocalTime from '../components/LocalTime'
import DashboardPayments from '../components/DashboardPayments'
import DashboardMoneyCell from '../components/DashboardMoneyCell'
import { DASHBOARD_VIEWS, dashboardView, dashboardViewRange, dashboardSwitchView, type DashboardView } from '../dashboardView'
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
 const view = dashboardView(query)
 const rawRange = dashboardViewRange(query, view)
 const validDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && dayjs(v).isValid() ? v : ''
 const filters: DashboardFilters = { mode: view === 'period' || view === 'payments' ? 'period' : 'current', start: validDate(rawRange.start), end: validDate(rawRange.end), owner: query.get('cc') || '', userType: '正式用户' }
 const isLeadView = view === 'current' || view === 'period'
 const viewText = { current: { label: 'viewCurrent', question: 'questionCurrent', read: 'readCurrent', next: 'nextCurrent', date: 'registerDates', meaning: 'dateCurrentMeaning' }, period: { label: 'viewPeriod', question: 'questionPeriod', read: 'readPeriod', next: 'nextPeriod', date: 'recordDates', meaning: 'datePeriodMeaning' }, cohort: { label: 'viewCohort', question: 'questionCohort', read: 'readCohort', next: 'nextCohort', date: 'registerDates', meaning: 'dateCohortMeaning' }, payments: { label: 'viewPayments', question: 'questionPayments', read: 'readPayments', next: 'nextPayments', date: 'paidDate', meaning: 'datePaymentsMeaning' } } as const
 const activeText = viewText[view]
 const clearDetail = (params: URLSearchParams) => ['detail', 'detailCC', 'detailDate', 'detailGroup', 'detailValue', 'detailReason', 'detailKind', 'cohortDetail', 'cohortRow', 'paymentDetail', 'paymentValue', 'paymentOwner', 'paymentView', 'paymentUser', 'type'].forEach(key => params.delete(key))
 const change = (values: Record<string, string>) => { const next = new URLSearchParams(query); next.set('view', view); next.set('start', filters.start); next.set('end', filters.end); Object.entries(values).forEach(([k, v]) => next.set(k, v)); clearDetail(next); setQuery(next) }
 const switchView = (target: DashboardView) => { const next = dashboardSwitchView(query, target); clearDetail(next); setQuery(next) }
 const scope = allowedLines()
 const population = dashboardPopulation(students, scope, scope === null || can('salesV3_reassign') === 'operate', actor)
 const metrics = dashboardMetrics(population, calls, lessons, filters, orders)
 const ownerName = (id: string) => id === '__unassigned__' ? d('unassigned') : accounts.find(a => a.email === id)?.name || id
 const ownerIds = [...new Set(population.map(s => s.salesOwner || '__unassigned__'))].sort()
 const title = (metric: string) => (CONSULTATION_STAGES as readonly string[]).includes(metric) ? t(`sales.consultation.stage.${metric}`) : d(metric as DashboardWord)
 const keys = filters.mode === 'current' ? ['total', ...CONSULTATION_STAGES, 'paid'] : [...PERIOD_METRICS]
 const defaultColumns = keys
 const columnParam = filters.mode === 'current' ? 'currentColumns' : 'periodColumns'
 const requestedColumns = (query.get(columnParam) || '').split(',').filter(key => keys.includes(key))
 const visibleKeys = requestedColumns.length ? keys.filter(key => requestedColumns.includes(key)) : defaultColumns
 const rangeLabel = filters.start && filters.end ? `${filters.start} — ${filters.end}` : d('allDates')
 const groupValues: DashboardGrouping[] = ['cc', 'date', 'intent', 'age', 'registrationAge']
 const grouping = (groupValues.includes(query.get('group') as DashboardGrouping) ? query.get('group') : view === 'period' ? 'date' : 'cc') as DashboardGrouping
 const groupLabels = { cc: d('ccTitle'), date: d('dateTitle'), source: d('groupSource'), intent: d('groupIntent'), age: d('groupAge'), registrationAge: d('groupRegistrationAge') }
 const groupName = (group: DashboardGrouping, id: string): string => group === 'cc' ? ownerName(id) : id === '__unknown__' ? d('unknown') : group === 'intent' ? t(`sales.purchaseIntention.${id === '有意向' ? 'yes' : id === '无意向' ? 'no' : 'none'}`) : group === 'registrationAge' ? `${id} ${d('days')}` : id
 const dateRows = dashboardDateRows(population, calls, lessons, filters, orders)
 type BreakdownRow = { id: string; name: string; metrics: Record<string, Student[]>; date?: string; owner?: string; children?: BreakdownRow[] }
 const breakdownRows: BreakdownRow[] = (grouping === 'date' ? dateRows : dashboardGroupRows(metrics, grouping)).map(row => ({ ...row, name: groupName(grouping, row.id), date: grouping === 'date' ? row.id : undefined,
   children: grouping === 'date' ? dashboardGroupRows(row.metrics, 'cc').map(child => ({ ...child, id: JSON.stringify([row.id, child.id]), name: ownerName(child.id), date: row.id, owner: child.id })) : undefined }))
 const reasonKind = (REASON_KINDS.includes(query.get('reasonKind') as ReasonKind) ? query.get('reasonKind') : 'noShow') as ReasonKind
 const reasonRows = dashboardReasonRows(population, calls, lessons, filters, reasonKind)
 const cohortFilters = filters
 const cohortRange = cohortFilters.start && cohortFilters.end ? `${cohortFilters.start} — ${cohortFilters.end}` : d('allDates')
 const cohort = dashboardCohortMetrics(population, calls, cohortFilters, orders)
 const rates = dashboardCohortRates(cohort)
 const rateDisplay = (rate: typeof rates[number]) => rate.value === null ? d('rateUnavailable') : `${Math.round(rate.value * 10) / 10}%`
 const rateHint = (rate: typeof rates[number]) => `${d(rate.formula)}: ${rate.numeratorCount} / ${rate.denominatorCount}${rate.reason ? ' - ' + d(rate.reason) : ''}`
 const rateForMetric = (metric: CohortMetric) => ({ connected: 'rateContact', booked: 'rateBooking', attended: 'rateAttendance', paid: 'ratePaid' } as const)[metric as Exclude<CohortMetric, 'leads'>]
 const cohortMoney = (row?: CohortRow) => <DashboardMoneyCell orders={dashboardPaymentOrders(orders, (row?.metrics || cohort).leads, { ...cohortFilters, start: '', end: '' })} />
 const cohortDimensions: CohortDimension[] = ['date', 'cc']
 const cohortPrimary = (cohortDimensions.includes(query.get('conversionPrimary') as CohortDimension) ? query.get('conversionPrimary') : 'date') as CohortDimension
 const secondaryValue = query.get('conversionSecondary')
 const cohortSecondary: CohortDimension | '' = secondaryValue === '' ? '' : cohortDimensions.includes(secondaryValue as CohortDimension) && secondaryValue !== cohortPrimary ? secondaryValue as CohortDimension : cohortPrimary === 'cc' ? 'date' : 'cc'
 const cohortRows = dashboardCohortRows(cohort, cohortPrimary, cohortSecondary)
 const cohortAllRows = cohortRows
 const cohortDimensionTitle = (value: CohortDimension) => d(value === 'date' ? 'registerDates' : value === 'cc' ? 'currentCC' : 'source')
 const cohortTitle = (key: CohortMetric) => d(({ leads: 'cohortLeads', connected: 'cohortConnected', booked: 'cohortBooked', attended: 'cohortAttended', paid: 'paid' } as const)[key])
 const cohortName = (row: CohortRow) => groupName(row.dimension, row.value)
 const cohortRowLabel = (row: CohortRow) => { const parent = cohortAllRows.find(parent => parent.children?.some(child => child.id === row.id)); return parent ? `${cohortName(parent)} → ${cohortName(row)}` : cohortName(row) }
 const openCohort = (metric: CohortMetric, row?: CohortRow) => { const next = new URLSearchParams(query); clearDetail(next); next.set('cohortDetail', metric); if (row) next.set('cohortRow', row.id); setQuery(next) }
 const cohortCount = (key: CohortMetric, row?: CohortRow) => <button className="dashboard-count" aria-label={`${cohortTitle(key)} · ${row ? cohortRowLabel(row) + ' · ' : ''}${(row?.metrics || cohort)[key].length}`} onClick={() => openCohort(key, row)}>{(row?.metrics || cohort)[key].length.toLocaleString()}</button>
 const cohortDetail = view === 'cohort' && COHORT_METRICS.includes(query.get('cohortDetail') as CohortMetric) ? query.get('cohortDetail') as CohortMetric : undefined
 const selectedCohortRow = [...cohortAllRows, ...cohortAllRows.flatMap(row => row.children || [])].find(row => row.id === query.get('cohortRow'))
 const cohortParent = cohortAllRows.find(row => row.children?.some(child => child.id === selectedCohortRow?.id))
 const cohortPath = [...(cohortParent ? [cohortParent] : []), ...(selectedCohortRow ? [selectedCohortRow] : [])]
 const paymentFilters = filters
 const paymentRange = paymentFilters.start && paymentFilters.end ? `${paymentFilters.start} — ${paymentFilters.end}` : d('allDates')
 const reasonName = (id: string) => id === '__unknown__' ? d('unknown') : t(`sales.consultation.reasonOption.${id}`)
 const open = (metric: string, group?: DashboardGrouping, value?: string, owner?: string) => { const next = new URLSearchParams(query); clearDetail(next); next.set('detail', metric); if (group && value) { next.set('detailGroup', group); next.set('detailValue', value) }; if (owner) next.set('detailCC', owner); setQuery(next) }
 const openReason = (id: string) => { const next = new URLSearchParams(query); clearDetail(next); next.set('detailReason', id); next.set('detailKind', reasonKind); setQuery(next) }
 const rawDetail = query.get('detail') || ''
 const detail = isLeadView && [...keys, 'assigned', 'unassigned'].includes(rawDetail) ? rawDetail : ''
 const legacyGroup = query.has('detailDate') ? 'date' : query.has('detailCC') ? 'cc' : ''
 const detailGroup = query.get('detailGroup') || legacyGroup
 const detailValue = query.get('detailValue') || query.get('detailDate') || query.get('detailCC') || ''
 const detailKind = (REASON_KINDS.includes(query.get('detailKind') as ReasonKind) ? query.get('detailKind') : reasonKind) as ReasonKind
 const detailReason = isLeadView ? query.get('detailReason') || '' : ''
 const detailMetricRows = detailGroup === 'date' ? dateRows.find(row => row.id === detailValue)?.metrics || {} : groupValues.includes(detailGroup as DashboardGrouping) ? dashboardGroupRows(metrics, detailGroup as Exclude<DashboardGrouping, 'date'>).find(row => row.id === detailValue)?.metrics || {} : metrics
 const scopedDetailMetrics = detailGroup === 'date' && query.get('detailCC') ? Object.fromEntries(Object.entries(detailMetricRows).map(([key, users]) => [key, users.filter(s => (s.salesOwner || '__unassigned__') === query.get('detailCC'))])) : detailMetricRows
 const detailRows = cohortDetail ? (query.has('cohortRow') ? selectedCohortRow?.metrics[cohortDetail] || [] : cohort[cohortDetail]) : detailReason ? dashboardReasonRows(population, calls, lessons, filters, detailKind).find(row => row.id === detailReason)?.users || [] : scopedDetailMetrics[detail] || []
 const detailLabel = cohortDetail ? `${d('cohortTitle')} · ${cohortTitle(cohortDetail)}${selectedCohortRow ? ' · ' + cohortRowLabel(selectedCohortRow) : ''}` : detailReason ? `${d(detailKind)} · ${reasonName(detailReason)}` : `${detail ? title(detail) : ''}${detailValue && groupValues.includes(detailGroup as DashboardGrouping) ? ' · ' + groupName(detailGroup as DashboardGrouping, detailValue) : ''}`
 const detailRange = cohortDetail ? cohortPath.find(row => row.dimension === 'date')?.value || cohortRange : detailGroup === 'date' ? detailValue : rangeLabel
 const detailOwner = (cohortDetail ? cohortPath.find(row => row.dimension === 'cc')?.value : detailGroup === 'cc' ? detailValue : query.get('detailCC') || '') || filters.owner
 const close = () => change({})
 const reset = () => change({ start: '', end: '', cc: '' })
 const today = dayjs().utcOffset(420)
 const go = (path: string) => navigate(path, { state: { dashboardReturn: location.pathname + location.search } })
 const count = (key: string, n = (metrics[key] || []).length, group?: DashboardGrouping, value?: string, owner?: string) => <button className="dashboard-count" onClick={() => open(key, group, value, owner)} aria-label={`${title(key)} · ${group && value ? groupName(group, value) + ' · ' : ''}${owner ? ownerName(owner) + ' / ' : ''}${n}`}>{n.toLocaleString(lang === 'zh' ? 'zh-CN' : 'en-US')}</button>
 const columns: ColumnsType<Student> = [
   { title: t('user.col.id'), dataIndex: 'studentId', width: 200, render: (id, s) => can('usersV2') !== 'none' ? <Button type="link" style={{ padding: 0 }} onClick={() => go(`/users-v2/${encodeURIComponent(s.studentId)}`)}>{id}</Button> : id },
   { title: t('user.col.name'), dataIndex: 'name', width: 130 },
   { title: d('currentCC'), width: 150, render: (_, s) => ownerName(s.salesOwner || '__unassigned__') },
   { title: t('user.col.regTime'), width: 180, render: (_, s) => <LocalTime time={s.registerTime} country="越南" /> },
   { title: d('intent'), width: 130, render: (_, s) => groupName('intent', s.purchaseIntention || '未填写') },
   { title: d('age'), dataIndex: 'ageGroup', width: 100, render: v => v || d('unknown') },
   { title: d('stageTitle'), width: 180, render: (_, s) => isSalesLead(s, lessons) ? <Tag color={CONSULTATION_STAGE_COLOR[consultationStage(s, calls)]}>{title(consultationStage(s, calls))}</Tag> : t(`enum.status.${s.status}`) },
   { title: t('common.action'), width: 240, fixed: 'right', render: (_, s) => <Space wrap>
     {can('salesV3') !== 'none' && isSalesLead(s, lessons) && <Button size="small" type="link" onClick={() => go(`/sales-v3?studentId=${encodeURIComponent(s.studentId)}&tab=${s.salesOwner ? 'follow' : 'pool'}`)}>{d('salesAction')}</Button>}
     {can('usersV2') !== 'none' && <Button size="small" type="link" onClick={() => go(`/users-v2/${encodeURIComponent(s.studentId)}`)}>{d('userAction')}</Button>}
     {can('ordersV3') !== 'none' && <Button size="small" type="link" onClick={() => go(`/orders-v3?studentId=${encodeURIComponent(s.studentId)}`)}>{d('orderAction')}</Button>}
   </Space> },
 ]
 return <div className="management-dashboard">
   <header className="dashboard-heading"><div><Space><Tag color="blue">{d('scope')}</Tag><Tag>{d('demoTag')}</Tag></Space><Typography.Title level={2}>{d('title')}</Typography.Title><Typography.Text type="secondary">{d('subtitle')}</Typography.Text></div><Button onClick={() => setRulesOpen(true)}>{d('rules')}</Button></header>
   <nav className="dashboard-questions" aria-label={d('chooseQuestion')}>{DASHBOARD_VIEWS.map(value => <button key={value} aria-pressed={view === value} onClick={() => switchView(value)}><strong>{d(viewText[value].label)}</strong><span>{d(viewText[value].question)}</span></button>)}</nav>
   <Card className="dashboard-filters"><Space wrap size={16}>
     <Select aria-label={d('currentCC')} value={filters.owner} style={{ minWidth: 180 }} onChange={v => change({ cc: v })} options={[{ value: '', label: d('allCC') }, ...ownerIds.map(id => ({ value: id, label: ownerName(id) }))]} />
     <div className="dashboard-date"><span>{d(activeText.date)}</span><DatePicker.RangePicker aria-label={d(activeText.date)} value={filters.start && filters.end ? [dayjs(filters.start), dayjs(filters.end)] : null} placeholder={[d('allDates'), d('allDates')]} presets={[{ label: d('today'), value: [today, today] }, { label: d('last7'), value: [today.subtract(6, 'day'), today] }, { label: d('thisMonth'), value: [today.startOf('month'), today] }]} onChange={v => change({ start: v?.[0]?.format('YYYY-MM-DD') || '', end: v?.[1]?.format('YYYY-MM-DD') || '' })} /></div>
     {(filters.owner || filters.start || filters.end) && <Button type="text" onClick={reset}>{d('resetFilters')}</Button>}
   </Space><p className="dashboard-help">{d(activeText.meaning)}</p></Card>
   <section className="dashboard-reading" aria-label={d('readingGuide')}><div><h3>{d(activeText.question)}</h3><p>{d(activeText.read, { ...Object.fromEntries(Object.entries(view === 'cohort' ? cohort : metrics).map(([key, rows]) => [key, rows.length])), totalRate: rateDisplay(rates[4]) })}</p><span>{d(activeText.next)}</span></div><Button type="link" onClick={() => setRulesOpen(true)}>{d('exampleTitle')}</Button></section>
   {isLeadView && <div className={`dashboard-kpis ${filters.mode === 'period' ? 'dashboard-period' : ''}`}>
     {(filters.mode === 'current' ? ['total', 'assigned', 'unassigned', 'paid'] : [...PERIOD_METRICS]).map(key => <Card key={key} className={key === 'paid' ? 'dashboard-paid' : undefined}><div className="dashboard-kpi-label">{title(key)}</div>{count(key)}{key === 'paid' && <p className="dashboard-paid-hint">{d(filters.mode === 'current' ? 'paidCurrent' : 'paidPeriod')}</p>}{key !== 'paid' && <p className="dashboard-kpi-hint">{d(`${key}Hint` as DashboardWord)}</p>}<ArrowRightOutlined /></Card>)}
   </div>}
   {view === 'current' && <Card title={d('stageTitle')} extra={<span className="dashboard-section-note">{d('stageShare')}</span>}><p className="dashboard-help">{d('stageHelp')}</p><div className="dashboard-stages">{CONSULTATION_STAGES.map(stage => <div key={stage}><div className="dashboard-stage-line"><span>{title(stage)}</span>{count(stage)}</div><Progress percent={metrics.total?.length ? Math.round((metrics[stage]?.length || 0) / metrics.total.length * 1000) / 10 : 0} size="small" strokeColor="#5086ee" format={p => `${p}%`} /></div>)}</div></Card>}
   {isLeadView && <Card title={d(filters.mode === 'period' ? 'breakdown' : 'currentBreakdown')}>
    <div className="dashboard-table-tools">
      <div role="radiogroup" aria-label={d(filters.mode === 'current' ? 'currentBreakdown' : 'breakdown')}><Radio.Group className="dashboard-dimensions" optionType="button" buttonStyle="solid" value={grouping} onChange={e => change({ group: e.target.value })} options={groupValues.map(value => ({ value, label: groupLabels[value] }))} /></div>
      <label className="dashboard-column-picker"><span>{d('visibleColumns')}</span><Select mode="multiple" popupMatchSelectWidth={260} aria-label={d('visibleColumns')} value={visibleKeys} maxTagCount={0} maxTagPlaceholder={selected => `${selected.length} ${d('columnsUnit')}`} style={{ width: 150 }} onChange={values => change({ [columnParam]: values.length ? values.join(',') : defaultColumns.join(',') })} options={keys.map(key => ({ value: key, label: title(key) }))} />{visibleKeys.length < keys.length && <Button size="small" type="link" onClick={() => change({ [columnParam]: '' })}>{d('allMetrics')}</Button>}</label>
    </div>
    <p className="dashboard-help">{d(grouping === 'cc' ? 'ccHelp' : grouping === 'date' ? filters.mode === 'current' ? 'dateCurrentHelp' : 'datePeriodHelp' : grouping === 'registrationAge' ? 'registrationAgeHelp' : 'groupHelp')}</p>
    <p className="dashboard-help">{grouping === 'date' && d('dateCCHelp')} {d(filters.mode === 'current' ? 'tablePaymentCurrent' : 'tablePaymentPeriod')}</p>
    {visibleKeys.length === keys.length && <p className="dashboard-help">{d('allMetricsHelp')}</p>}
    <Table rowKey="id" size="middle" dataSource={breakdownRows} scroll={{ x: 370 + visibleKeys.length * 125 }} pagination={grouping === 'date' ? { pageSize: 10, showSizeChanger: false } : false} locale={{ emptyText: <Empty description={d('noRows')} image={Empty.PRESENTED_IMAGE_SIMPLE} /> }} columns={[
     { title: grouping === 'cc' ? d('currentCC') : grouping === 'date' ? `${d(filters.mode === 'current' ? 'registerDates' : 'recordDates')} / CC` : d(grouping), dataIndex: 'name', key: 'group', fixed: 'left', width: 160 },
     ...visibleKeys.map(key => ({ title: title(key), key, width: 125, render: (_: unknown, row: typeof breakdownRows[number]) => count(key, (row.metrics[key] || []).length, grouping, row.date || row.id, row.owner) })),
     { title: d('revenueAov'), key: 'money', width: 210, fixed: 'right', render: (_, row) => <DashboardMoneyCell orders={dashboardBreakdownPayments(orders, population, filters, grouping, row.date || row.id, row.owner)} /> },
    ]} summary={() => breakdownRows.length ? <Table.Summary.Row>
      <Table.Summary.Cell index={0}><strong>{d(filters.mode === 'current' ? 'currentTotal' : 'periodTotal')}</strong></Table.Summary.Cell>
      {visibleKeys.map((key, i) => <Table.Summary.Cell index={i + 1} key={key}>{count(key)}</Table.Summary.Cell>)}
      <Table.Summary.Cell index={visibleKeys.length + 1}><DashboardMoneyCell orders={dashboardBreakdownPayments(orders, population, filters)} /></Table.Summary.Cell>
    </Table.Summary.Row> : null} />
   </Card>}
   {view === 'cohort' && <Card title={d('cohortTitle')} className="dashboard-cohort" extra={<span className="dashboard-section-note">{d('registerDates')} · {cohortRange} · UTC+7</span>}>
     <div className="dashboard-cohort-totals">{COHORT_METRICS.map(key => <div key={key}><span>{cohortTitle(key)}</span>{cohortCount(key)}</div>)}</div>
     <div className="dashboard-conversion-note"><strong>{d('ratesReference')}</strong><p>{d('ratesReferenceHelp')}</p><div className="dashboard-rate-guide">{rates.map(rate => <div key={rate.key}><span>{d(rate.key)}</span><strong title={rateHint(rate)}>{rateDisplay(rate)}</strong><small>{d(rate.formula)}</small><small>{rate.numeratorCount} / {rate.denominatorCount}{rate.reason ? ' - ' + d(rate.reason) : ''}</small></div>)}</div></div>
     <h3 className="dashboard-subheading">{d('progressCompare')}</h3>
     <div className="dashboard-hierarchy-controls">
       <div role="radiogroup" aria-label={d('primaryDimension')}><span>{d('primaryDimension')}</span><Radio.Group optionType="button" buttonStyle="solid" value={cohortPrimary} onChange={e => change({ conversionPrimary: e.target.value, conversionSecondary: cohortSecondary === e.target.value ? cohortPrimary : cohortSecondary })} options={cohortDimensions.map(value => ({ value, label: cohortDimensionTitle(value) }))} /></div>
       <div role="radiogroup" aria-label={d('secondaryDimension')}><span>{d('secondaryDimension')}</span><Radio.Group optionType="button" buttonStyle="solid" value={cohortSecondary} onChange={e => change({ conversionSecondary: e.target.value })} options={[{ value: '', label: d('noSecondary') }, ...cohortDimensions.filter(value => value !== cohortPrimary).map(value => ({ value, label: cohortDimensionTitle(value) }))]} /></div>
     </div>
     <p className="dashboard-help">{d('progressCompareHelp')} {d('tablePaymentCurrent')}</p>
     <Table key={`${cohortPrimary}:${cohortSecondary}`} rowKey="id" size="middle" dataSource={cohortRows} scroll={{ x: 1155 }} pagination={cohortRows.length > 10 ? { pageSize: 10, showSizeChanger: false } : false} expandable={{ indentSize: 20, expandRowByClick: false }} locale={{ emptyText: <Empty description={d('noRows')} image={Empty.PRESENTED_IMAGE_SIMPLE} /> }} columns={[
       { title: `${cohortDimensionTitle(cohortPrimary)}${cohortSecondary ? ' → ' + cohortDimensionTitle(cohortSecondary) : ''}`, key: 'group', width: 190, fixed: 'left', render: (_, row) => cohortName(row) },
       ...COHORT_METRICS.map(key => ({ title: cohortTitle(key), key, width: 125, render: (_: unknown, row: CohortRow) => { const rate = dashboardCohortRates(row.metrics).find(rate => rate.key === rateForMetric(key)); return <div className="dashboard-metric-cell">{cohortCount(key, row)}{rate && <small title={rateHint(rate)}>{d(rate.key)} {rateDisplay(rate)}</small>}</div> } })),
       { title: d('rateTotal'), key: 'totalRate', width: 130, render: (_, row) => { const rate = dashboardCohortRates(row.metrics).find(rate => rate.key === 'rateTotal')!; return <span title={rateHint(rate)}>{rateDisplay(rate)}</span> } },
       { title: d('revenueAov'), key: 'money', width: 210, fixed: 'right', render: (_, row) => cohortMoney(row) },
     ]} summary={() => cohortRows.length ? <Table.Summary.Row><Table.Summary.Cell index={0}><strong>{d('currentTotal')}</strong></Table.Summary.Cell>{COHORT_METRICS.map((key, i) => <Table.Summary.Cell index={i + 1} key={key}>{cohortCount(key)}</Table.Summary.Cell>)}<Table.Summary.Cell index={6}>{rateDisplay(rates[4])}</Table.Summary.Cell><Table.Summary.Cell index={7}>{cohortMoney()}</Table.Summary.Cell></Table.Summary.Row> : null} />
     <p className="dashboard-help dashboard-bottom-note">{d('cohortEvidence')}</p>
   </Card>}
   {view === 'payments' && <DashboardPayments population={population} orders={orders} filters={paymentFilters} rangeLabel={paymentRange} />}
   {isLeadView && <Card title={d('reasons')}>
     <Segmented className="dashboard-grouping" value={reasonKind} onChange={v => change({ reasonKind: String(v) })} options={REASON_KINDS.map(value => ({ value, label: d(value) }))} />
     <p className="dashboard-help" style={{ marginTop: 16 }}>{d(filters.mode === 'current' ? 'currentReasonHelp' : 'periodReasonHelp')}</p>
     <Table rowKey="id" size="middle" pagination={false} dataSource={reasonRows} locale={{ emptyText: <Empty description={d('noReasons')} image={Empty.PRESENTED_IMAGE_SIMPLE} /> }} columns={[
       { title: d('reason'), dataIndex: 'id', render: id => reasonName(id) },
       { title: d('usersCount'), width: 150, render: (_, row) => <button className="dashboard-count" aria-label={`${d(reasonKind)} · ${reasonName(row.id)} · ${row.users.length}`} onClick={() => openReason(row.id)}>{row.users.length}</button> },
       ...(filters.mode === 'current' ? [{ title: d('share'), width: 220, render: (_: unknown, row: typeof reasonRows[number]) => <Progress size="small" percent={Math.round(row.users.length / (reasonRows.reduce((sum, r) => sum + r.users.length, 0) || 1) * 1000) / 10} /> }] : []),
     ]} />
   </Card>}
   <p className="dashboard-footnote">{d('demo')} <Button type="link" size="small" onClick={() => setRulesOpen(true)}>{d('rules')}</Button></p>
   <Modal width={720} styles={{ body: { maxHeight: '60vh', overflowY: 'auto' } }} open={rulesOpen} onCancel={() => setRulesOpen(false)} footer={<Button onClick={() => setRulesOpen(false)}>{t('common.close')}</Button>} title={d('rules')}>
     <Typography.Title level={5}>{d('exampleTitle')}</Typography.Title>
     <p>{d('exampleIntro')}</p><div className="dashboard-reading-example">{DASHBOARD_VIEWS.map(value => <p key={value}><strong>{d(viewText[value].label)}</strong><span>{d(({ current: 'exampleCurrent', period: 'examplePeriod', cohort: 'exampleCohort', payments: 'examplePayments' } as const)[value])}</span></p>)}</div>
     <Typography.Title level={5}>{d('conversionRules')}</Typography.Title>
     <p className="dashboard-help">{d('ratesReferenceHelp')}</p>
     <ul className="dashboard-formulas">{['connectFormula', 'bookFormula', 'attendanceFormula', 'attendancePaidFormula', 'totalPaidFormula'].map(key => <li key={key}>{d(key as DashboardWord)}</li>)}</ul>
     <Typography.Title level={5}>{d('rules')}</Typography.Title>
     {[d('formalOnly'), d('paidRule'), d('currentHelp'), d('periodHelp'), d('periodNote'), d('revenueHelp'), d('registrationAgeHelp'), d('intentNote'), d('limits')].map(text => <p key={text}>{text}</p>)}
   </Modal>
   <Modal open={!!detail || !!detailReason || !!cohortDetail} onCancel={close} footer={<Button onClick={close}>{t('common.close')}</Button>} width={1280} title={`${d('users')} · ${detailLabel}`}>
    <p className="dashboard-help">{detailRows.length} {d('count')} · {d(cohortDetail || filters.mode === 'current' ? 'registerDates' : 'recordDates')}：{detailRange} · {detailOwner ? ownerName(detailOwner) : d('allCC')} · UTC+7</p>
    <Table rowKey="studentId" columns={columns} dataSource={detailRows} scroll={{ x: 1300, y: 'min(55vh, 520px)' }} pagination={{ pageSize: 10, showSizeChanger: false, showTotal: n => t('common.total', { n }) }} locale={{ emptyText: d('noRows') }} />
   </Modal>
 </div>
}
