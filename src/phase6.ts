import { useSyncExternalStore } from 'react'
import { getState } from './store'
import { tzOf } from './time'
import type { AppState } from './store'
import { BUSINESS_LINES } from './types'
import type { Account, Role, ModuleKey, PermLevel, AuditLog } from './types'

export type Scope6 = 'self' | 'teams' | 'line'
export type Kind6 = 'CC' | 'TMK' | 'other'
export type ModuleKey6 = ModuleKey | 'salesV6_handoff' | 'salesV6_config_line' | 'salesV6_config_members'
export type DataGrant6 = { line: string; scope: Scope6; teamIds: string[] }
export type Account6 = Account & { staffKind: Kind6; teamId?: string; dataGrants: DataGrant6[] }
export type Role6 = Omit<Role, 'perms' | 'dataScope'> & { perms: Record<ModuleKey6, PermLevel> }
export type Team6 = { id: string; name: string; line: string; enabled: boolean; memberIds: string[]; ownerId?: string }
export function updateMemberGroups6(teams: Team6[], accountId: string, groupIds: string[], lines: string[]): Team6[] {
  for (const id of groupIds) {
    const group = teams.find(t => t.id === id)
    if (!group || !lines.includes(group.line)) throw new Error('所属组必须在已授权的业务线内，请调整所属组')
    if (!group.enabled && !group.memberIds.includes(accountId)) throw new Error('不能加入已停用的组')
  }
  return teams.map(group => ({ ...group, memberIds: groupIds.includes(group.id)
    ? [...new Set([...group.memberIds, accountId])]
    : group.memberIds.filter(id => id !== accountId) }))
}
export type Rules6 = { mode: 'direct' | 'tmk' | 'scheduled'; timeZone: string; defaultRestDays: number[]; restDays: Record<string, number[]>; workStart: string; workEnd: string; tmkPercent: number; weights: Record<string, number>; dropEnabled: boolean; dropMinutes: number }
export type State6 = Omit<AppState, 'roles' | 'accounts'> & { permissionModel6: 'data-scope'; roles: Role6[]; accounts: Account6[]; teams: Team6[]; rules6: Record<string, Rules6> }
export const scopes6: Record<Scope6, string> = { self: '本人数据', teams: '指定组数据', line: '业务线全部数据' }
export const defaultRules6 = (line?: string): Rules6 => ({ mode: 'direct', timeZone: tzOf(line), defaultRestDays: [0, 6], restDays: {}, workStart: '09:00', workEnd: '18:00', tmkPercent: 20, weights: {}, dropEnabled: false, dropMinutes: 1440 })
export function seed6(base: AppState): State6 {
  const roles = base.roles.map(r => migrateRole6(r))
  const tmkPerms = Object.fromEntries(Object.keys(roles[0]?.perms || {}).map(key => [key, 'none'])) as Record<ModuleKey6, PermLevel>
  for (const key of ['salesV3', 'salesV3_dial', 'salesV3_update', 'salesV6_handoff'] as const) tmkPerms[key] = 'operate'
  roles.push({ id: 'role_tmk_v6', name: 'TMK 专员', desc: '外呼邀约，预约后手动选择销售转交', builtin: true, perms: tmkPerms })
  const accounts: Account6[] = base.accounts.map(a => ({ ...a, staffKind: a.isSalesMember ? 'CC' : 'other', dataGrants: [] }))
  const vn = accounts.filter(a => a.staffKind === 'CC' && a.businessLines.includes('越南'))
  const mid = Math.max(1, Math.ceil(vn.length / 2))
  vn.forEach((a, i) => { a.teamId = i < mid ? 'vn-sales-1' : 'vn-sales-2'; if (i === 0 || i === mid) a.roleId = 'role_sales_leader' })
  accounts.push(...['Mai', 'Ha'].map((name, i): Account6 => ({ id: `vn-tmk-${i + 1}`, name, email: `tmk${i + 1}@demo.example.invalid`, staffKind: 'TMK', teamId: 'vn-tmk', roleId: 'role_tmk_v6', businessLines: ['越南'], status: '启用', dataGrants: [] })))
  const teams: Team6[] = [
    { id: 'vn-sales-1', name: '越南销售一组', line: '越南', enabled: true, memberIds: [] },
    { id: 'vn-sales-2', name: '越南销售二组', line: '越南', enabled: true, memberIds: [] },
    { id: 'vn-tmk', name: '越南 TMK 组', line: '越南', enabled: true, memberIds: [] },
  ]
  for (const team of teams) team.memberIds = accounts.filter(a => a.teamId === team.id).map(a => a.id)
  for (const a of accounts) {
    const legacyRole = base.roles.find(r => r.id === a.roleId)
    const lines = legacyRole?.dataScope === 'all' ? BUSINESS_LINES : a.businessLines
    a.dataGrants = lines.map(line => {
      const teamIds = teams.filter(t => t.id === a.teamId && t.line === line).map(t => t.id)
      const scope: Scope6 = a.roleId === 'role_sales_leader' && teamIds.length ? 'teams' : a.staffKind === 'other' ? 'line' : 'self'
      return { line, scope, teamIds: scope === 'teams' ? teamIds : [] }
    })
    a.businessLines = a.dataGrants.map(g => g.line)
    delete a.teamId
  }
  const rules6: Record<string, Rules6> = {}
  for (const line of new Set(accounts.flatMap(a => a.businessLines))) {
    rules6[line] = { ...defaultRules6(line), mode: line === '越南' ? 'scheduled' : 'direct', weights: Object.fromEntries(accounts.filter(a => a.businessLines.includes(line) && a.staffKind !== 'other').map(a => [a.id, 1])) }
  }
  return { ...base, permissionModel6: 'data-scope', accounts, roles, teams, rules6, logs: [] }
}
// Preserve existing six-phase edits while upgrading the previous routing fields.
export function normalizeRules6(saved: Omit<Partial<Rules6>, 'mode'> & { mode?: string; workDays?: number[] }, line?: string): Rules6 {
  const mode = saved.mode as string | undefined
  const defaultRestDays = saved.defaultRestDays ?? (saved.workDays ? [0, 1, 2, 3, 4, 5, 6].filter(d => !saved.workDays!.includes(d)) : [0, 6])
  return { ...defaultRules6(line), ...saved, timeZone: tzOf(line), defaultRestDays, mode: mode === 'direct' || mode === 'tmk' ? mode : 'scheduled', tmkPercent: saved.tmkPercent ?? (mode === 'tmk' ? 100 : 20) }
}
export function isCCWorking6(rules: Rules6, at = new Date()): boolean {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: rules.timeZone, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(at)
  const part = (type: string) => parts.find(p => p.type === type)?.value || ''
  const time = `${part('hour')}:${part('minute')}`
  return time >= rules.workStart && time < rules.workEnd
}
export function restDays6(rules: Rules6, accountId: string): number[] { return rules.restDays[accountId] ?? rules.defaultRestDays }
export function isRestDay6(rules: Rules6, accountId: string, at = new Date()): boolean {
  const day = new Intl.DateTimeFormat('en-GB', { timeZone: rules.timeZone, weekday: 'short' }).format(at)
  return restDays6(rules, accountId).includes(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(day))
}
type LegacyRole6 = Omit<Role6, 'customerScope'> & { dataScope?: 'all' | 'line'; customerScope?: 'self' | 'team' | 'teams' | 'line' }
export function migrateRole6(r: Role | LegacyRole6): Role6 {
  const { dataScope: _data, customerScope: _scope, ...rest } = r as LegacyRole6
  const config = r.perms.salesV3_config === 'operate'
  return { ...rest, perms: { ...r.perms, salesV6_handoff: (r.perms as Role6['perms']).salesV6_handoff ?? 'none', salesV6_config_line: (r.perms as Role6['perms']).salesV6_config_line ?? (config && r.id !== 'role_sales_leader' ? 'operate' : 'none'), salesV6_config_members: (r.perms as Role6['perms']).salesV6_config_members ?? (config ? 'operate' : 'none') } }
}
export function migrateState6(base: State6, saved: State6): State6 {
  const roles = saved.roles.map(migrateRole6)
  type OldGrant = { line: string; scope: string; teamIds: string[]; identity?: 'member' | 'leader' | 'owner' }
  const teams: Team6[] = saved.teams.map(t => ({ id: t.id, name: t.name, line: t.line, enabled: t.enabled, ownerId: t.ownerId,
    memberIds: t.memberIds ?? saved.accounts.filter(a => a.teamId === t.id || (a.dataGrants as OldGrant[] | undefined)?.some(g => g.line === t.line && g.teamIds?.includes(t.id))).map(a => a.id),
  }))
  const accounts = saved.accounts.map(a => {
    const role = saved.roles.find(r => r.id === a.roleId) as LegacyRole6 | undefined
    const lines = role?.dataScope === 'all' ? BUSINESS_LINES : a.businessLines
    const oldGrants: OldGrant[] = a.dataGrants ?? lines.map(line => ({ line, scope: role?.customerScope ?? 'self', teamIds: [] }))
    const dataGrants: DataGrant6[] = oldGrants.map(g => {
      let scope: Scope6
      if (saved.permissionModel6 === 'data-scope') scope = g.scope as Scope6
      else if (g.identity) scope = g.identity === 'owner' ? 'line' : g.identity === 'leader' ? 'teams' : 'self'
      else {
        const oldTeamScope = role?.customerScope ? role.customerScope !== 'self' : ['role_growth', 'role_ops', 'role_admin', 'role_sales_leader'].includes(a.roleId)
        scope = oldTeamScope ? (g.scope === 'line' ? 'line' : 'teams') : 'self'
      }
      const teamIds = g.scope === 'team' ? teams.filter(t => t.id === a.teamId && t.line === g.line).map(t => t.id) : g.teamIds || []
      return { line: g.line, scope, teamIds: scope === 'teams' ? teamIds : [] }
    })
    const { teamId: _oldTeam, ...account } = a
    return { ...account, dataGrants, businessLines: dataGrants.map(g => g.line) }
  })
  return { ...base, ...saved, permissionModel6: 'data-scope', roles, accounts, teams, rules6: Object.fromEntries(Object.entries(saved.rules6).map(([line, r]) => [line, normalizeRules6(r, line)])) }
}
const KEY = 'dinoai_crm_phase6_incremental_v1'
function read(): State6 {
  const base = seed6(getState())
  try { const saved = JSON.parse(localStorage.getItem(KEY) || 'null'); if (saved?.accounts && saved?.roles && saved?.teams && saved?.rules6) return migrateState6(base, saved) } catch { /* initial demo */ }
  return base
}
let state = read()
const listeners = new Set<() => void>()
export function useStore6<T>(selector: (s: State6) => T) { return useSyncExternalStore(cb => { listeners.add(cb); return () => { listeners.delete(cb) } }, () => selector(state)) }
export function usePhase6() { return useStore6(s => s) }
export function setState6(update: (s: State6) => State6) {
  const updated = update(state)
  const next = { ...updated, rules6: Object.fromEntries(Object.entries(updated.rules6).map(([line, r]) => [line, normalizeRules6(r, line)])) }
  const { accounts, roles, teams, rules6, logs, permissionModel6 } = next
  localStorage.setItem(KEY, JSON.stringify({ accounts, roles, teams, rules6, logs, permissionModel6 }))
  state = next; listeners.forEach(l => l())
}
export function addLog6(entry: { actor: string; module: ModuleKey; action: string; target?: string }) {
  const log: AuditLog = { ...entry, id: crypto.randomUUID(), time: new Date().toLocaleString('sv-SE') }
  setState6(s => ({ ...s, logs: [log, ...s.logs].slice(0, 300) }))
}
export function disableAccount6(s: State6, id: string): State6 { return { ...s, accounts: s.accounts.map(a => a.id === id ? { ...a, status: '停用' } : a) } }
export function eligible6(s: State6, line: string, kind: 'CC' | 'TMK', rules: Rules6) {
  return s.accounts.filter(a => {
    const role = s.roles.find(r => r.id === a.roleId)
    return a.staffKind === kind && a.status === '启用' && a.dataGrants.some(g => g.line === line)
      && role?.perms.salesV3 === 'operate' && role.perms.salesV3_update === 'operate' && (rules.weights[a.id] ?? 0) > 0
      && hasActiveTeam6(s, a, line)
  })
}
export function grantedTeams6(s: State6, a: Account6, line: string): string[] {
  const grant = a.dataGrants.find(g => g.line === line)
  if (!grant) return []
  return s.teams.filter(t => t.line === line && (grant.scope === 'line' || (grant.scope === 'teams' && grant.teamIds.includes(t.id)))).map(t => t.id)
}
export function canAccessOwner6(s: State6, a: Account6, line: string, ownerId: string): boolean {
  const role = s.roles.find(r => r.id === a.roleId), grant = a.dataGrants.find(g => g.line === line)
  if (a.status !== '启用' || !role || !role.perms.salesV3 || role.perms.salesV3 === 'none' || !grant) return false
  const owner = s.accounts.find(x => x.id === ownerId)
  if (!owner?.dataGrants.some(g => g.line === line)) return false
  if (grant.scope === 'line') return true
  if (grant.scope === 'self') return ownerId === a.id
  return s.teams.some(t => t.line === line && grant.teamIds.includes(t.id) && t.memberIds.includes(ownerId))
}
export function visibleOwners6(s: State6, a: Account6, line?: string): string[] {
  const lines = line ? [line] : a.dataGrants.map(g => g.line)
  return s.accounts.filter(x => lines.some(l => x.dataGrants.some(g => g.line === l) && canAccessOwner6(s, a, l, x.id))).map(x => x.id)
}
export function assignmentAccess6(s: State6, a: Account6 | null, line: string) {
  if (!a) return { lineRules: true, memberIds: s.accounts.filter(x => x.dataGrants.some(g => g.line === line)).map(x => x.id) }
  const role = s.roles.find(r => r.id === a.roleId), grant = a.dataGrants.find(g => g.line === line)
  if (a.status !== '启用' || role?.perms.salesV3 !== 'operate' || !grant) return { lineRules: false, memberIds: [] as string[] }
  const lineRules = role.perms.salesV6_config_line === 'operate' && grant.scope === 'line'
  const memberIds = role.perms.salesV6_config_members === 'operate' && grant.scope !== 'self'
    ? s.accounts.filter(x => x.dataGrants.some(g => g.line === line) && canAccessOwner6(s, a, line, x.id)).map(x => x.id) : []
  return { lineRules, memberIds }
}
export function applyRulesDraft6(s: State6, actor: Account6 | null, line: string, draft: Rules6): Rules6 {
  const current = s.rules6[line] || defaultRules6(line), access = assignmentAccess6(s, actor, line)
  const result = access.lineRules ? { ...current, mode: draft.mode, workStart: draft.workStart, workEnd: draft.workEnd, tmkPercent: draft.tmkPercent, dropEnabled: draft.dropEnabled, dropMinutes: draft.dropMinutes } : { ...current }
  result.weights = { ...current.weights }; result.restDays = { ...current.restDays }
  for (const id of access.memberIds) {
    if (draft.weights[id] !== undefined) result.weights[id] = draft.weights[id]
    if (draft.restDays[id] !== undefined) result.restDays[id] = [...draft.restDays[id]]
  }
  return normalizeRules6(result, line)
}
export function handoffTargets6(s: State6, a: Account6, line: string) {
  const role = s.roles.find(r => r.id === a.roleId)
  if (a.status !== '启用' || role?.perms.salesV3 !== 'operate' || role.perms.salesV6_handoff !== 'operate' || !a.dataGrants.some(g => g.line === line)) return []
  return s.accounts.filter(x => x.staffKind === 'CC' && x.status === '启用' && x.dataGrants.some(g => g.line === line) && s.roles.find(r => r.id === x.roleId)?.perms.salesV3_update === 'operate' && hasActiveTeam6(s, x, line))
}
export function memberTeams6(s: State6, a: Account6, line: string): Team6[] {
  return s.teams.filter(t => t.line === line && t.memberIds.includes(a.id))
}
export function hasActiveTeam6(s: State6, a: Account6, line: string): boolean {
  const groups = memberTeams6(s, a, line)
  return a.dataGrants.some(g => g.line === line) && (!groups.length || groups.some(t => t.enabled))
}
export function grantLabel6(grant: DataGrant6, teams: Team6[]) {
  return `${grant.line} · ${scopes6[grant.scope]}${grant.scope === 'teams' ? `（${grant.teamIds.map(id => teams.find(t => t.id === id)?.name || '已失效组').join('、') || '未选择组'}）` : ''}`
}
export function simulate6(s: State6, line: string, rules: Rules6, working: boolean | undefined = undefined, random = Math.random(), at = new Date()): Account6 | undefined {
  rules = { ...rules, timeZone: tzOf(line) }
  // First choose CC/TMK by the business ratio, then distribute within that pool.
  // Rest days only affect new assignments; existing customer ownership is unchanged.
  let draw = Math.max(0, Math.min(random, .999999))
  const allCC = eligible6(s, line, 'CC', rules)
  const onDutyCC = allCC.filter(a => !isRestDay6(rules, a.id, at))
  const allResting = allCC.length > 0 && onDutyCC.length === 0
  let kind: 'CC' | 'TMK' = 'CC'
  if (rules.mode === 'tmk') kind = 'TMK'
  if (rules.mode === 'scheduled') {
    if (!(working ?? isCCWorking6(rules, at)) || allResting) kind = 'TMK'
    else {
      const share = rules.tmkPercent / 100
      kind = draw < share ? 'TMK' : 'CC'
      draw = kind === 'TMK' ? draw / share : (draw - share) / (1 - share)
    }
  }
  const candidates = kind === 'CC' ? onDutyCC : eligible6(s, line, 'TMK', rules).filter(a => !isRestDay6(rules, a.id, at))
  let n = draw * candidates.reduce((sum, a) => sum + rules.weights[a.id], 0)
  return candidates.find(a => { n -= rules.weights[a.id]; return n < 0 })
}
