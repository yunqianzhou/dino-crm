import dayjs, { type Dayjs } from 'dayjs'
import utc from 'dayjs/plugin/utc'
import type { Account, ModuleKey, PermLevel, Role, Student } from './types'
import type { AppState } from './store'
import { matchesLocalDateRange, validCallback } from './salesReporting'
import { businessLineOf } from './channel'
import { isSalesMember } from './phase5'
import { CONSULTATION_STAGES, currentAppointment } from './salesLifecycle'

dayjs.extend(utc)

export function canTransferUser5(can: (key: ModuleKey) => PermLevel, account?: Account | null) {
  return account?.status !== '停用' && can('usersV2') !== 'none' && can('salesV3') !== 'none' && can('salesV3_config') === 'operate'
}

export function ccFilterAccounts5(accounts: Account[], roles: Role[], matchesLine: (line: string) => boolean, lines: string[]) {
  return accounts.filter(a => a.status === '启用' && isSalesMember(a) &&
    (a.businessLines.some(matchesLine) || (roles.find(r => r.id === a.roleId)?.dataScope === 'all' && lines.some(matchesLine))))
}

export const membershipLimit5 = (account?: Account | null) => account?.isSalesMember === true ? 3 : 365

// Both entry points validate against the current member record when saving.
export function addMembership5(state: AppState, request: {
  studentId: string; days: number; actor: string; permitted: boolean; scope: string[] | null; source: 'users' | 'sales'; now?: string
}) {
  const account = state.accounts.find(a => a.email === request.actor)
  const student = state.students.find(s => s.studentId === request.studentId)
  if (!request.permitted || account?.status === '停用') throw new Error('permission')
  if (!student || (request.scope !== null && !request.scope.includes(businessLineOf(state.channels, student)))) throw new Error('scope')
  if (!Number.isInteger(request.days) || request.days < 1 || request.days > membershipLimit5(account)) throw new Error('days')
  const now = dayjs.utc(request.now)
  const expiry = student.expireTime ? dayjs.utc(student.expireTime) : now
  const next = (expiry.isValid() && expiry.isAfter(now) ? expiry : now).add(request.days, 'day').format('YYYY-MM-DD HH:mm:ss')
  const time = now.format('YYYY-MM-DD HH:mm:ss')
  return { ...state, students: state.students.map(s => s.studentId !== student.studentId ? s : {
    ...s, expireTime: next, lastModifier: request.actor,
    editHistory: [{ time, action: 'user.hist.edit', modifier: request.actor,
      changes: [{ field: '会员到期时间', before: s.expireTime || '—', after: next }] }, ...(s.editHistory || [])],
  }), logs: [{ id: `membership-${Date.now()}-${Math.random().toString(36).slice(2)}`, time, actor: request.actor,
    module: (request.source === 'users' ? 'usersV2' : 'salesV3') as ModuleKey,
    action: `添加会员时长 ${request.days} 天`, target: student.studentId }, ...state.logs] }
}

export const REJECTED_REASONS5 = [
  ['家长拒绝接听电话', 'Parent declined the call'], ['号码错误', 'Wrong number'], ['无需求', 'No demand'], ['稍后回电', 'Call back later'],
  ['低于4岁', 'Under 4 years old'], ['超过13岁／成人', 'Above 13/Adults'],
] as const
export const CLOSED_REASONS5 = [
  ['课程不适合孩子', 'Course is unsuitable to kids'], ['孩子不喜欢', "Kids don't like"], ['家长不喜欢', "Parent's don't like"],
  ['费用高', 'High fee'], ['设备问题', 'Device'], ['支付方式问题', 'Payment method'], ['不信任品牌', 'Not trust branding'],
  ['App 故障／卡顿', 'App bug/lagging'], ['观望需求', 'Window demands'], ['只想上试听课', 'Just want to take the trial class'], ['其他', 'Others'],
] as const
export const FOLLOW_STAGES5 = [...CONSULTATION_STAGES.filter(s => s !== '已关闭'), 'Rejected', 'Closed']
export { followStage5 } from './salesLifecycle'
export function followReason5(student: Student) {
  return student.salesOutcome5?.reason || (student.salesLifecycleStatus === '已关闭'
    ? student.salesLifecycleEvents?.find(e => e.result === '已关闭')?.reason : undefined)
}
export function appointmentMatches5(student: Student, filter?: string, from?: string, to?: string) {
  const appointment = currentAppointment(student)
  if (filter === 'none' && appointment) return false
  if (filter === 'booked' && !appointment) return false
  if (!from && !to) return true
  if (!appointment || !dayjs(appointment.scheduledStartAt).isValid()) return false
  // Appointment strings are stored in the appointment's local timezone.
  const date = appointment.scheduledStartAt.slice(0, 10)
  return (!from || date >= from) && (!to || date <= to)
}

