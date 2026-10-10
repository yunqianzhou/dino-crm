import { dashboardTimeZone } from './dashboardTime'
import { isCompletedCall } from './outbound'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import type { CallRecord, LessonRecord, Order, SalesAppointment, SalesLifecycleEvent, Student } from './types'
import { dashboardOwnerIds, dashboardGroupRows, inDashboardRange, isDashboardPaidOrder, type DashboardFilters, type DashboardGrouping } from './dashboardData'
import { currentAppointment, followStage5, followReason5 } from './salesLifecycle'
import { isSalesLead } from './funnel'
import { resolveUserType } from './userType'
dayjs.extend(utc)
dayjs.extend(timezone)

export const FUNNEL_KEYS = ['leads', 'called', 'connected', 'booked', 'trialCompleted', 'paid'] as const
export type FunnelKey = typeof FUNNEL_KEYS[number]
export type PeopleMetrics = Record<string, Student[]>
export type FunnelMetrics = Record<FunnelKey, Student[]>
export type FollowEvent = SalesLifecycleEvent & { closureType?: 'phone' | 'consultation'; paymentConcern?: string }
export const uniquePeople = (rows: Student[]) => [...new Map(rows.map(s => [s.studentId, s])).values()]
export function scopedPeople(population: Student[], filters: DashboardFilters) {
  const owners = dashboardOwnerIds(filters.owner)
  return uniquePeople(population.filter(s => resolveUserType(s) === '正式用户' && (!owners.length || owners.includes(s.salesOwner || '__unassigned__'))))
}
export function cohortFunnel(population: Student[], calls: CallRecord[], lessons: LessonRecord[], orders: Order[], filters: DashboardFilters, now = dayjs.utc().toISOString()): FunnelMetrics {
  const leads = scopedPeople(population, filters).filter(s => !!s.phone?.trim() && inDashboardRange(s.registerTime, filters.start, filters.end) && dayjs.utc(s.registerTime).valueOf() <= dayjs.utc(now).valueOf())
  const valid = (s: Student, time?: string) => !!time && dayjs.utc(time).isValid() && dayjs.utc(time).valueOf() >= dayjs.utc(s.registerTime).valueOf() && dayjs.utc(time).valueOf() <= dayjs.utc(now).valueOf()
  return {
    leads,
    called: leads.filter(s => calls.some(c => c.studentId === s.studentId && isCompletedCall(c) && valid(s, c.time))),
    connected: leads.filter(s => calls.some(c => c.studentId === s.studentId && isCompletedCall(c) && c.result === '已接通' && valid(s, c.time))),
    booked: leads.filter(s => s.salesAppointments?.some(a => valid(s, a.createdAt))),
    trialCompleted: leads.filter(s => lessons.some(l => l.studentId === s.studentId && l.lessonType === '体验课' && l.status === '已完课' && valid(s, l.completedAt))),
    paid: leads.filter(s => orders.some(o => o.studentId === s.studentId && isDashboardPaidOrder(o) && valid(s, o.paidTime))),
  }
}
export const l2s = (metrics: PeopleMetrics) => metrics.leads.length ? metrics.paid.length / metrics.leads.length * 100 : null
export const CURRENT_INVENTORY_KEYS = ['total', 'assigned', 'unassigned', '已拒绝', '已关闭', '暂不跟进']
export const CURRENT_CALL_KEYS = ['待外呼', '未接通待跟进', '已拒绝']
export const CURRENT_FOLLOW_KEYS = ['已接通待预约', '已预约', '未出勤待跟进', '咨询未完成待跟进', '咨询完成待支付', '已关闭']
export const ACTIVITY_CALL_KEYS = ['called', 'connected']
export const ACTIVITY_FOLLOW_KEYS = ['paid']
export const SNAPSHOT_FOLLOW_KEYS = ['已接通待预约']
export function closureKind(event: FollowEvent) {
  if (event.node !== 'lead' || event.result !== '已关闭') return undefined
  return event.closureType === 'phone' ? 'rejected' : event.closureType === 'consultation' ? 'closedAfter' : 'closedUnknown'
}
export function currentFollowStage(s: Student, calls: CallRecord[]) {
  const stage = followStage5(s, calls)
  return stage === 'Rejected' ? '已拒绝' : stage === 'Closed' ? '已关闭' : stage
}
/** Split the exact current-status population; every user belongs to one reason. */
export function outcomeReasonGroups(users: Student[]) {
  const people = uniquePeople(users)
  const groups = new Map<string, Student[]>()
  people.forEach(student => {
    const raw = followReason5(student)?.trim() || '__unknown__'
    const reason = /^其他[：:]/.test(raw) ? '其他' : raw
    groups.set(reason, [...(groups.get(reason) || []), student])
  })
  return [...groups].map(([reason, users]) => ({ reason, users, share: users.length / people.length * 100 }))
    .sort((a, b) => b.users.length - a.users.length || a.reason.localeCompare(b.reason, 'zh-CN'))
}
export function followupMetrics(population: Student[], calls: CallRecord[], lessons: LessonRecord[], orders: Order[], filters: DashboardFilters) {
  const rows = scopedPeople(population, filters)
  const paidIds = new Set(orders.filter(isDashboardPaidOrder).map(o => o.studentId))
  const currentRows = rows.filter(s => isSalesLead(s, lessons) && !paidIds.has(s.studentId))
  const current: PeopleMetrics = Object.fromEntries([...CURRENT_INVENTORY_KEYS, ...CURRENT_CALL_KEYS, ...CURRENT_FOLLOW_KEYS].map(k => [k, []]))
  current.total = currentRows
  current.assigned = currentRows.filter(s => s.salesOwner)
  current.unassigned = currentRows.filter(s => !s.salesOwner)
  currentRows.forEach(s => (current[currentFollowStage(s, calls)] ??= []).push(s))
  const range = (time?: string) => inDashboardRange(time, filters.start, filters.end) && dayjs.utc(time).valueOf() <= Date.now()
  const eventUsers = (predicate: (e: FollowEvent) => boolean) => rows.filter(s => s.salesLifecycleEvents?.some(e => range(e.reportedAt) && predicate(e)))
  const activity: PeopleMetrics = {
    called: rows.filter(s => calls.some(c => c.studentId === s.studentId && isCompletedCall(c) && range(c.time))),
    connected: rows.filter(s => calls.some(c => c.studentId === s.studentId && isCompletedCall(c) && c.result === '已接通' && range(c.time))),
    booked: rows.filter(s => s.salesAppointments?.some(a => range(a.createdAt))),
    attended: eventUsers(e => e.node === 'attendance' && e.result === '已出勤'),
    completed: eventUsers(e => e.node === 'consultation' && e.result === '咨询完成'),
    rejected: eventUsers(e => closureKind(e) === 'rejected'),
    closedAfter: eventUsers(e => closureKind(e) === 'closedAfter'),
    closedUnknown: eventUsers(e => closureKind(e) === 'closedUnknown'),
    paid: rows.filter(s => orders.some(o => o.studentId === s.studentId && isDashboardPaidOrder(o) && range(o.paidTime))),
  }
  return { current, activity }
}
export type Reason43 = 'rejected' | 'noShow' | 'incomplete' | 'paymentConcern' | 'closedAfter' | 'paused' | 'closedUnknown'
export const REASON43: Reason43[] = ['rejected', 'noShow', 'incomplete', 'paymentConcern', 'closedAfter', 'paused', 'closedUnknown']
export function reasonMatches(e: FollowEvent, kind: Reason43) {
  if (['rejected', 'closedAfter', 'closedUnknown'].includes(kind)) return closureKind(e) === kind
  if (kind === 'noShow') return e.node === 'attendance' && ['No Show', '未出勤'].includes(e.result)
  if (kind === 'incomplete') return e.node === 'consultation' && e.result === '咨询未完成'
  if (kind === 'paused') return e.node === 'lead' && e.result === '暂不跟进'
  return e.node === 'sale' && e.result === '待支付' // Concerns are explicit events; never inferred from free text.
}
export function reasonEvidence(population: Student[], calls: CallRecord[], lessons: LessonRecord[], orders: Order[], filters: DashboardFilters, kind: Reason43, current: boolean) {
  const rows = scopedPeople(population, filters)
  const currentMetrics = followupMetrics(population, calls, lessons, orders, filters).current
  const stage = { rejected: '已关闭', closedAfter: '已关闭', closedUnknown: '已关闭', noShow: '未出勤待跟进', incomplete: '咨询未完成待跟进', paused: '暂不跟进', paymentConcern: '咨询完成待支付' }[kind]
  const currentIds = new Set(currentMetrics[stage]?.map(s => s.studentId))
  return rows.flatMap(student => {
    let events = (student.salesLifecycleEvents || []).filter(e => inDashboardRange(e.reportedAt, '', '') && dayjs.utc(e.reportedAt).valueOf() <= Date.now()).sort((a, b) => dayjs.utc(b.reportedAt).valueOf() - dayjs.utc(a.reportedAt).valueOf()) as FollowEvent[]
    if (current) {
      if (!currentIds.has(student.studentId)) return []
      // Do not reuse a reason from before the most recent restart/resume or another appointment.
      const restart = events.find(e => e.node === 'lead' && ['重新跟进', '继续跟进', '恢复跟进', '重新开启', '重开'].includes(e.result))
      events = events.filter(e => (!restart || dayjs.utc(e.reportedAt).valueOf() > dayjs.utc(restart.reportedAt).valueOf()))
      const latestAppointment = student.salesAppointments?.find(a => a.appointmentStatus === '已预约')
      if (['noShow', 'incomplete'].includes(kind) && latestAppointment) events = events.filter(e => e.appointmentId === latestAppointment.appointmentId)
      const matching = events.filter(e => ['rejected', 'closedAfter', 'closedUnknown'].includes(kind) ? !!closureKind(e) : reasonMatches(e, kind))[0]
      if (matching && !reasonMatches(matching, kind)) return []
      if (!matching && ['rejected', 'closedAfter'].includes(kind)) return []
      return [{ student, event: matching, reason: matching?.reason || matching?.paymentConcern || '__unknown__' }]
    }
    return events.filter(e => reasonMatches(e, kind) && inDashboardRange(e.reportedAt, filters.start, filters.end)).map(event => ({ student, event, reason: event.reason || event.paymentConcern || '__unknown__' }))
  })
}
export function scheduledInstant(a: SalesAppointment) {
  if (!a.scheduledStartAt) return null
  try {
    const date = /(?:Z|[+-]\d{2}:?\d{2})$/.test(a.scheduledStartAt) ? dayjs.utc(a.scheduledStartAt) : dayjs.tz(a.scheduledStartAt, a.timezone || dashboardTimeZone())
    return date.isValid() ? date : null
  } catch { return null }
}
export const APPOINTMENT_BUCKETS = ['future', 'unconfirmed', 'attended', 'noShow', 'cancelled', 'rescheduled'] as const
export type AppointmentBucket = typeof APPOINTMENT_BUCKETS[number]
export function scheduledAppointments(population: Student[], filters: DashboardFilters, start: string, end: string, now = dayjs.utc().toISOString()) {
  const seen = new Set<string>()
  return scopedPeople(population, filters).flatMap(student => (student.salesAppointments || []).flatMap(appointment => {
    const instant = scheduledInstant(appointment)
    if (!instant || !inDashboardRange(instant.toISOString(), start, end) || seen.has(appointment.appointmentId)) return []
    seen.add(appointment.appointmentId)
    const bucket: AppointmentBucket = appointment.appointmentStatus === '已取消' ? 'cancelled' : appointment.appointmentStatus === '已改期' ? 'rescheduled' : appointment.attendanceStatus === '已出勤' ? 'attended' : appointment.attendanceStatus === 'No Show' ? 'noShow' : instant.valueOf() > dayjs.utc(now).valueOf() ? 'future' : 'unconfirmed'
    const result = student.salesLifecycleEvents?.filter(e => e.appointmentId === appointment.appointmentId && ['attendance', 'consultation'].includes(e.node) && inDashboardRange(e.reportedAt, '', '')).sort((a, b) => dayjs.utc(b.reportedAt).valueOf() - dayjs.utc(a.reportedAt).valueOf())[0]
    return [{ id: appointment.appointmentId, student, appointment, instant: instant.toISOString(), bucket, result }]
  }))
}
export function metricGroups(metrics: PeopleMetrics, dimension: 'cc' | 'date', secondary = false) {
  const key = (s: Student) => dimension === 'cc' ? s.salesOwner || '__unassigned__' : dayjs.utc(s.registerTime).local().format('YYYY-MM-DD')
  const values = [...new Set(Object.values(metrics).flat().map(key))].sort((a, b) => dimension === 'date' ? b.localeCompare(a) : a.localeCompare(b))
  return values.map(value => ({ id: value, name: value, metrics: Object.fromEntries(Object.entries(metrics).map(([k, users]) => [k, users.filter(s => key(s) === value)])), secondary }))
}

