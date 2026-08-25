import type { CallRecord, Student } from './types'

export const CONSULTATION_STAGES = ['待外呼', '未接通待跟进', '已接通待预约', '已预约', '未出勤待跟进', '咨询未完成待跟进', '咨询完成待支付', '暂不跟进', '已关闭'] as const

export const CONSULTATION_STAGE_COLOR: Record<string, string> = {
  待外呼: 'default',
  未接通待跟进: 'orange',
  已接通待预约: 'cyan',
  已预约: 'blue',
  未出勤待跟进: 'red',
  咨询未完成待跟进: 'volcano',
  咨询完成待支付: 'purple',
  暂不跟进: 'gold',
  已关闭: 'default',
}

export function currentAppointment(student: Student) {
  return (student.salesAppointments ?? []).find((item) => item.appointmentStatus === '已预约')
}

// P0 暂无会议状态自动回传：预约存在且尚未人工标记结果时，始终保持“已预约”。
export function consultationStage(student: Student, callRecords: CallRecord[] = []) {
  if (student.salesLifecycleStatus === '已关闭') return '已关闭'
  if (student.salesProgress === '暂不跟进') return '暂不跟进'

  const current = currentAppointment(student)
  if (current?.attendanceStatus === 'No Show') return '未出勤待跟进'
  if (current?.attendanceStatus === '已出勤') {
    return current.consultationStatus === '已完成'
      ? '咨询完成待支付'
      : current.consultationStatus === '未完成'
        ? '咨询未完成待跟进'
        : '已预约'
  }
  if (current) return '已预约'

  const last = student.salesAppointments?.[0]
  if (last?.attendanceStatus === 'No Show') return '未出勤待跟进'
  if (last?.consultationStatus === '未完成') return '咨询未完成待跟进'
  if (last?.consultationStatus === '已完成') return '咨询完成待支付'

  const calls = callRecords.filter((item) => item.studentId === student.studentId)
  if (!calls.length) return '待外呼'
  return calls.some((item) => item.result === '已接通') ? '已接通待预约' : '未接通待跟进'
}
