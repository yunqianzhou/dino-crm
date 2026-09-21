import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import type { CallRecord, LessonRecord, Order, SalesAppointment, SalesLifecycleEvent, Student } from './types'
import { dashboardOwnerIds, inVietnamRange, isDashboardPaidOrder, type DashboardFilters } from './dashboardData'
import { consultationStage } from './salesLifecycle'
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
  const leads = scopedPeople(population, filters).filter(s => !!s.phone?.trim() && inVietnamRange(s.registerTime, filters.start, filters.end) && dayjs.utc(s.registerTime).valueOf() <= dayjs.utc(now).valueOf())
  const valid = (s: Student, time?: string) => !!time && dayjs.utc(time).isValid() && dayjs.utc(time).valueOf() >= dayjs.utc(s.registerTime).valueOf() && dayjs.utc(time).valueOf() <= dayjs.utc(now).valueOf()
  return {
    leads,
    called: leads.filter(s => calls.some(c => c.studentId === s.studentId && ['已接通', '无人接听'].includes(c.result) && valid(s, c.time))),
    connected: leads.filter(s => calls.some(c => c.studentId === s.studentId && c.result === '已接通' && valid(s, c.time))),
    booked: leads.filter(s => s.salesAppointments?.some(a => valid(s, a.createdAt))),
    trialCompleted: leads.filter(s => lessons.some(l => l.studentId === s.studentId && l.lessonType === '体验课' && l.status === '已完课' && valid(s, l.completedAt))),
    paid: leads.filter(s => orders.some(o => o.studentId === s.studentId && isDashboardPaidOrder(o) && valid(s, o.paidTime))),
  }
}
export const l2s = (metrics: PeopleMetrics) => metrics.leads.length ? metrics.paid.length / metrics.leads.length * 100 : null
export const CURRENT_CALL_KEYS = ['待外呼', '未接通待跟进']
export const CURRENT_FOLLOW_KEYS = ['已接通待预约', '已预约', '已出席待咨询', '未出勤待跟进', '咨询未完成待跟进', '咨询完成待支付', '暂不跟进']
export const ACTIVITY_CALL_KEYS = ['called', 'connected', 'rejected']
export const ACTIVITY_FOLLOW_KEYS = ['booked', 'attended', 'completed', 'closedAfter', 'paid']
export function closureKind(event: FollowEvent) {
  if (event.node !== 'lead' || event.result !== '已关闭') return undefined
  return event.closureType === 'phone' ? 'rejected' : event.closureType === 'consultation' ? 'closedAfter' : 'closedUnknown'
}
export function currentFollowStage(s: Student, calls: CallRecord[]) {
  const stage = consultationStage(s, calls)
  const appointment = s.salesAppointments?.find(a => a.appointmentStatus === '已预约')
  return stage === '已预约' && appointment?.attendanceStatus === '已出勤' && appointment.consultationStatus === '待标记' ? '已出席待咨询' : stage
}
export function followupMetrics(population: Student[], calls: CallRecord[], lessons: LessonRecord[], orders: Order[], filters: DashboardFilters) {
  const rows = scopedPeople(population, filters)
  const paidIds = new Set(orders.filter(isDashboardPaidOrder).map(o => o.studentId))
  const currentRows = rows.filter(s => isSalesLead(s, lessons) && !paidIds.has(s.studentId))
  const current: PeopleMetrics = Object.fromEntries(['total', 'assigned', 'unassigned', ...CURRENT_CALL_KEYS, ...CURRENT_FOLLOW_KEYS, '已关闭'].map(k => [k, []]))
  current.total = currentRows
  current.assigned = currentRows.filter(s => s.salesOwner)
  current.unassigned = currentRows.filter(s => !s.salesOwner)
  currentRows.forEach(s => (current[currentFollowStage(s, calls)] ??= []).push(s))
  const range = (time?: string) => inVietnamRange(time, filters.start, filters.end) && dayjs.utc(time).valueOf() <= Date.now()
  const eventUsers = (predicate: (e: FollowEvent) => boolean) => rows.filter(s => s.salesLifecycleEvents?.some(e => range(e.reportedAt) && predicate(e)))
  const activity: PeopleMetrics = {
    called: rows.filter(s => calls.some(c => c.studentId === s.studentId && ['已接通', '无人接听'].includes(c.result) && range(c.time))),
    connected: rows.filter(s => calls.some(c => c.studentId === s.studentId && c.result === '已接通' && range(c.time))),
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
    let events = (student.salesLifecycleEvents || []).filter(e => inVietnamRange(e.reportedAt, '', '') && dayjs.utc(e.reportedAt).valueOf() <= Date.now()).sort((a, b) => dayjs.utc(b.reportedAt).valueOf() - dayjs.utc(a.reportedAt).valueOf()) as FollowEvent[]
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
    return events.filter(e => reasonMatches(e, kind) && inVietnamRange(e.reportedAt, filters.start, filters.end)).map(event => ({ student, event, reason: event.reason || event.paymentConcern || '__unknown__' }))
  })
}
export function scheduledInstant(a: SalesAppointment) {
  if (!a.scheduledStartAt) return null
  try {
    const date = /(?:Z|[+-]\d{2}:?\d{2})$/.test(a.scheduledStartAt) ? dayjs.utc(a.scheduledStartAt) : dayjs.tz(a.scheduledStartAt, a.timezone || 'Asia/Ho_Chi_Minh')
    return date.isValid() ? date : null
  } catch { return null }
}
export const APPOINTMENT_BUCKETS = ['future', 'unconfirmed', 'attended', 'noShow', 'cancelled', 'rescheduled'] as const
export type AppointmentBucket = typeof APPOINTMENT_BUCKETS[number]
export function scheduledAppointments(population: Student[], filters: DashboardFilters, start: string, end: string, now = dayjs.utc().toISOString()) {
  const seen = new Set<string>()
  return scopedPeople(population, filters).flatMap(student => (student.salesAppointments || []).flatMap(appointment => {
    const instant = scheduledInstant(appointment)
    if (!instant || !inVietnamRange(instant.toISOString(), start, end) || seen.has(appointment.appointmentId)) return []
    seen.add(appointment.appointmentId)
    const bucket: AppointmentBucket = appointment.appointmentStatus === '已取消' ? 'cancelled' : appointment.appointmentStatus === '已改期' ? 'rescheduled' : appointment.attendanceStatus === '已出勤' ? 'attended' : appointment.attendanceStatus === 'No Show' ? 'noShow' : instant.valueOf() > dayjs.utc(now).valueOf() ? 'future' : 'unconfirmed'
    const result = student.salesLifecycleEvents?.filter(e => e.appointmentId === appointment.appointmentId && ['attendance', 'consultation'].includes(e.node) && inVietnamRange(e.reportedAt, '', '')).sort((a, b) => dayjs.utc(b.reportedAt).valueOf() - dayjs.utc(a.reportedAt).valueOf())[0]
    return [{ id: appointment.appointmentId, student, appointment, instant: instant.toISOString(), bucket, result }]
  }))
}
export function metricGroups(metrics: PeopleMetrics, dimension: 'cc' | 'date', secondary = false) {
  const key = (s: Student) => dimension === 'cc' ? s.salesOwner || '__unassigned__' : dayjs.utc(s.registerTime).utcOffset(420).format('YYYY-MM-DD')
  const values = [...new Set(Object.values(metrics).flat().map(key))].sort((a, b) => dimension === 'date' ? b.localeCompare(a) : a.localeCompare(b))
  return values.map(value => ({ id: value, name: value, metrics: Object.fromEntries(Object.entries(metrics).map(([k, users]) => [k, users.filter(s => key(s) === value)])), secondary }))
}