export type FollowupComparisonRow = {
  id: string; value: string; metrics: PeopleMetrics; activityDate?: string; children?: FollowupComparisonRow[]
}
/** Business date follows the current stage; historical stages are never counted again. */
export function followupStateEvidence(student: Student, calls: CallRecord[], stage = currentFollowStage(student, calls)) {
  const validPast = (time?: string) => !!time && dayjs.utc(time).isValid() && dayjs.utc(time).valueOf() <= Date.now()
  const events = (student.salesLifecycleEvents || []).filter(e => validPast(e.occurredAt || e.reportedAt)).sort((a,b) => dayjs.utc(b.occurredAt || b.reportedAt).valueOf() - dayjs.utc(a.occurredAt || a.reportedAt).valueOf())
  const histories = (student.salesHistory || []).filter(h => h.stage5 && validPast(h.time)).sort((a,b) => dayjs.utc(b.time).valueOf() - dayjs.utc(a.time).valueOf())
  const stageName = stage === '已关闭' ? 'Closed' : stage
  // Repeated notes within a stage do not reset the stage-entry date.
  const run = [] as typeof histories
  for (const history of histories) { if (history.stage5 !== stageName) break; run.push(history) }
  let time: string | undefined
  let source = ''
  let appointmentId = ''
  if (['已预约','未出勤待跟进','咨询未完成待跟进','咨询完成待支付'].includes(stage)) {
    const appointment = currentAppointment(student) || student.salesAppointments?.[0]
    time = appointment ? scheduledInstant(appointment)?.toISOString() : undefined
    appointmentId = appointment?.appointmentId || ''
    source = '预约上课时间'
  } else if (stage === '已关闭') {
    const event = events.find(e => e.node === 'lead' && e.result === '已关闭')
    time = event ? event.occurredAt || event.reportedAt : run[run.length - 1]?.time
    source = '最近一次结束时间'
  } else if (stage === '已接通待预约') {
    const entry = events.find(e => ['已取消预约','已取消','已重新激活','重新跟进','恢复跟进'].includes(e.result))
    const connected = calls.filter(c => c.studentId === student.studentId && isCompletedCall(c) && c.result === '已接通' && validPast(c.time)).sort((a,b) => dayjs.utc(a.time).valueOf() - dayjs.utc(b.time).valueOf())
    // A history row is a confirmed transition only when preceded by a different stage.
    // Otherwise the first contact is earlier evidence than a subsequently added note.
    const transition = run.length && histories.length > run.length ? run[run.length - 1].time : undefined
    const reset = entry ? entry.occurredAt || entry.reportedAt : undefined
    time = [transition,reset].filter((v): v is string => !!v).sort((a,b)=>dayjs.utc(b).valueOf()-dayjs.utc(a).valueOf())[0]
      || connected[0]?.time || run[run.length - 1]?.time
    source = '最近一次进入待预约时间'
  }
  return { stage, time, source, appointmentId, date: time && dayjs.utc(time).isValid() ? dayjs.utc(time).local().format('YYYY-MM-DD') : '__unknown_date__' }
}
export function datedFollowupMetrics(current: PeopleMetrics, calls: CallRecord[], filters: DashboardFilters): PeopleMetrics {
  return Object.fromEntries(CURRENT_FOLLOW_KEYS.map(key => [key, (current[key] || []).filter(s => {
    if (SNAPSHOT_FOLLOW_KEYS.includes(key)) return true
    const date = followupStateEvidence(s,calls,key).date
    return !filters.start && !filters.end || date !== '__unknown_date__' && (!filters.start || date >= filters.start) && (!filters.end || date <= filters.end)
  })]))
}
/** Waiting is a current snapshot; other states use business dates and payments use payment dates. */
export function datedFollowupRows(current: PeopleMetrics, paidOrders: Order[], people: Student[], calls: CallRecord[], primary: 'cc' | 'date', secondary = true): FollowupComparisonRow[] {
  type Evidence = { student: Student; metric: string; date: string }
  const byId = new Map(people.map(s => [s.studentId,s]))
  const evidence: Evidence[] = CURRENT_FOLLOW_KEYS.filter(key=>!SNAPSHOT_FOLLOW_KEYS.includes(key)).flatMap(metric => (current[metric] || []).map(student => ({student,metric,date:followupStateEvidence(student,calls,metric).date})))
  paidOrders.forEach(o => { const student=byId.get(o.studentId); if (student) evidence.push({student,metric:'paid',date:dayjs.utc(o.paidTime).local().format('YYYY-MM-DD')}) })
  const group = (records: Evidence[], dimension: 'cc' | 'date', parent = '', date?: string): FollowupComparisonRow[] => {
    const groupOf = (r: Evidence) => dimension === 'cc' ? r.student.salesOwner || '__unassigned__' : r.date
    const snapshotOwners = dimension === 'cc' && !parent ? (current['已接通待预约'] || []).map(s=>s.salesOwner || '__unassigned__') : []
    const values = [...new Set([...records.map(groupOf),...snapshotOwners])].sort((a,b) => dimension==='cc' ? a.localeCompare(b) : Number(a.startsWith('__'))-Number(b.startsWith('__')) || b.localeCompare(a))
    return values.map(value => {
      const subset = records.filter(r => groupOf(r) === value)
      const activityDate = dimension === 'date' ? value : date
      return {id:JSON.stringify([parent,dimension,value]),value,activityDate,
        metrics:Object.fromEntries([...CURRENT_FOLLOW_KEYS,'paid'].map(key => [key,key === '已接通待预约' ? (!activityDate ? uniquePeople((current[key]||[]).filter(s=>(s.salesOwner||'__unassigned__')===value)) : []) : uniquePeople(subset.filter(r=>r.metric===key).map(r=>r.student))])),
        children:!parent && secondary ? group(subset,dimension==='cc'?'date':'cc',value,activityDate) : undefined}
    })
  }
  return group(evidence,primary)
}
/** One current appointment per user keeps all status and payment totals additive. */
export function followupAppointmentDate(student: Student) {
  const appointment = currentAppointment(student)
  if (!appointment) return '__unbooked__'
  const instant = scheduledInstant(appointment)
  return instant ? instant.local().format('YYYY-MM-DD') : '__unknown_date__'
}
export function appointmentFollowupRows(current: PeopleMetrics, activity: PeopleMetrics, primary: 'cc' | 'date', secondary = true): FollowupComparisonRow[] {
  const metrics = Object.fromEntries([...CURRENT_FOLLOW_KEYS, ...ACTIVITY_FOLLOW_KEYS].map(key => [key, uniquePeople((key === 'paid' ? activity : current)[key] || [])]))
  const groupRows = (source: PeopleMetrics, dimension: 'cc' | 'date', parent = ''): FollowupComparisonRow[] => {
    const groupOf = (s: Student) => dimension === 'cc' ? s.salesOwner || '__unassigned__' : followupAppointmentDate(s)
    const values = [...new Set(Object.values(source).flat().map(groupOf))].sort((a,b) => dimension === 'cc' ? a.localeCompare(b) : Number(a.startsWith('__')) - Number(b.startsWith('__')) || b.localeCompare(a))
    return values.map(value => ({id:JSON.stringify([parent,dimension,value]),value,metrics:Object.fromEntries(Object.entries(source).map(([key,users])=>[key,users.filter(s=>groupOf(s)===value)]))}))
  }
  return groupRows(metrics, primary).map(row => ({...row,children:secondary ? groupRows(row.metrics,primary === 'cc' ? 'date' : 'cc',row.id) : undefined}))
}
/** One row per group, with current workload beside period activity.
 * Child dates describe activity only: missing snapshot cells mean not applicable, never zero.
 */
