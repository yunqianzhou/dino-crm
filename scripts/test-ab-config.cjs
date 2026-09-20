const assert = require('node:assert/strict')
const { mkdtempSync, rmSync } = require('node:fs')
const { tmpdir } = require('node:os')
const { resolve, join } = require('node:path')
const { execFileSync } = require('node:child_process')
const tmp = mkdtempSync(join(tmpdir(), 'crm-ab-config-tests-'))
try {
  execFileSync(resolve('node_modules/.bin/tsc'), ['src/abTestConfig.ts', '--outDir', tmp, '--module', 'commonjs', '--moduleResolution', 'node', '--target', 'ES2020', '--skipLibCheck'], { stdio: 'inherit' })
  const m = require(join(tmp, 'abTestConfig.js'))
  const cond = (operator, value) => ({ operator, value })
  assert.equal(m.versionMatches('1.10.0', [cond('>', '1.9.0')]), true)
  assert.equal(m.versionMatches('1.8.0', [cond('>=', '1.8.0'), cond('<', '1.9.0')]), true)
  assert.equal(m.versionMatches('1.9.0', [cond('>=', '1.8.0'), cond('<', '1.9.0')]), false)
  assert.equal(m.versionMatches('1.8.0', [cond('=', '1.8.0')]), true)
  assert.equal(m.versionMatches('1.8.0', [cond('<=', '1.8.0')]), true)
  assert.equal(m.versionRangeExists([cond('>=', '1.9.0'), cond('<', '1.8.0')]), false)
  assert.equal(m.versionRangeExists([cond('>', '1.8.0'), cond('<', '1.8.1')]), false)
  assert.equal(m.versionRangeExists([cond('=', '1.8.0'), cond('>', '1.8.0')]), false)
  assert.equal(m.versionRangeExists([cond('>=', '1.8.0'), cond('<=', '1.8.0')]), true)
  assert.equal(m.versionRangeExists([cond('=', '1.x.0')]), false)
  assert.equal(m.versionRangeExists([]), true)
  const scope = m.defaultTarget()
  assert.equal(m.targetsOverlap(scope, { ...scope, platforms: ['iOS'] }), false)
  assert.equal(m.targetsOverlap(scope, { ...scope, countries: ['MY'] }), false)
  assert.equal(m.targetsOverlap(scope, { ...scope, countries: ['*'] }), true)
  assert.equal(m.targetsOverlap(scope, { ...scope, versions: [cond('>=', '1.9.0')] }), false)
  assert(m.validateTarget({ ...scope, countries: [] }).length)
  assert(m.validateTarget({ ...scope, platforms: [] }).length)

  let store = m.seedStore()
  const base = store.online[0]
  const exp = m.newExperiment(base)
  exp.name = 'Snapshot and freeze test'
  assert.equal(exp.traffic, 20)
  assert.equal(m.weightTotal(exp.variants), 100)
  assert.equal(1000 * exp.traffic / 100 * exp.variants[0].weight / 100, 100)
  assert.deepEqual(m.validateExperiment(exp), [])
  const invalid = m.clone(exp)
  invalid.variants[1].weight = 40
  assert(m.validateExperiment(invalid).some(e => e.includes('100%')))
  invalid.variants[1].weight = 50
  invalid.variants[1].control = true
  assert(m.validateExperiment(invalid).some(e => e.includes('对照组')))
  invalid.traffic = 0
  assert(m.validateExperiment(invalid).some(e => e.includes('实验流量')))
  invalid.endAt = new Date(Date.now() - 1000).toISOString()
  assert(m.validateExperiment(invalid).some(e => e.includes('结束时间')))

  exp.variants[1].plan.copy.auth.title = 'B-only title'
  exp.variants[1].plan.translations.en = { auth: { ...exp.variants[1].plan.copy.auth, title: 'Hello B' } }
  assert.notEqual(base.plan.copy.auth.title, 'B-only title')
  assert.notEqual(exp.variants[0].plan.copy.auth.title, 'B-only title')
  const draft = { ...m.clone(base), id: m.makeId(), status: 'draft', replacesId: base.id }
  draft.plan.copy.auth.title = 'New online content'
  store = m.saveOnline(store, draft)
  assert.equal(store.online.find(x => x.id === base.id).status, 'published')
  assert.notEqual(store.online.find(x => x.id === base.id).plan.copy.auth.title, 'New online content')
  assert.notEqual(exp.base.plan.copy.auth.title, 'New online content')
  store = m.publishOnline(store, draft)
  assert.equal(store.online.find(x => x.id === base.id).status, 'retired')
  assert.equal(store.online.find(x => x.id === draft.id).revision, 2)
  assert.notEqual(exp.base.plan.copy.auth.title, 'New online content')
  const overlap = { ...m.newOnline(), name: 'Overlapping config' }
  assert(m.validateOnline(overlap, store.online).some(e => e.includes('重叠')))
  assert.throws(() => m.publishOnline(store, overlap), /重叠/)

  const now = Date.now()
  store = m.enableExperiment(store, exp, now)
  const enabled = store.experiments.find(x => x.id === exp.id)
  exp.variants[1].plan.translations.en.auth.title = 'Should not leak'
  assert.equal(enabled.variants[1].plan.translations.en.auth.title, 'Hello B')
  assert.equal(m.experimentState(enabled, now), '进行中')
  assert.equal(m.experimentState(enabled, Date.parse(enabled.endAt)), '已结束')
  assert.throws(() => m.saveExperiment(store, { ...m.clone(enabled), status: 'draft', traffic: 80 }), /冻结/)
  assert.throws(() => m.enableExperiment(store, enabled), /冻结/)
  const promotion = m.promoteVariant(enabled, enabled.variants[1])
  assert.equal(promotion.status, 'draft')
  assert.equal(promotion.plan.translations.en.auth.title, 'Hello B')
  promotion.plan.copy.auth.title = 'Promoted edit'
  assert.equal(enabled.variants[1].plan.copy.auth.title, 'B-only title')
  assert.equal(store.experiments[0].status, 'enabled')
  assert.throws(() => m.promoteVariant(m.newExperiment(base), enabled.variants[0]))
  store = m.closeExperiment(store, enabled.id, now + 1000)
  assert.equal(m.experimentState(store.experiments[0], now), '已关闭')
  assert.throws(() => m.closeExperiment(store, enabled.id, now + 1001))

  const scheduled = m.newExperiment(base)
  scheduled.name = 'Scheduled'
  scheduled.startMode = 'scheduled'
  scheduled.startAt = new Date(now + 3600000).toISOString()
  scheduled.endAt = new Date(now + 7200000).toISOString()
  const s2 = m.enableExperiment(store, scheduled, now)
  const enabledScheduled = s2.experiments[0]
  assert.equal(m.experimentState(enabledScheduled, now), '待开始')
  assert.equal(m.experimentState(enabledScheduled, now + 3600000), '进行中')
  assert.equal(m.experimentState(enabledScheduled, now + 7200000), '已结束')
  scheduled.startAt = new Date(now - 1000).toISOString()
  assert(m.validateExperiment(scheduled, now).some(e => e.includes('定时')))
  assert.equal(m.fromDateInput('2026-09-20T20:00'), '2026-09-20T12:00:00.000Z')
  assert.equal(m.toDateInput('2026-09-20T12:00:00.000Z'), '2026-09-20T20:00')
  console.log('A/B configuration checks passed: version boundaries, scope conflicts, draft isolation, group snapshots, translations, freeze, lifecycle, promotion and UTC+8 scheduling.')
} finally { rmSync(tmp, { recursive: true, force: true }) }
