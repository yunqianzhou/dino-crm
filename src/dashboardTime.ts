import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
dayjs.extend(utc)

/** Browser timezone, including its daylight-saving rules; never inferred from business line. */
export const dashboardTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone
export const dashboardLocalTime = (instant: string) => dayjs.utc(instant).local()
export const dashboardDate = (instant: string) => dashboardLocalTime(instant).format('YYYY-MM-DD')
export const dashboardTimestamp = (instant: string) => dashboardLocalTime(instant).format('YYYY-MM-DD HH:mm:ss Z')
