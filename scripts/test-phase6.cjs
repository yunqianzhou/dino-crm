const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
const values = new Map()
const perms = { salesV3: 'operate', salesV3_update: 'operate', salesV3_dial: 'operate' }
const base = { accounts: Array.from({ length: 6 }, (_, i) => ({ id: `cc${i}`, name: `CC ${i}`, email: `cc${i}@demo.invalid`, roleId: 'role_support', isSalesMember: true, businessLines: ['越南'], status: '启用' })), roles: [{ id: 'role_support', name: '客服', dataScope: 'line', perms }, { id: 'role_sales_leader', name: '销售组长', dataScope: 'line', perms }], logs: [] }
const timeContext = { exports: {}, require }
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/time.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText, timeContext)
const typesContext = { exports: {}, require }
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/types.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, typesContext)
const context = { exports: {}, require: name => name === './store' ? { getState: () => base } : name === './time' ? timeContext.exports : name === './types' ? typesContext.exports : require(name), crypto: require('node:crypto').webcrypto, localStorage: { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) } }
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/phase6.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, context)
const { seed6, visibleOwners6, eligible6, simulate6: simulateAt6, setState6, addLog6, isCCWorking6, normalizeRules6, isRestDay6, restDays6, canAccessOwner6, assignmentAccess6, applyRulesDraft6, handoffTargets6, migrateState6, memberTeams6 } = context.exports
const friday = new Date('2026-10-09T05:00:00Z')
const simulate6 = (s, line, rules, working, random) => simulateAt6(s, line, rules, working, random, friday)
assert.equal(normalizeRules6({ timeZone: 'Asia/Shanghai' }, '越南').timeZone, 'Asia/Ho_Chi_Minh')
assert.equal(normalizeRules6({ timeZone: 'Asia/Ho_Chi_Minh' }, '马来').timeZone, 'Asia/Kuala_Lumpur')
assert.equal(normalizeRules6({}, '韩国').timeZone, 'Asia/Seoul')
const s = seed6(base), rules = s.rules6['越南']
// Group ownership is metadata; membership is edited from the account form.
const membershipState = seed6(base)
const membershipAccount = membershipState.accounts[1]
membershipState.teams[1].ownerId = membershipAccount.id
const beforeMembershipGrants = JSON.stringify(membershipAccount.dataGrants)
const movedGroups = context.exports.updateMemberGroups6(membershipState.teams, membershipAccount.id, ['vn-sales-2'], ['越南'])
assert.equal(movedGroups[0].memberIds.includes(membershipAccount.id), false)
assert.equal(movedGroups[1].memberIds.includes(membershipAccount.id), true)
assert.equal(movedGroups[1].ownerId, membershipAccount.id)
assert.equal(membershipState.teams[0].memberIds.includes(membershipAccount.id), true, 'membership edits must not mutate the previous state')
assert.equal(JSON.stringify(membershipAccount.dataGrants), beforeMembershipGrants, 'joining a group does not grant access')
assert.equal(visibleOwners6({ ...membershipState, teams: movedGroups }, membershipAccount, '越南').length, 1, 'group ownership does not grant access')
assert.throws(() => context.exports.updateMemberGroups6(membershipState.teams, membershipAccount.id, ['vn-sales-2'], ['韩国']), /已授权/)
assert.throws(() => context.exports.updateMemberGroups6(membershipState.teams, membershipAccount.id, ['missing'], ['越南']), /已授权/)
const disabledGroups = membershipState.teams.map(g => ({ ...g, enabled: false }))
assert.throws(() => context.exports.updateMemberGroups6(disabledGroups, membershipAccount.id, ['vn-sales-2'], ['越南']), /停用/)
assert.equal(context.exports.updateMemberGroups6(disabledGroups, membershipAccount.id, ['vn-sales-1'], ['越南'])[0].memberIds.filter(id => id === membershipAccount.id).length, 1)
assert.equal(migrateState6(seed6(base), membershipState).teams[1].ownerId, membershipAccount.id, 'new owner metadata survives reload')
assert.equal(base.accounts[0].roleId, 'role_support', 'seeding must not mutate phase 5')
assert.deepEqual(Array.from(visibleOwners6(s, s.accounts[0])), ['cc0', 'cc1', 'cc2'])
assert.deepEqual(Array.from(visibleOwners6(s, s.accounts[3])), ['cc3', 'cc4', 'cc5'])
assert.deepEqual(Array.from(visibleOwners6(s, s.accounts[1])), ['cc1'])
s.accounts[0].dataGrants[0].teamIds = []
assert.deepEqual(Array.from(visibleOwners6(s, s.accounts[0])), [], 'empty group scope grants no group data')
s.accounts[0].status = '停用'
assert.equal(visibleOwners6(s, s.accounts[0]).length, 0)
assert.equal(eligible6(s, '越南', 'CC', rules).length, 5)
assert.equal(eligible6(s, '马来', 'CC', rules).length, 0)
// Friday in Vietnam: workday boundaries use local time, not the browser timezone.
assert.equal(isCCWorking6(rules, new Date('2026-10-09T01:59:00Z')), false)
assert.equal(isCCWorking6(rules, new Date('2026-10-09T02:00:00Z')), true)
assert.equal(isCCWorking6(rules, new Date('2026-10-09T10:59:00Z')), true)
assert.equal(isCCWorking6(rules, new Date('2026-10-09T11:00:00Z')), false)
assert.equal(isCCWorking6(rules, new Date('2026-10-10T04:00:00Z')), true)
assert.equal(isCCWorking6({ ...rules, timeZone: 'Asia/Shanghai' }, new Date('2026-10-09T01:00:00Z')), true)
assert.equal(simulate6(s, '越南', rules, false, .9).staffKind, 'TMK')
assert.equal(simulate6(s, '越南', { ...rules, mode: 'direct' }, false, 0).staffKind, 'CC')
assert.equal(simulate6(s, '越南', { ...rules, tmkPercent: 0 }, true, 0).staffKind, 'CC')
assert.equal(simulate6(s, '越南', { ...rules, tmkPercent: 100 }, true, .999).staffKind, 'TMK')
assert.equal(simulate6(s, '越南', { ...rules, mode: 'tmk' }, true, .99).staffKind, 'TMK')
assert.equal(simulate6(s, '越南', { ...rules, mode: 'tmk' }, false, .99).staffKind, 'TMK')
const counts = { CC: 0, TMK: 0 }
const members = {}
for (let i = 0; i < 1000; i++) {
  const a = simulate6(s, '越南', rules, true, (i + .5) / 1000)
  counts[a.staffKind]++; members[a.id] = (members[a.id] || 0) + 1
}
assert.deepEqual(counts, { CC: 800, TMK: 200 })
assert.equal(members['vn-tmk-1'], 100)
assert.equal(members.cc1, 160)
const unequal = { ...rules, weights: { ...rules.weights, 'vn-tmk-1': 3 } }
assert.equal(simulate6(s, '越南', unequal, false, .74).id, 'vn-tmk-1')
assert.equal(simulate6(s, '越南', unequal, false, .75).id, 'vn-tmk-2')
const emptyTMK = { ...rules, weights: { ...rules.weights, 'vn-tmk-1': 0, 'vn-tmk-2': 0 } }
assert.equal(simulate6(s, '越南', emptyTMK, false), undefined)
assert.equal(simulate6(s, '越南', emptyTMK, true, 0), undefined, 'empty TMK pool must not reroute to CC')
assert.equal(normalizeRules6({ mode: 'fallback', weights: { cc1: 8 } }).mode, 'scheduled')
assert.equal(normalizeRules6({ mode: 'tmk' }).mode, 'tmk')
assert.equal(normalizeRules6({ mode: 'fallback', weights: { cc1: 8 } }).weights.cc1, 8)
// Data permissions are independent of job title, staff type and role name.
const authState = seed6(base), viewer = authState.accounts[0]
const viewerRole = authState.roles.find(r => r.id === viewer.roleId)
viewerRole.perms.salesV6_config_members = 'operate'
viewerRole.perms.salesV6_config_line = 'operate'
viewer.staffKind = 'other'
viewerRole.name = '总部运营'
assert.deepEqual(Array.from(visibleOwners6(authState, viewer, '越南')), ['cc0', 'cc1', 'cc2'])
assert.equal(assignmentAccess6(authState, viewer, '越南').lineRules, false)
viewer.dataGrants = [{ line: '越南', scope: 'teams', teamIds: ['vn-sales-2'] }, { line: '马来', scope: 'self', teamIds: [] }]
assert.equal(canAccessOwner6(authState, viewer, '越南', 'cc3'), true)
assert.equal(canAccessOwner6(authState, viewer, '越南', 'cc1'), false)
assert.equal(canAccessOwner6(authState, viewer, '越南', viewer.id), false, 'group access does not silently add own data outside selected groups')
assert.equal(canAccessOwner6(authState, viewer, '马来', viewer.id), true)
assert.equal(canAccessOwner6(authState, viewer, '马来', 'cc3'), false)
assert.equal(canAccessOwner6(authState, viewer, '韩国', viewer.id), false)
const patched = applyRulesDraft6(authState, viewer, '越南', { ...authState.rules6['越南'], tmkPercent: 99, weights: { cc1: 99, cc3: 7 } })
assert.equal(patched.tmkPercent, 20)
assert.equal(patched.weights.cc1, 1)
assert.equal(patched.weights.cc3, 7)
viewer.dataGrants[0] = { line: '越南', scope: 'line', teamIds: [] }
assert.equal(visibleOwners6(authState, viewer, '越南').length, 8)
assert.equal(assignmentAccess6(authState, viewer, '越南').lineRules, true)
viewerRole.perms.salesV6_config_line = 'none'
assert.equal(assignmentAccess6(authState, viewer, '越南').lineRules, false, 'data authorization does not grant an action')
viewerRole.perms.salesV3 = 'none'
assert.equal(visibleOwners6(authState, viewer, '越南').length, 0, 'data scope does not grant missing module permission')
viewerRole.perms.salesV3 = 'operate'
viewer.dataGrants[0] = { line: '越南', scope: 'self', teamIds: [] }
assert.deepEqual(Array.from(visibleOwners6(authState, viewer, '越南')), [viewer.id])
assert.equal(assignmentAccess6(authState, viewer, '越南').memberIds.length, 0)
const tmk = authState.accounts.find(a => a.staffKind === 'TMK')
assert.equal(handoffTargets6(authState, tmk, '越南').length, 5)
assert.deepEqual(Array.from(visibleOwners6(authState, tmk, '越南')), [tmk.id])
assert.equal(handoffTargets6(authState, tmk, '马来').length, 0)
// Group member lists define whose customers are included; access grants do not change membership.
const groups = seed6(base), reader = groups.accounts[0], cc = groups.accounts[1]
groups.teams[1].memberIds.push(cc.id)
assert.deepEqual(Array.from(visibleOwners6(groups, cc, '越南')), [cc.id], 'joining groups does not grant group visibility')
assert.equal(eligible6(groups, '越南', 'CC', groups.rules6['越南']).filter(a => a.id === cc.id).length, 1)
reader.dataGrants[0].teamIds = ['vn-sales-1', 'vn-sales-2']
assert.equal(visibleOwners6(groups, reader, '越南').length, 6)
reader.dataGrants[0].teamIds = ['vn-sales-1']
assert.equal(canAccessOwner6(groups, reader, '越南', 'cc3'), false, 'overlapping group members do not cause transitive access')
assert.equal(memberTeams6(groups, reader, '越南').length, 1)
groups.accounts[2].dataGrants[0] = { line: '越南', scope: 'line', teamIds: [] }
assert.equal(memberTeams6(groups, groups.accounts[2], '越南').length, 1, 'whole-line permission does not assign a person to all groups')
// Migrate the discarded management-identity prototype without widening ordinary members.
const oldDesign = JSON.parse(JSON.stringify(seed6(base)))
delete oldDesign.permissionModel6
for (const t of oldDesign.teams) delete t.memberIds
oldDesign.accounts.forEach((a, i) => {
  const scope = a.dataGrants[0].scope
  a.dataGrants = [{ line: '越南', identity: i === 0 || i === 3 ? 'leader' : 'member', scope: 'teams', teamIds: [i < 3 ? 'vn-sales-1' : i < 6 ? 'vn-sales-2' : 'vn-tmk'] }]
})
oldDesign.accounts[2].dataGrants.push({ line: '马来', identity: 'owner', scope: 'line', teamIds: [] })
oldDesign.roles[0].customerScope = 'team'
oldDesign.teams[0].leaderId = 'cc0'
const merged = migrateState6(seed6(base), oldDesign)
assert.equal(merged.accounts[0].dataGrants[0].scope, 'teams')
assert.equal(merged.accounts[1].dataGrants[0].scope, 'self')
assert.equal(merged.accounts[2].dataGrants[1].scope, 'line')
assert.equal(merged.accounts[0].dataGrants[0].identity, undefined)
assert.equal(merged.roles[0].customerScope, undefined)
assert.equal(merged.teams[0].leaderId, undefined)
assert.deepEqual(Array.from(merged.teams[0].memberIds), ['cc0', 'cc1', 'cc2'])
assert.equal(JSON.stringify(migrateState6(seed6(base), merged)), JSON.stringify(merged))
merged.accounts[0].roleId = 'role_support'
assert.equal(visibleOwners6(merged, merged.accounts[0], '越南').length, 3, 'changing to another function role does not replace data scope')
const saturday = new Date('2026-10-10T05:00:00Z')
assert.equal(isRestDay6(rules, 'cc1', saturday), true)
assert.equal(isRestDay6(rules, 'cc1', new Date('2026-10-09T18:00:00Z')), true, 'rest day starts at local midnight')
const tmkSaturday = { ...rules, restDays: { 'vn-tmk-1': [1, 2] } }
assert.equal(simulateAt6(s, '越南', tmkSaturday, true, .9, saturday).id, 'vn-tmk-1', 'all CC resting sends leads only to a non-resting TMK')
assert.equal(simulateAt6(s, '越南', rules, true, .9, saturday), undefined, 'both teams resting keeps leads pending')
const tmkFridayOff = { ...rules, restDays: { 'vn-tmk-1': [5] } }
for (const mode of ['tmk', 'scheduled']) {
  for (const working of [true, false]) {
    for (const draw of [0, .05, .19]) assert.equal(simulate6(s, '越南', { ...tmkFridayOff, mode }, working, draw).id, 'vn-tmk-2')
  }
}
const allTMKOff = { ...rules, restDays: { 'vn-tmk-1': [5], 'vn-tmk-2': [5] } }
assert.equal(simulate6(s, '越南', allTMKOff, true, .1), undefined, 'TMK share stays pending while CC works')
assert.equal(simulate6(s, '越南', allTMKOff, true, .9).staffKind, 'CC', 'CC share is unaffected by TMK rest')
assert.equal(simulate6(s, '越南', allTMKOff, false, .9), undefined)
assert.equal(simulate6(s, '越南', { ...allTMKOff, mode: 'tmk' }, true, .9), undefined)
assert.equal(isRestDay6(tmkFridayOff, 'vn-tmk-1', new Date('2026-10-08T18:00:00Z')), true, 'TMK rest day uses business timezone')
assert.equal(simulateAt6(s, '越南', { ...rules, mode: 'direct' }, true, .9, saturday), undefined, 'CC-only mode never switches to TMK')
const rotating = { ...rules, tmkPercent: 0, restDays: { cc1: [1, 2], cc2: [1] } }
const saturdayBefore = JSON.stringify(s)
assert.equal(simulateAt6(s, '越南', rotating, true, 0, saturday).id, 'cc1')
assert.equal(simulateAt6(s, '越南', rotating, true, .99, saturday).id, 'cc2')
assert.equal(JSON.stringify(s), saturdayBefore, 'rest-day routing does not change existing owners')
const fridayOff = { ...rules, tmkPercent: 0, restDays: { cc1: [5] } }
for (let i = 0; i < 100; i++) assert.notEqual(simulate6(s, '越南', fridayOff, true, i / 100).id, 'cc1')
assert.deepEqual(Array.from(restDays6(normalizeRules6({ workDays: [1, 2, 3, 4, 5, 6] }), 'cc1')), [0], 'migrate old common weekdays')
assert.deepEqual(Array.from(restDays6(normalizeRules6({ restDays: { cc1: [] } }), 'cc1')), [], 'an explicit empty rest list overrides defaults')
s.teams[1].enabled = false
assert.equal(eligible6(s, '越南', 'CC', rules).length, 2)
s.roles.find(r => r.id === 'role_support').perms.salesV3_update = 'none'
assert.equal(eligible6(s, '越南', 'CC', rules).length, 0)
setState6(prev => ({ ...prev, rules6: { ...prev.rules6, '越南': { ...prev.rules6['越南'], tmkPercent: 35, restDays: { cc1: [2, 3], 'vn-tmk-1': [1, 4] } } } }))
addLog6({ actor: 'demo', module: 'system', action: '保存规则', target: '越南' })
const persisted = JSON.parse(values.get('dinoai_crm_phase6_incremental_v1'))
assert.equal(persisted.rules6['越南'].tmkPercent, 35)
assert.deepEqual(persisted.rules6['越南'].restDays.cc1, [2, 3])
assert.deepEqual(persisted.rules6['越南'].restDays['vn-tmk-1'], [1, 4])
assert.equal(persisted.logs[0].action, '保存规则')
assert.equal(values.size, 1, 'only phase 6 data may be written')
console.log('Phase 6 checks passed: team scope, line isolation, work hours, timezone boundaries, two-stage ratios, rest days, migration and isolated persistence.')
