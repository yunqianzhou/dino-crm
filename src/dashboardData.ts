import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import type { CallRecord, LessonRecord, Order, Student } from './types'
import { isSalesLead } from './funnel'
import { consultationStage } from './salesLifecycle'
import { resolveUserType } from './userType'
dayjs.extend(utc)

export type DashboardFilters = { mode: 'current' | 'period'; start: string; end: string; owner: string | string[]; userType: string }
export function dashboardOwnerIds(owner: DashboardFilters['owner']): string[] {
  return [...new Set((Array.isArray(owner) ? owner : [owner]).map(value => value.trim()).filter(Boolean))]
}
function matchesOwner(student: Student, owner: DashboardFilters['owner']) {
  const ids = dashboardOwnerIds(owner)
  return !ids.length || ids.includes(student.salesOwner || '__unassigned__')
}
export const PERIOD_METRICS = ['registered', 'called', 'connected', 'booked', 'attended', 'completed', 'paid'] as const
/** A paid profile flag is not payment evidence; count only valid, positive paid orders. */
export function isDashboardPaidOrder(order: Order) {
  return order.orderStatus === '已支付' && Number.isFinite(order.paidAmount) && order.paidAmount > 0 &&
    !!order.paidTime && dayjs.utc(order.paidTime).isValid()
}
export function inVietnamRange(time: string | undefined, start: string, end: string) {
  if (!time || !dayjs.utc(time).isValid()) return false
  const date = dayjs.utc(time).utcOffset(7 * 60).format('YYYY-MM-DD')
  return (!start || date >= start) && (!end || date <= end)
}
export function dashboardPopulation(students: Student[], scope: string[] | null, seeAll: boolean, actor: string) {
  return [...new Map(students.filter(s => s.businessLine === '越南' && (!scope || scope.includes(s.businessLine)) &&
    (seeAll || !s.salesOwner || s.salesOwner === actor)).map(s => [s.studentId, s])).values()]
}
export function dashboardMetrics(population: Student[], calls: CallRecord[], lessons: LessonRecord[], filters: DashboardFilters, orders: Order[] = []) {
  const range = (time?: string) => inVietnamRange(time, filters.start, filters.end)
  const rows = population.filter(s => matchesOwner(s, filters.owner) &&
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
  const paidIds = new Set(orders.filter(o => isDashboardPaidOrder(o) &&
    (filters.mode === 'current' || range(o.paidTime))).map(o => o.studentId))
  metrics.paid = rows.filter(s => paidIds.has(s.studentId) && (filters.mode === 'period' || range(s.registerTime)))
  return metrics
}

/** Payment activity uses the same successful orders and UTC+7 dates as paid-user counts. */
export function dashboardPaymentOrders(orders: Order[], students: Student[], filters: DashboardFilters) {
  const allowed = new Set(students.filter(s => matchesOwner(s, filters.owner) &&
    (!filters.userType || resolveUserType(s) === filters.userType)).map(s => s.studentId))
  return orders.filter(o => allowed.has(o.studentId) && isDashboardPaidOrder(o) && inVietnamRange(o.paidTime, filters.start, filters.end))
}

/** Never sum unlike currencies. A user with several paid orders is one payer in that currency. */
export function dashboardPaymentSummary(orders: Order[]) {
  const currencies = [...new Set(orders.map(o => o.currency?.trim() || '__unknown__'))].sort()
  return currencies.map(currency => {
    const rows = orders.filter(o => (o.currency?.trim() || '__unknown__') === currency)
    const users = new Set(rows.map(o => o.studentId)).size
    const amount = rows.reduce((sum, o) => sum + o.paidAmount, 0)
    return { currency, orders: rows, users, amount, averagePerUser: users ? amount / users : null, averagePerOrder: rows.length ? amount / rows.length : null }
  })
}

/** Daily rows use the same metric definitions and filters as the headline counts. */
export function dashboardDateRows(population: Student[], calls: CallRecord[], lessons: LessonRecord[], filters: DashboardFilters, orders: Order[] = []) {
  const rows = population.filter(s => matchesOwner(s, filters.owner) &&
    (!filters.userType || resolveUserType(s) === filters.userType))
  const ids = new Set(rows.map(s => s.studentId))
  const times = rows.map(s => s.registerTime)
  if (filters.mode === 'period') {
    calls.filter(c => ids.has(c.studentId)).forEach(c => times.push(c.time))
    orders.filter(o => ids.has(o.studentId) && isDashboardPaidOrder(o)).forEach(o => times.push(o.paidTime!))
    rows.forEach(s => {
      s.salesAppointments?.forEach(a => times.push(a.createdAt))
      s.salesLifecycleEvents?.forEach(e => times.push(e.reportedAt))
    })
  }
  const dates = [...new Set(times.filter(time => inVietnamRange(time, filters.start, filters.end))
    .map(time => dayjs.utc(time).utcOffset(7 * 60).format('YYYY-MM-DD')))].sort().reverse()
  return dates.map(date => ({ id: date, name: date, metrics: dashboardMetrics(rows, calls, lessons, { ...filters, start: date, end: date }, orders) }))
    .filter(row => Object.values(row.metrics).some(users => users.length > 0))
}

export type DashboardGrouping = 'cc' | 'date' | 'intent' | 'age' | 'registrationAge' | 'source'
export const COHORT_METRICS = ['leads', 'connected', 'booked', 'attended', 'paid'] as const
export type CohortMetric = typeof COHORT_METRICS[number]
export type CohortDimension = 'date' | 'cc' | 'source'
export type CohortMetrics = Record<CohortMetric, Student[]>
export type CohortRow = { id: string; value: string; dimension: CohortDimension; metrics: CohortMetrics; children?: CohortRow[] }
export const COHORT_RATES = [
  { key: 'rateContact', numerator: 'connected', denominator: 'leads', formula: 'connectFormula' },
  { key: 'rateBooking', numerator: 'booked', denominator: 'connected', formula: 'bookFormula' },
  { key: 'rateAttendance', numerator: 'attended', denominator: 'booked', formula: 'attendanceFormula' },
  { key: 'ratePaid', numerator: 'paid', denominator: 'attended', formula: 'attendancePaidFormula' },
  { key: 'rateTotal', numerator: 'paid', denominator: 'leads', formula: 'totalPaidFormula' },
] as const

/** Reference ratios from recorded cohort outcomes, never from independent daily activity.
 * Reject a step when its numerator includes users with no denominator evidence.
 */
export function dashboardCohortRates(metrics: CohortMetrics) {
  return COHORT_RATES.map(rate => {
    const denominatorIds = new Set(metrics[rate.denominator].map(s => s.studentId))
    const numerator = metrics[rate.numerator].length
    const denominator = denominatorIds.size
    const reason: 'zeroDenominator' | 'missingHistory' | null = !denominator ? 'zeroDenominator' : metrics[rate.numerator].some(s => !denominatorIds.has(s.studentId)) ? 'missingHistory' : null
    return { ...rate, numeratorCount: numerator, denominatorCount: denominator, reason, value: reason ? null : numerator / denominator * 100 }
  })
}

/** Monetary columns follow the table's date definition: registration cohort or payment activity. */
export function dashboardBreakdownPayments(orders: Order[], population: Student[], filters: DashboardFilters, group?: DashboardGrouping, value?: string, owner?: string) {
  const rows = population.filter(s => (!owner || (s.salesOwner || '__unassigned__') === owner) &&
    (!group || group === 'date' || !value || dashboardGroupKey(s, group) === value) &&
    (filters.mode !== 'current' || inVietnamRange(s.registerTime, group === 'date' && value ? value : filters.start, group === 'date' && value ? value : filters.end)))
  return dashboardPaymentOrders(orders, rows, { ...filters,
    start: filters.mode === 'current' ? '' : group === 'date' && value ? value : filters.start,
    end: filters.mode === 'current' ? '' : group === 'date' && value ? value : filters.end,
  })
}

/** Recorded outcomes for a registration cohort, including users who have since paid.
 * Missing historical evidence is not inferred from a user's current sales stage.
 * These independent counts are deliberately not converted to funnel percentages.
 */
export function dashboardCohortMetrics(population: Student[], calls: CallRecord[], filters: DashboardFilters, orders: Order[] = []): CohortMetrics {
  const eligible = population.filter(s => matchesOwner(s, filters.owner) &&
    (!filters.userType || resolveUserType(s) === filters.userType) && !!s.phone?.trim() && inVietnamRange(s.registerTime, filters.start, filters.end))
  const connected = new Set(calls.filter(c => c.result === '已接通' && inVietnamRange(c.time, '', '')).map(c => c.studentId))
  const paid = new Set(orders.filter(isDashboardPaidOrder).map(o => o.studentId))
  const hasEvent = (s: Student, node: string, results: string[]) => (s.salesLifecycleEvents || []).some(e =>
    e.node === node && results.includes(e.result) && inVietnamRange(e.reportedAt, '', ''))
  return {
    leads: eligible,
    connected: eligible.filter(s => connected.has(s.studentId) || hasEvent(s, 'contact', ['已接通'])),
    // A cancelled appointment still proves that a booking was created in the past.
    booked: eligible.filter(s => (s.salesAppointments || []).some(a => inVietnamRange(a.createdAt, '', '')) || hasEvent(s, 'appointment', ['已预约', '已改期'])),
    attended: eligible.filter(s => hasEvent(s, 'attendance', ['已出勤']) || hasEvent(s, 'consultation', ['咨询完成', '咨询未完成'])),
    paid: eligible.filter(s => paid.has(s.studentId)),
  }
}

export function dashboardCohortRows(metrics: CohortMetrics, primary: CohortDimension, secondary: CohortDimension | ''): CohortRow[] {
  const key = (s: Student, dimension: CohortDimension) => dimension === 'date'
    ? dayjs.utc(s.registerTime).utcOffset(420).format('YYYY-MM-DD') : dashboardGroupKey(s, dimension)
  const group = (source: CohortMetrics, dimension: CohortDimension, path: string[][], nested: boolean): CohortRow[] => {
    const values = [...new Set(source.leads.map(s => key(s, dimension)))].sort((a, b) => dimension === 'date' ? b.localeCompare(a) : a.localeCompare(b))
    return values.map(value => {
      const subset = Object.fromEntries(COHORT_METRICS.map(metric => [metric, source[metric].filter(s => key(s, dimension) === value)])) as CohortMetrics
      const rowPath = [...path, [dimension, value]]
      return { id: JSON.stringify(rowPath), value, dimension, metrics: subset,
        children: !nested && secondary && secondary !== dimension ? group(subset, secondary, rowPath, true) : undefined }
    })
  }
  return group(metrics, primary, [], false)
}

export function dashboardGroupKey(s: Student, group: Exclude<DashboardGrouping, 'date'>, now = dayjs.utc().toISOString()) {
  if (group === 'cc') return s.salesOwner || '__unassigned__'
  if (group === 'intent') return s.purchaseIntention || '未填写'
  if (group === 'age') return s.ageGroup || '__unknown__'
  if (group === 'source') {
    if (s.channelCode) return `Landing page · ${s.adChannel || s.channelSource || s.registerChannel || s.channelCode}`
    const appSource = [s.adChannel, s.subChannel].filter(Boolean).join(' / ')
    return appSource ? `App · ${appSource}` : (s.channelSource || s.registerChannel || '__unknown__')
  }
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
    matchesOwner(s, filters.owner) && (!filters.userType || resolveUserType(s) === filters.userType))
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
