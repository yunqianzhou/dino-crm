import type { Account, CallRecord, OutboundBinding, OutboundProvider } from './types'

export const outboundProviders: OutboundProvider[] = ['existing', 'omicall']
export const providerName = (provider?: OutboundProvider, en = false) => provider === 'omicall' ? 'Omicall' : provider === 'existing' ? 'Sobot' : (en ? 'Historical / not recorded' : '历史记录 / 未记录')
export function bindingsOf(account?: Account | null): OutboundBinding[] {
  if (!account) return []
  // Preserve old bindings without silently granting access to the new provider.
  return account.outboundBindings ?? (account.outboundSeatBound ? [{ provider: 'existing' }] : [])
}
export function availableBindings(account: Account | null | undefined, country: string) {
  if (!account || account.status !== '启用') return []
  return bindingsOf(account).filter(b => b.provider === 'existing' || (b.provider === 'omicall' && country === '越南'))
}
export function isCompletedCall(call: CallRecord) {
  return (!call.callStatus || call.callStatus === 'COMPLETED') && ['已接通', '无人接听'].includes(call.result)
}
export function callDurationSeconds(call: Pick<CallRecord, 'duration' | 'result' | 'durationSeconds' | 'callStatus'>) {
  if (call.result !== '已接通' || (call.callStatus && call.callStatus !== 'COMPLETED')) return 0
  if (call.durationSeconds !== undefined) return Number.isFinite(call.durationSeconds) && call.durationSeconds >= 0 ? Math.floor(call.durationSeconds) : 0
  if (!/^\d+:[0-5]\d$/.test(call.duration || '')) return 0
  const [m, s] = call.duration.split(':').map(Number)
  return m * 60 + s
}
export function uniqueCalls(calls: CallRecord[]) {
  const records = new Map<string, CallRecord>()
  calls.forEach((c, i) => {
    const key = c.provider && c.providerCallId ? `${c.provider}:${c.providerCallId}` : c.id || `row:${i}`
    const previous = records.get(key)
    if (!previous || (!isCompletedCall(previous) && isCompletedCall(c))) records.set(key, c)
  })
  return [...records.values()]
}
export function upsertCall(calls: CallRecord[], incoming: CallRecord) {
  const old = calls.find(c => c.id === incoming.id || (!!incoming.providerCallId && c.provider === incoming.provider && c.providerCallId === incoming.providerCallId))
  if (!old) return [incoming, ...calls]
  if (isCompletedCall(old) && incoming.callStatus === 'DIALING') return calls
  const merged = { ...old, ...incoming, id: old.id, note: old.note || incoming.note, audioUrl: incoming.audioUrl || old.audioUrl }
  return uniqueCalls(calls.map(c => c.id === old.id ? merged : c))
}
export function outboundSummary(calls: CallRecord[]) {
  const rows = uniqueCalls(calls).filter(isCompletedCall)
  return { total: rows.length, people: new Set(rows.map(c => c.studentId)).size, connected: rows.filter(c => c.result === '已接通').length, connectedPeople: new Set(rows.filter(c => c.result === '已接通').map(c => c.studentId)).size, seconds: rows.reduce((n, c) => n + callDurationSeconds(c), 0) }
}
export const callResultName = (result: CallRecord['result'], en = false) => en ? ({ '已接通': 'Connected', '无人接听': 'No answer', '发起失败': 'Failed to start', '待确认': 'Pending result' })[result] : result
export const structuredCallHeaders = ['通话 ID', '用户 ID', '客户', '被叫号码', '业务线', '录音地址', '外呼系统', '第三方通话 ID', '线路 ID', '线路', '外显号码', '坐席', '操作人', '起呼时间 UTC', '接通时间 UTC', '结束时间 UTC', '通话状态', '通话结果', '接通时长（秒）', '结束原因', '录音状态', '同步时间 UTC', '备注']
export const structuredCallRow = (c: CallRecord) => [c.id, c.studentId, c.customer, c.phone, c.businessLine, c.audioUrl || '', providerName(c.provider), c.providerCallId || '', c.routeId || '', c.routeName || '', c.callerNumber || '', c.seat || '', c.agent, c.time, c.answeredAt || '', c.endedAt || '', c.callStatus || '历史已完结', c.result, callDurationSeconds(c), c.endReason || '', c.recordingStatus || (c.audioUrl ? 'available' : '未记录'), c.syncedAt || '', c.note]
