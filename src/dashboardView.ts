export const DASHBOARD_VIEWS = ['cohort', 'current', 'period', 'payments'] as const
export type DashboardView = typeof DASHBOARD_VIEWS[number]

export function dashboardView(query: URLSearchParams): DashboardView {
  const view = query.get('view') as DashboardView
  if (DASHBOARD_VIEWS.includes(view)) return view
  // Keep existing detail links readable after introducing the four question views.
  if (query.has('paymentDetail')) return 'payments'
  if (query.has('cohortDetail')) return 'cohort'
  if (query.has('mode') || query.has('detail') || query.has('detailReason') || query.has('group') || query.has('currentColumns') || query.has('reasonKind')) return query.get('mode') === 'period' ? 'period' : 'current'
  return 'cohort'
}

export function dashboardViewRange(query: URLSearchParams, view: DashboardView) {
  const legacy = !DASHBOARD_VIEWS.includes(query.get('view') as DashboardView)
  const prefix = legacy && view === 'payments' && query.get('mode') !== 'period' ? 'payment'
    : legacy && view === 'cohort' && query.get('mode') === 'period' ? 'cohort' : ''
  return { start: query.get(prefix ? `${prefix}Start` : 'start') || '', end: query.get(prefix ? `${prefix}End` : 'end') || '' }
}

/** Each question retains its own dates. Switching cannot silently reinterpret a date filter. */
export function dashboardSwitchView(query: URLSearchParams, target: DashboardView) {
  const next = new URLSearchParams(query)
  const current = dashboardView(query)
  const range = dashboardViewRange(query, current)
  const prefix = (view: DashboardView) => view === 'payments' ? 'payment' : view
  next.set(`${prefix(current)}Start`, range.start)
  next.set(`${prefix(current)}End`, range.end)
  next.set('view', target)
  next.set('mode', target === 'period' || target === 'payments' ? 'period' : 'current')
  next.set('start', next.get(`${prefix(target)}Start`) || '')
  next.set('end', next.get(`${prefix(target)}End`) || '')
  return next
}