// Once a sales appointment has been booked, cancellation or no-show does not
// move the lead back to the pre-appointment rejection stage.
export function outcomeAction5(student?: Student | null): 'reject' | 'close' {
  return student?.salesAppointments?.length || student?.salesLifecycleEvents?.some(e => e.node === 'appointment' && ['已预约', '已改期'].includes(e.result)) ? 'close' : 'reject'
}
export function outcomeAllowed5(student: Student, action: string, reason: string) {
  return action === outcomeAction5(student) && (action === 'reject' ? REJECTED_REASONS5 : CLOSED_REASONS5).some(item => item[0] === reason)
}
export function outcomeReasonLabel5(reason: string | undefined, t: (key: string) => string) {
  if (!reason) return '—'
  const match = [...REJECTED_REASONS5, ...CLOSED_REASONS5].find(item => reason === item[0] || reason.startsWith(`${item[0]}：`))
  return match ? t(`sales.outcome.reason.${match[0]}`) + reason.slice(match[0].length) : reason
}

export type SalesTimeQuery5 = {
  kind: 'register' | 'follow' | 'appointment' | 'callback'
  range: [Dayjs | null, Dayjs | null] | null
  appointmentPresence: 'all' | 'yes' | 'no'
  callbackPresence: 'all' | 'yes' | 'no'
}
export const defaultSalesTime5 = (): SalesTimeQuery5 => ({ kind: 'follow', range: null, appointmentPresence: 'all', callbackPresence: 'all' })
export function matchesSalesTime5(student: Student, query: SalesTimeQuery5) {
  const hasAppointment = !!currentAppointment(student)
  const hasCallback = !!validCallback(student.landingCallbackAt)
  if (query.appointmentPresence !== 'all' && hasAppointment !== (query.appointmentPresence === 'yes')) return false
  if (query.callbackPresence !== 'all' && hasCallback !== (query.callbackPresence === 'yes')) return false
  if (query.kind === 'appointment') {
    const appointment = currentAppointment(student)
    return !!appointment && dayjs(appointment.scheduledStartAt).isValid() && appointmentMatches5(student, 'booked', query.range?.[0]?.format('YYYY-MM-DD'), query.range?.[1]?.format('YYYY-MM-DD'))
  }
  if (query.kind === 'callback') {
    if (!validCallback(student.landingCallbackAt)) return false
    return matchesLocalDateRange(student.landingCallbackAt, query.range, student.country || student.businessLine)
  }
  return matchesLocalDateRange(query.kind === 'register' ? student.registerTime : student.salesUpdatedAt, query.range, student.country || student.businessLine)
}

export function changeSalesTimeKind5(query: SalesTimeQuery5, kind: SalesTimeQuery5['kind']): SalesTimeQuery5 {
  if ((kind === 'appointment' && query.appointmentPresence === 'no') || (kind === 'callback' && query.callbackPresence === 'no')) return query
  return { ...query, kind, range: null,
    ...(kind === 'appointment' ? { appointmentPresence: 'yes' } : {}),
    ...(kind === 'callback' ? { callbackPresence: 'yes' } : {}) }
}
export function changeSalesPresence5(query: SalesTimeQuery5, field: 'appointmentPresence' | 'callbackPresence', presence: 'all' | 'yes' | 'no'): SalesTimeQuery5 {
  const tiedToTime = query.kind === (field === 'appointmentPresence' ? 'appointment' : 'callback')
  return { ...query, [field]: presence, ...(tiedToTime && presence !== 'yes' ? { kind: 'follow', range: null } : {}) }
}
