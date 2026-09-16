import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import type { CallRecord, LessonRecord, Student } from './types'
import { isSalesLead } from './funnel'
import { consultationStage } from './salesLifecycle'
import { resolveUserType } from './userType'
dayjs.extend(utc)

export type DashboardFilters = { mode: 'current' | 'period'; start: string; end: string; owner: string; userType: string }
export const PERIOD_METRICS = ['registered', 'called', 'connected', 'booked', 'attended', 'completed'] as const
export function inVietnamRange(time: string | undefined, start: string, end: string) {
  if (!time || !dayjs.utc(time).isValid()) return false
  const date = dayjs.utc(time).utcOffset(7 * 60).format('YYYY-MM-DD')
  return (!start || date >= start) && (!end || date <= end)
}
export function dashboardPopulation(students: Student[], scope: string[] | null, seeAll: boolean, actor: string) {
  return [...new Map(students.filter(s => s.businessLine === '越南' && (!scope || scope.includes(s.businessLine)) &&
    (seeAll || !s.salesOwner || s.salesOwner === actor)).map(s => [s.studentId, s])).values()]
}
export function dashboardMetrics(population: Student[], calls: CallRecord[], lessons: LessonRecord[], filters: DashboardFilters) {
  const range = (time?: string) => inVietnamRange(time, filters.start, filters.end)
  const rows = population.filter(s => (!filters.owner || (s.salesOwner || '__unassigned__') === filters.owner) &&
    (!filters.userType || resolveUserType(s) === filters.userType))
  const current = rows.filter(s => isSalesLead(s, lessons) && range(s.registerTime))
  const metrics: Record<string, Student[]> = {}
  if (filters.mode === 'current') {
    metrics.total = current
    metrics.assigned = current.filter(s => !!s.salesOwner)
    metrics.unassigned = current.filter(s => !s.salesOwner)
    current.forEach(s => { const stage = consultationStage(s, calls); (metrics[stage] ??= []).push(s) })
  } else {
    // Period counts are distinct users with explicit records. They are not a funnel.
    metrics.registered = rows.filter(s => !!s.phone?.trim() && range(s.registerTime))
    metrics.called = rows.filter(s => calls.some(c => c.studentId === s.studentId && range(c.time)))
    metrics.connected = rows.filter(s => calls.some(c => c.studentId === s.studentId && c.result === '已接通' && range(c.time)))
    metrics.booked = rows.filter(s => (s.salesAppointments ?? []).some(a => range(a.createdAt)))
    metrics.attended = rows.filter(s => (s.salesLifecycleEvents ?? []).some(e => range(e.reportedAt) &&
      ((e.node === 'attendance' && e.result === '已出勤') || (e.node === 'consultation' && ['咨询完成', '咨询未完成'].includes(e.result)))))
    metrics.completed = rows.filter(s => (s.salesLifecycleEvents ?? []).some(e => e.node === 'consultation' && e.result === '咨询完成' && range(e.reportedAt)))
  }
  return metrics
}

/** Daily rows use the same metric definitions and filters as the headline counts. */
export function dashboardDateRows(population: Student[], calls: CallRecord[], lessons: LessonRecord[], filters: DashboardFilters) {
  const rows = population.filter(s => (!filters.owner || (s.salesOwner || '__unassigned__') === filters.owner) &&
    (!filters.userType || resolveUserType(s) === filters.userType))
  const ids = new Set(rows.map(s => s.studentId))
  const times = rows.map(s => s.registerTime)
  if (filters.mode === 'period') {
    calls.filter(c => ids.has(c.studentId)).forEach(c => times.push(c.time))
    rows.forEach(s => {
      s.salesAppointments?.forEach(a => times.push(a.createdAt))
      s.salesLifecycleEvents?.forEach(e => times.push(e.reportedAt))
    })
  }
  const dates = [...new Set(times.filter(time => inVietnamRange(time, filters.start, filters.end))
    .map(time => dayjs.utc(time).utcOffset(7 * 60).format('YYYY-MM-DD')))].sort().reverse()
  return dates.map(date => ({ id: date, name: date, metrics: dashboardMetrics(rows, calls, lessons, { ...filters, start: date, end: date }) }))
    .filter(row => Object.values(row.metrics).some(users => users.length > 0))
}