export function followupComparisonRows(current: PeopleMetrics, activity: PeopleMetrics, daily: { date: string; metrics: PeopleMetrics }[], group: Exclude<DashboardGrouping, 'source'>, currentKeys: string[], activityKeys: string[], secondary = true): FollowupComparisonRow[] {
  const pick = (metrics: PeopleMetrics, keys: string[]) => Object.fromEntries(keys.map(key => [key, metrics[key] || []]))
  if (group === 'date') return daily.flatMap(day => {
    const metrics = pick(day.metrics, activityKeys)
    if (!Object.values(metrics).some(users => users.length)) return []
    const children = secondary ? dashboardGroupRows(metrics, 'cc').map(row => ({
      id: JSON.stringify([day.date, row.id]), value: row.id, activityDate: day.date, metrics: row.metrics,
    })) : undefined
    return [{ id: day.date, value: day.date, activityDate: day.date, metrics, children }]
  })
  const combined = { ...pick(current, currentKeys), ...pick(activity, activityKeys) }
  return dashboardGroupRows(combined, group).map(row => {
    const children = secondary ? daily.flatMap(day => {
      const child = dashboardGroupRows(pick(day.metrics, activityKeys), group).find(item => item.id === row.id)
      return child ? [{ id: JSON.stringify([row.id, day.date]), value: day.date, activityDate: day.date, metrics: child.metrics }] : []
    }) : []
    return { id: row.id, value: row.id, metrics: row.metrics, children: children.length ? children : undefined }
  })
}
