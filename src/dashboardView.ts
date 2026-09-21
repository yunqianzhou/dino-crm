export const DASHBOARD_VIEWS = ['cohort', 'followup', 'payments'] as const
export type DashboardView = typeof DASHBOARD_VIEWS[number]
export function dashboardView(query: URLSearchParams): DashboardView {
  const view = query.get('view') as DashboardView
  if (DASHBOARD_VIEWS.includes(view)) return view
  if (query.has('paymentDetail')) return 'payments'
  if (query.has('cohortDetail')) return 'cohort'
  if (['current', 'period'].includes(view) || ['mode', 'detail', 'detailReason', 'group', 'currentColumns', 'reasonKind'].some(k => query.has(k))) return 'followup'
  return 'cohort'
}
export function dashboardViewRange(query: URLSearchParams, view: DashboardView) {
  const legacy = !DASHBOARD_VIEWS.includes(query.get('view') as DashboardView)
  const prefix = legacy && view === 'payments' && query.get('mode') !== 'period' ? 'payment'
    : legacy && view === 'cohort' && query.get('mode') === 'period' ? 'cohort'
    : legacy && view === 'followup' && query.get('view') !== 'period' && query.get('mode') !== 'period' ? 'followup' : ''
  return { start: query.get(prefix ? `${prefix}Start` : 'start') || '', end: query.get(prefix ? `${prefix}End` : 'end') || '' }
}
export function dashboardSwitchView(query: URLSearchParams, target: DashboardView) {
  const next = new URLSearchParams(query)
  const current = dashboardView(query)
  const range = dashboardViewRange(query, current)
  const prefix = (view: DashboardView) => view === 'payments' ? 'payment' : view
  next.set(`${prefix(current)}Start`, range.start)
  next.set(`${prefix(current)}End`, range.end)
  next.set('view', target)
  next.set('mode', target === 'cohort' ? 'current' : 'period')
  next.set('start', next.get(`${prefix(target)}Start`) || '')
  next.set('end', next.get(`${prefix(target)}End`) || '')
  return next
}
