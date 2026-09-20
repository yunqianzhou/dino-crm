import type { Order, Student } from './types'
import { dashboardPopulation } from './dashboardData'

export type DashboardListScope = { label: string; studentIds: string[]; orderIds?: string[] }
export function dashboardListScope(label: string, students: Pick<Student, 'studentId'>[], orders?: Pick<Order, 'orderId'>[]): DashboardListScope {
  return { label, studentIds: [...new Set(students.map(s => s.studentId))], ...(orders ? { orderIds: [...new Set(orders.map(o => o.orderId))] } : {}) }
}
export function matchesDashboardScope(scope: DashboardListScope | undefined, studentId: string, orderId?: string) {
  return !scope || (scope.studentIds.includes(studentId) && (orderId === undefined || !scope.orderIds || scope.orderIds.includes(orderId)))
}

/** Route by the clicked metric, not by each user's current status. */
export function dashboardMetricDestination(metric: string) {
  return metric === 'paid'
    ? { path: '/users-v2', module: 'usersV2' as const }
    : { path: '/sales-v3', module: 'salesV3' as const }
}

/** Historical cohorts may include paid users and unassigned leads; retain that exact set. */
export function dashboardSalesRows(students: Student[], selection: DashboardListScope, lines: string[] | null, seeAll: boolean, actor: string) {
  return dashboardPopulation(students, lines, seeAll, actor).filter(student => matchesDashboardScope(selection, student.studentId))
}
