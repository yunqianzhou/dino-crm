import dayjs from 'dayjs'
import { tzOf, toLocalTime, tzLabel } from './time'
import type { CallRecord } from './types'

export function validCallback(value?: string) {
  if (!value) return undefined
  const date = dayjs.utc(value)
  return date.isValid() ? date : undefined
}

export function matchesCallback(value: string | undefined, filter?: string, now = dayjs.utc()) {
  if (!filter) return true
  const date = validCallback(value)
  if (!date) return false
  if (filter === 'filled') return true
  if (filter === 'due') return !date.isAfter(now)
  return filter === 'upcoming' && date.isAfter(now) && date.diff(now, 'hour', true) <= 24
}

export function matchesLocalDateRange(value: string | undefined, range: any, country?: string) {
  if (!range?.[0] || !range?.[1]) return true
  if (!value || !dayjs.utc(value).isValid()) return false
  const date = dayjs.utc(value).tz(tzOf(country)).format('YYYY-MM-DD')
  return date >= range[0].format('YYYY-MM-DD') && date <= range[1].format('YYYY-MM-DD')
}

export function reportTime(value?: string, country?: string) {
  return validCallback(value) ? `${toLocalTime(value, country)} ${tzLabel(country)}` : '—'
}

export function callSeconds(call: Pick<CallRecord, 'duration' | 'result'>) {
  if (call.result !== '已接通' || !/^\d+:[0-5]\d$/.test(call.duration || '')) return 0
  const [minutes, seconds] = call.duration.split(':').map(Number)
  return minutes * 60 + seconds
}
