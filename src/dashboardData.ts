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
