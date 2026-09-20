import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import type { Account, Role, Student } from './types'
import type { AppState } from './store'
import { businessLineOf } from './channel'
import { isSalesLead } from './funnel'

dayjs.extend(utc)

// Explicit member classification: access to a sales page alone does not make someone a CC.
export const isSalesMember = (account: Account) => account.isSalesMember === true
export const canReceiveLead = (account: Account, roles: Role[], line: string) => {
  const role = roles.find(item => item.id === account.roleId)
  return account.status === '启用' && isSalesMember(account) &&
    (role?.perms.salesV3 ?? role?.perms.sales) === 'operate' &&
    (role?.dataScope === 'all' || account.businessLines.includes(line))
}

export function withPhase5Members<T extends { accounts: Account[] }>(state: T): T {
  // Only classify known synthetic fixtures. Other existing members require an explicit choice.
  const demoEmails = ['sales.lead@dinoai.ai', 'sales.kr@dinoai.ai', 'sales.my@dinoai.ai']
  return { ...state, accounts: state.accounts.map(account => account.isSalesMember !== undefined ? account : {
    ...account, isSalesMember: demoEmails.includes(account.email) || /^management-demo-cc-\d+$/.test(account.id),
  }) }
}

export type AssignmentResult = { id: string; name: string; status: '成功' | '跳过' | '失败'; reason: string }
export type AssignmentRequest = {
  records: Student[]; target: string; actor: string; source: '用户中心五期' | '销售中心五期'
  scope: string[] | null; permitted: boolean; seeAllOwners: boolean; reason: string; now?: string
}

export function assignLeads(state: AppState, request: AssignmentRequest): { state: AppState; results: AssignmentResult[] } {
  const now = request.now ?? dayjs.utc().format('YYYY-MM-DD HH:mm:ss')
  const target = state.accounts.find(account => account.email === request.target)
  const snapshot = new Map(request.records.map(record => [record.studentId, record]))
  const current = new Map(state.students.map(record => [record.studentId, record]))
  const results: AssignmentResult[] = []
  const changed = new Map<string, Student>()
  for (const [id, before] of snapshot) {
    const student = current.get(id)
    let failure = ''
    const line = student ? businessLineOf(state.channels, student) : ''
    if (!request.permitted) failure = '当前账号无分配权限'
    else if (!student) failure = '线索不存在'
    else if (request.scope !== null && !request.scope.includes(line)) failure = '不在授权业务线范围内'
    else if (request.source === '销售中心五期' && !request.seeAllOwners && student.salesOwner && student.salesOwner !== request.actor) failure = '不在可操作的线索范围内'
    else if (!isSalesLead(student, state.lessons)) failure = '当前用户不符合销售线索条件'
    else if (student.salesOwner !== before.salesOwner) failure = '负责人已变化，请刷新后重试'
    else if (!target || !canReceiveLead(target, state.roles, line)) failure = '目标销售已停用、无承接权限或业务线不匹配'
    if (failure || !student || !target) {
      results.push({ id, name: before.localName || before.name, status: '失败', reason: failure })
      continue
    }
    if (student.salesOwner === target.email) {
      results.push({ id, name: student.localName || student.name, status: '跳过', reason: '已归属该销售，无需重复分配' })
      continue
    }
    const old = state.accounts.find(account => account.email === student.salesOwner)
    const oldLabel = old ? `${old.name}（${old.email}）` : student.salesOwner || '未分配'
    const newLabel = `${target.name}（${target.email}）`
    const note = `【${request.source}】${oldLabel} → ${newLabel}${request.reason.trim() ? `；原因：${request.reason.trim()}` : ''}`
    const progress = student.salesOwner ? student.salesProgress || '跟进中' : '跟进中'
    changed.set(id, { ...student, salesOwner: target.email, ccName: target.name,
      salesProgress: progress, salesUpdatedAt: now, lastModifier: request.actor,
      salesHistory: [{ progress, note, time: now, owner: request.actor }, ...(student.salesHistory || [])],
      editHistory: [{ time: now, action: 'user.hist.edit', modifier: request.actor,
        changes: [{ field: 'CC', before: oldLabel, after: newLabel }] }, ...(student.editHistory || [])],
    })
    results.push({ id, name: student.localName || student.name, status: '成功', reason: `已分配给 ${target.name}` })
  }
  return { results, state: { ...state, students: state.students.map(student => changed.get(student.studentId) || student),
    logs: changed.size ? [{ id: `assignment-${Date.now()}-${Math.random().toString(36).slice(2)}`, time: now,
      actor: request.actor, module: request.source === '用户中心五期' ? 'usersV2' : 'salesV5_batch_assign',
      action: `${request.source}：分配 ${changed.size} 条线索给 ${target?.name}；${request.reason.trim() || '未填写原因'}`,
      target: [...changed.keys()].join(', ') }, ...state.logs] : state.logs,
  } }
}
