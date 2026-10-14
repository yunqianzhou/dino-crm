import { usePerm } from './perm'
import { usePhase6, type ModuleKey6 } from './phase6'
import type { PermLevel } from './types'

export function usePerm6() {
  const current = usePerm(), s = usePhase6()
  const account = current.account ? s.accounts.find(a => a.id === current.account!.id) ?? null : null
  const role = account ? s.roles.find(r => r.id === account.roleId) ?? null : null
  const isDefaultAdmin = !current.account
  const can = (module: ModuleKey6): PermLevel => isDefaultAdmin ? 'operate' : account?.status === '启用' && role ? role.perms[module] ?? 'none' : 'none'
  return { account, role, can, actor: current.actor, isDefaultAdmin }
}
