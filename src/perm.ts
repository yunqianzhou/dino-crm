import { useSyncExternalStore } from 'react'
import { useStore } from './store'
import { useSession } from './auth'
import type { Account, ModuleKey, PermLevel, Role } from './types'

// 当前“以谁的身份查看”（用于在原型中模拟不同角色）。持久化到 localStorage。
const KEY = 'dinoai_crm_identity'
const listeners = new Set<() => void>()
let currentId: string | null = load()

function load(): string | null {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

export function setIdentity(id: string | null) {
  currentId = id
  try {
    if (id) localStorage.setItem(KEY, id)
    else localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l())
}

export function useIdentityId(): string | null {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => currentId,
  )
}

// 解析当前账号：优先使用手动切换的身份，其次按登录邮箱匹配账号。
export function useCurrentAccount(): { account: Account | null; role: Role | null } {
  const id = useIdentityId()
  const accounts = useStore((s) => s.accounts)
  const roles = useStore((s) => s.roles)
  const session = useSession()

  let acc: Account | undefined = id ? accounts.find((a) => a.id === id) : undefined
  if (!acc && session) acc = accounts.find((a) => a.email === session.email)
  const role = acc ? roles.find((r) => r.id === acc!.roleId) ?? null : null
  return { account: acc ?? null, role }
}

export function usePerm() {
  const { account, role } = useCurrentAccount()
  const session = useSession()

  // role 为空（任意工作邮箱登录、未匹配账号）时，按超级管理员处理，保证原型可用。
  const can = (m: ModuleKey): PermLevel => {
    if (!role) return 'operate'
    const saved = role.perms[m]
    if (saved) return saved
    // 兼容四期上线前保存在 localStorage 的旧角色数据。
    if (m === 'lifecycle') {
      if (role.id === 'role_admin' || role.id === 'role_ops') return 'operate'
      if (role.id === 'role_support' || role.id === 'role_sales_leader') return 'view'
    }
    // 兼容三期权限新增前已保存在 localStorage 的角色数据。
    if (m === 'ordersV3') return role.perms.orders
    if (m === 'salesV3') return role.perms.sales
    const phase3Copy: Partial<Record<ModuleKey, ModuleKey>> = {
      usersV2_edit: 'users_edit',
      usersV2_phone_view: 'users_phone_view',
      usersV2_export: 'users_export',
      usersV2_view_report: 'usersV2',
      usersV2_view_replay: 'usersV2',
      ordersV3_export: 'orders_export',
      salesV3_claim: 'sales_claim',
      salesV3_dial: 'sales_dial',
      salesV3_update: 'sales_update',
      salesV3_reassign: 'sales_reassign',
      salesV3_config: 'sales_config',
      salesV3_import_leads: 'sales',
      salesV3_view_report: 'sales',
      salesV3_view_replay: 'sales',
    }
    const copiedFrom = phase3Copy[m]
    if (copiedFrom) return role.perms[copiedFrom]
    return 'none'
  }
  const isOperate = (m: ModuleKey) => can(m) === 'operate'

  // 数据范围：null 表示全部业务线；否则仅允许这些业务线。
  const allowedLines = (): string[] | null => {
    if (!role) return null
    if (role.dataScope === 'all') return null
    return account?.businessLines ?? []
  }

  const actor = account?.email ?? session?.email ?? 'admin@dinoai.ai'

  return { account, role, can, isOperate, allowedLines, actor }
}
