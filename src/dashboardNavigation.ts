import type { Order, Student } from './types'

export type DashboardListScope = { label: string; studentIds: string[]; orderIds?: string[] }
export function dashboardListScope(label: string, students: Pick<Student, 'studentId'>[], orders?: Pick<Order, 'orderId'>[]): DashboardListScope {
  return { label, studentIds: [...new Set(students.map(s => s.studentId))], ...(orders ? { orderIds: [...new Set(orders.map(o => o.orderId))] } : {}) }
}
export function matchesDashboardScope(scope: DashboardListScope | undefined, studentId: string, orderId?: string) {
  return !scope || (scope.studentIds.includes(studentId) && (orderId === undefined || !scope.orderIds || scope.orderIds.includes(orderId)))
}
