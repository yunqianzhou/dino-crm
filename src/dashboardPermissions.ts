import type { Account, PermLevel, Role } from './types'

/** This standalone view permission never inherits sales or reassignment rights. */
export function dashboardPermission(role: Role | null, account: Account | null): PermLevel {
  if (account?.status === '停用') return 'none'
  // Preserve the prototype's explicit default-admin preview; production must authenticate roles.
  if (!role) return 'view'
  return role.perms.managementDashboard === 'view' || role.perms.managementDashboard === 'operate' ? 'view' : 'none'
}

export function dashboardExportPermission(role: Role | null, account: Account | null): PermLevel {
  if (dashboardPermission(role, account) === 'none') return 'none'
  if (!role) return 'operate'
  return role.perms.managementDashboard_export === 'operate' ? 'operate' : 'none'
}

/** Backfill only the built-in administrator. Never copy sales rights or override a saved denial. */
export function withDashboardPermission<T extends { roles: Role[] }>(state: T): T {
  return { ...state, roles: state.roles.map(role => ({ ...role, perms: {
    ...role.perms,
    managementDashboard: role.perms.managementDashboard ?? (role.builtin && role.id === 'role_admin' ? 'view' : 'none'),
    managementDashboard_export: role.perms.managementDashboard_export ?? (role.builtin && role.id === 'role_admin' ? 'operate' : 'none'),
  } })) }
}
