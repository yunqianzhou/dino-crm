const assert = require('node:assert/strict')
const { mkdtempSync, rmSync } = require('node:fs')
const { tmpdir } = require('node:os')
const { resolve, join } = require('node:path')
const { execFileSync } = require('node:child_process')
const tmp = mkdtempSync(join(tmpdir(), 'crm-ab-config-tests-'))
try {
  execFileSync(resolve('node_modules/.bin/tsc'), ['src/abTestConfig.ts', '--outDir', tmp, '--module', 'commonjs', '--moduleResolution', 'node', '--target', 'ES2020', '--skipLibCheck'], { stdio: 'inherit' })
  const m = require(join(tmp, 'abTestConfig.js'))
  const pages = require(join(tmp, 'abPageConfig.js'))
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

  // Country matching includes global configurations; dimensions intersect.
  assert(m.matchesTargetFilters({ ...scope, countries: ['*'], platforms: ['iOS', 'Android'] }, 'US', 'iOS'))
  assert(!m.matchesTargetFilters(scope, 'MY', 'Android'))
  assert(!m.matchesTargetFilters(scope, 'SA', 'iOS'))
  assert(m.matchesTargetFilters(scope, 'SA', 'Android'))
  assert.equal(m.versionSummary({ ...scope, versions: [] }), '全部版本')

  // Audit snapshots are immutable, survive serialization and capture replaced versions.
  const originalAuditStore = m.seedStore()
  const auditedDraft = { ...m.newOnline(), name: 'History test' }
  const firstAudit = m.recordABHistory(originalAuditStore, m.saveOnline(originalAuditStore, auditedDraft), 'Alice', '保存草稿')
  const editedDraft = m.clone(auditedDraft)
  editedDraft.name = 'History renamed'
  editedDraft.plan.copy.auth.title = 'Changed title'
  const secondAudit = m.recordABHistory(firstAudit, m.saveOnline(firstAudit, editedDraft), 'Bob', '保存草稿')
  assert.equal(secondAudit.history.length, 2)
  assert.equal(secondAudit.history[0].snapshot.name, 'History test')
  assert.equal(secondAudit.history[1].actor, 'Bob')
  assert(secondAudit.history[1].changes.includes('流程、页面或译文'))
  editedDraft.plan.copy.auth.title = 'Unsaved mutation'
  assert.equal(secondAudit.history[1].snapshot.plan.copy.auth.title, 'Changed title')
  assert.equal(JSON.parse(JSON.stringify(secondAudit)).history.length, 2)
  const replacementDraft = { ...m.clone(originalAuditStore.online[0]), id: m.makeId(), status: 'draft', replacesId: originalAuditStore.online[0].id }
  const replacementAudit = m.recordABHistory(originalAuditStore, m.publishOnline(originalAuditStore, replacementDraft), 'Alice', '发布线上配置')
  const previousVersionHistory = replacementAudit.history.filter(h => h.entityId === replacementDraft.replacesId)
  assert.deepEqual(previousVersionHistory.map(h => h.action), ['编辑前快照', '被新版本替换'])
  assert.equal(previousVersionHistory[0].snapshot.status, 'published')
  assert.equal(previousVersionHistory[1].snapshot.status, 'retired')
  assert.equal(originalAuditStore.history, undefined)

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
  assert.deepEqual(m.validateOnlineSettings(overlap), [])
  assert(m.validateOnlineSettings({ ...overlap, name: '' }).some(e => e.includes('名称')))
  assert(m.validateExperimentSettings(invalid).some(e => e.includes('流量')))
  assert(m.validatePlan({ ...exp.variants[0].plan, pages: { name: { ...exp.variants[0].plan.pages.name, assets: { background: { mode: 'custom', src: '' } } } } }).some(e => e.includes('素材')))
  assert.throws(() => m.publishOnline(store, overlap), /重叠/)

  // New page resources, structural options and translations belong to each group snapshot.
  const detail = exp.variants[1].plan.pages.name
  detail.assets.background = { mode: 'custom', src: 'asset:test-image', name: 'background.png' }
  detail.settings.showGuide = false
  exp.variants[1].plan.pages['retention-promo'].settings.period = 'yearly'
  exp.variants[1].plan.pageTranslations.en = { name: { guide: 'Hello {昵称}' } }
  assert.equal(exp.variants[0].plan.pages.name.assets.background.mode, 'inherit')
  assert.equal(pages.previewVariables('Hi {昵称}, {当前定级}', '', 'L2'), 'Hi , L2')
  assert.equal(pages.validAssetSource('javascript:alert(1)'), false)
  assert.equal(pages.validAssetSource('https://images.example.com/hero.gif'), true)
  const edited = m.clone(exp)
  edited.variants[1].plan.pages.level.lists.options.reverse()
  assert(m.validateExperiment(edited).some(x => x.includes('业务') || x.includes('顺序')))
  const configured = m.clone(exp)
  const paywall = configured.variants[1].plan.pages.paywall
  paywall.settings.productMode = 'custom'
  paywall.settings.skus = [pages.demoProducts(configured.target)[0].id]
  paywall.settings.defaultSku = 'missing'
  assert(m.validateExperiment(configured).some(x => x.includes('默认套餐')))
  paywall.settings.defaultSku = paywall.settings.skus[0]
  assert.deepEqual(m.validateExperiment(configured), [])
  configured.target.platforms = ['iOS']
  assert(m.validateExperiment(configured).some(x => x.includes('商品范围')))
  const cleared = m.clone(exp)
  cleared.variants[0].plan.copy.name.button = ''
  assert.deepEqual(m.validateExperiment(cleared), [])
  assert.equal(cleared.variants[0].plan.pages.name.assets.guide.mode, 'inherit')
  const now = Date.now()
  store = m.enableExperiment(store, exp, now)
  const enabled = store.experiments.find(x => x.id === exp.id)
  exp.variants[1].plan.translations.en.auth.title = 'Should not leak'
  assert.equal(enabled.variants[1].plan.translations.en.auth.title, 'Hello B')
  detail.assets.background.src = 'asset:changed-after-enable'
  assert.equal(enabled.variants[1].plan.pages.name.assets.background.src, 'asset:test-image')
  assert.equal(m.experimentState(enabled, now), '进行中')
  assert.equal(m.experimentState(enabled, Date.parse(enabled.endAt)), '已结束')
  assert.throws(() => m.saveExperiment(store, { ...m.clone(enabled), status: 'draft', traffic: 80 }), /冻结/)
  assert.throws(() => m.enableExperiment(store, enabled), /冻结/)
  const promotion = m.promoteVariant(enabled, enabled.variants[1])
  assert.equal(promotion.status, 'draft')
  assert.equal(promotion.plan.pages.name.assets.background.src, 'asset:test-image')
  assert.equal(promotion.plan.pages['retention-promo'].settings.period, 'yearly')
  assert.equal(promotion.plan.pageTranslations.en.name.guide, 'Hello {昵称}')
  promotion.plan.pages.name.settings.showGuide = true
  assert.equal(enabled.variants[1].plan.pages.name.settings.showGuide, false)
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