export type DashboardGrouping = 'cc' | 'date' | 'intent' | 'age' | 'registrationAge'
export function dashboardGroupKey(s: Student, group: Exclude<DashboardGrouping, 'date'>, now = dayjs.utc().toISOString()) {
  if (group === 'cc') return s.salesOwner || '__unassigned__'
  if (group === 'intent') return s.purchaseIntention || '未填写'
  if (group === 'age') return s.ageGroup || '__unknown__'
  if (!s.registerTime || !dayjs.utc(s.registerTime).isValid()) return '__unknown__'
  const today = dayjs.utc(now).utcOffset(420).startOf('day')
  const registered = dayjs.utc(s.registerTime).utcOffset(420).startOf('day')
  const days = today.diff(registered, 'day')
  return days < 0 ? '__unknown__' : days <= 7 ? '0–7' : days <= 30 ? '8–30' : '31+'
}
export function dashboardGroupRows(metrics: Record<string, Student[]>, group: Exclude<DashboardGrouping, 'date'>, now?: string) {
  const ids = [...new Set(Object.values(metrics).flat().map(s => dashboardGroupKey(s, group, now)))]
  const order = group === 'intent' ? ['有意向', '无意向', '未填写'] : group === 'age' ? ['3-5', '6-8', '9-12', '13-17', '18+', '__unknown__'] : group === 'registrationAge' ? ['0–7', '8–30', '31+', '__unknown__'] : []
  ids.sort((a, b) => order.length ? order.indexOf(a) - order.indexOf(b) : a.localeCompare(b))
  return ids.map(id => ({ id, metrics: Object.fromEntries(Object.entries(metrics).map(([key, rows]) => [key, rows.filter(s => dashboardGroupKey(s, group, now) === id)])) }))
}
export const REASON_KINDS = ['noShow', 'incomplete', 'paused', 'closed'] as const
export type ReasonKind = typeof REASON_KINDS[number]
const reasonConfig = {
  noShow: { stage: '未出勤待跟进', node: 'attendance', result: 'No Show', reasons: ['客户未到会', '无法联系', '会议技术问题', '其他'] },
  incomplete: { stage: '咨询未完成待跟进', node: 'consultation', result: '咨询未完成', reasons: ['中途离开', '时间不足', '会议异常', '其他'] },
  paused: { stage: '暂不跟进', node: 'lead', result: '暂不跟进', reasons: ['暂无需求', '暂不方便', '预算原因', '其他'] },
  closed: { stage: '已关闭', node: 'lead', result: '已关闭', reasons: ['明确拒绝', '号码无效', '重复 Lead', '要求不联系', '其他'] },
} as const
/** Uses explicit reasons only. Free text is kept in details, never inferred into a category. */
export function dashboardReasonRows(population: Student[], calls: CallRecord[], lessons: LessonRecord[], filters: DashboardFilters, kind: ReasonKind) {
  const config = reasonConfig[kind]
  const current = dashboardMetrics(population, calls, lessons, { ...filters, mode: 'current' })
  const rows = filters.mode === 'current' ? current[config.stage] || [] : population.filter(s =>
    (!filters.owner || (s.salesOwner || '__unassigned__') === filters.owner) && (!filters.userType || resolveUserType(s) === filters.userType))
  const groups = new Map<string, Map<string, Student>>()
  const add = (reason: string | undefined, s: Student) => {
    const id = !reason?.trim() ? '__unknown__' : (config.reasons as readonly string[]).includes(reason) ? reason : '其他'
    if (!groups.has(id)) groups.set(id, new Map())
    groups.get(id)!.set(s.studentId, s)
  }
  rows.forEach(s => {
    const events = (s.salesLifecycleEvents || []).filter(e => e.node === config.node && (e.result === config.result || (kind === 'noShow' && e.result === '未出勤')) &&
      dayjs.utc(e.reportedAt).isValid() && (filters.mode === 'current' || inVietnamRange(e.reportedAt, filters.start, filters.end)))
      .sort((a, b) => dayjs.utc(b.reportedAt).valueOf() - dayjs.utc(a.reportedAt).valueOf())
    if (filters.mode === 'current') add(events[0]?.reason, s)
    else events.forEach(e => add(e.reason, s))
  })
  return [...groups].map(([id, users]) => ({ id, users: [...users.values()] })).sort((a, b) => b.users.length - a.users.length || a.id.localeCompare(b.id))
}
