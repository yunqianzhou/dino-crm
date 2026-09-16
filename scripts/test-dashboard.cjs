const assert = require('node:assert/strict')
const { mkdtempSync, symlinkSync, rmSync } = require('node:fs')
const { tmpdir } = require('node:os')
const { resolve, join } = require('node:path')
const { execFileSync } = require('node:child_process')
const tmp = mkdtempSync(join(tmpdir(), 'crm-dashboard-tests-'))
try {
  execFileSync(resolve('node_modules/.bin/tsc'), ['src/dashboardData.ts', 'src/managementDemo.ts', '--outDir', tmp, '--module', 'commonjs', '--moduleResolution', 'node', '--target', 'ES2020', '--esModuleInterop', '--skipLibCheck'], { stdio: 'inherit' })
  symlinkSync(resolve('node_modules'), join(tmp, 'node_modules'), 'dir')
  const { dashboardMetrics, dashboardPopulation, dashboardDateRows, dashboardGroupKey, dashboardGroupRows, dashboardReasonRows, inVietnamRange } = require(join(tmp, 'dashboardData.js'))
  const user = (id, extra = {}) => ({ studentId: id, name: id, phone: '+840000000', account: id, businessLine: '越南', status: '未付费-未体验', userType: '正式用户', registerTime: '2026-09-01 00:00:00', ...extra })
  const a = user('a', { salesOwner: 'a@example.com' })
  const b = user('b', { salesOwner: 'b@example.com', salesProgress: '暂不跟进' })
  const pool = user('pool')
  const paid = user('paid', { status: '付费' })
  const test = user('test', { userType: '测试用户' })
  const other = user('other', { businessLine: '韩国' })
  const rows = [a, b, pool, paid, test, other, a]
  assert.equal(inVietnamRange('2026-08-31 17:00:00', '2026-09-01', '2026-09-01'), true)
  assert.equal(inVietnamRange('2026-08-31 16:59:59', '2026-09-01', '2026-09-01'), false)
  assert.equal(inVietnamRange('2026-09-01T16:59:59Z', '2026-09-01', '2026-09-01'), true)
  assert.equal(inVietnamRange('2026-09-01T17:00:00Z', '2026-09-01', '2026-09-01'), false)
  assert.equal(inVietnamRange(undefined, '', ''), false)
  assert.deepEqual(dashboardPopulation(rows, ['韩国'], true, '').map(s => s.studentId), [])
  const population = dashboardPopulation(rows, null, true, '')
  assert.equal(population.length, 5)
  const own = dashboardPopulation(rows, ['越南'], false, 'a@example.com')
  assert(!own.some(s => s.studentId === 'b'))
  assert(own.some(s => s.studentId === 'pool'))
  const filters = { mode: 'current', start: '', end: '', owner: '', userType: '正式用户' }
  const current = dashboardMetrics(population, [], [], filters)
  assert.deepEqual(current.total.map(s => s.studentId), ['a', 'b', 'pool'])
  assert.equal(current.assigned.length + current.unassigned.length, current.total.length)
  assert.equal(current['待外呼'].length + current['暂不跟进'].length, current.total.length)
  assert.deepEqual(dashboardMetrics(population, [], [], { ...filters, owner: 'b@example.com' }).total.map(s => s.studentId), ['b'])
  assert.equal(dashboardMetrics(population, [], [], { ...filters, userType: '' }).total.length, 4)
  a.salesAppointments = [{ createdAt: '2026-09-02 01:00:00', attendanceStatus: '已出勤', consultationStatus: '已完成' }]
  a.salesLifecycleEvents = [{ node: 'consultation', result: '咨询完成', occurredAt: '2026-09-01 01:00:00', reportedAt: '2026-09-02 01:00:00' }]
  const calls = [{ studentId: 'a', result: '已接通', time: '2026-09-02 01:00:00' }, { studentId: 'a', result: '已接通', time: '2026-09-02 02:00:00' }]
  const period = dashboardMetrics(population, calls, [], { ...filters, mode: 'period', start: '2026-09-02', end: '2026-09-02' })
  assert.equal(period.registered.length, 0)
  for (const key of ['called', 'connected', 'booked', 'attended', 'completed']) assert.equal(period[key].length, 1, key)
  const prior = dashboardMetrics(population, calls, [], { ...filters, mode: 'period', start: '2026-09-01', end: '2026-09-01' })
  assert.equal(prior.completed.length, 0, 'completion is attributed by recorded time')
  a.salesLifecycleEvents = []
  const missing = dashboardMetrics(population, [], [], { ...filters, mode: 'period' })
  assert.equal(missing.attended.length, 0, 'current appointment status must not fabricate a historical event')
  assert.equal(missing.completed.length, 0)
  const { createManagementDemo, withManagementDemo } = require(join(tmp, 'managementDemo.js'))
  const demo = createManagementDemo('2026-09-16T08:00:00Z')
  assert.equal(demo.students.length, 204)
  assert.equal(demo.accounts.length, 6)
  assert.equal(demo.orders.length, 54)
  const demoCurrent = dashboardMetrics(demo.students, demo.callRecords, demo.lessons, filters)
  assert.equal(demoCurrent.total.length, 180)
  assert.equal(demoCurrent.assigned.length, 156)
  assert.equal(demoCurrent.unassigned.length, 24)
  const expected = { '待外呼': 42, '未接通待跟进': 30, '已接通待预约': 24, '已预约': 24, '未出勤待跟进': 12, '咨询未完成待跟进': 12, '咨询完成待支付': 18, '暂不跟进': 12, '已关闭': 6 }
  for (const [stage, count] of Object.entries(expected)) assert.equal(demoCurrent[stage].length, count, stage)
  const demoPeriod = dashboardMetrics(demo.students, demo.callRecords, demo.lessons, { ...filters, mode: 'period' })
  for (const metric of ['registered', 'called', 'connected', 'booked', 'attended', 'completed']) assert(demoPeriod[metric].length > 0, metric)
  const ids = new Set(demo.students.map(s => s.studentId))
  for (const record of [...demo.callRecords, ...demo.orders, ...demo.lessons]) assert(ids.has(record.studentId), 'detail link must resolve')
  assert.deepEqual(new Set(demo.orders.map(o => o.orderStatus)), new Set(['待支付', '已支付', '已退款', '已取消']))
  const edited = { ...demo.students[0], name: 'Existing user edit' }
  const existing = { students: [edited, user('existing')], accounts: [], orders: [], callRecords: [], lessons: [] }
  const migrated = withManagementDemo(existing, '2026-09-16T08:00:00Z')
  assert.equal(migrated.students.length, 205)
  assert.equal(migrated.students[0].name, 'Existing user edit')
  assert(migrated.students.some(s => s.studentId === 'existing'))
  assert.equal(withManagementDemo(migrated, '2026-10-16T08:00:00Z'), migrated, 'reload must not replace dates or edits')
  const afterDelete = { ...migrated, students: migrated.students.slice(1) }
  assert.equal(withManagementDemo(afterDelete), afterDelete, 'reload must not restore deliberate deletions')
  const dateUsers = [user('daily', { registerTime: '2026-08-31 17:00:00', salesOwner: 'cc-a' }), user('excluded', { salesOwner: 'cc-b' })]
  const dailyCalls = [
    { studentId: 'daily', result: '已接通', time: '2026-09-01 16:59:59' },
    { studentId: 'daily', result: '已接通', time: '2026-09-01 16:50:00' },
    { studentId: 'daily', result: '已接通', time: '2026-09-01 17:00:00' },
    { studentId: 'excluded', result: '已接通', time: '2026-09-01 17:00:00' },
  ]
  const dateFilters = { ...filters, mode: 'period', start: '2026-09-01', end: '2026-09-02', owner: 'cc-a' }
  const daily = dashboardDateRows(dateUsers, dailyCalls, [], dateFilters)
  assert.deepEqual(daily.map(row => row.id), ['2026-09-02', '2026-09-01'])
  assert.deepEqual(daily.map(row => row.metrics.connected.map(s => s.studentId)), [['daily'], ['daily']])
  assert.equal(daily.reduce((sum, row) => sum + row.metrics.connected.length, 0), 2)
  assert.equal(dashboardMetrics(dateUsers, dailyCalls, [], dateFilters).connected.length, 1, 'period total must deduplicate across days')
  const currentDaily = dashboardDateRows(dateUsers, dailyCalls, [], { ...dateFilters, mode: 'current' })
  assert.deepEqual(currentDaily.map(row => row.id), ['2026-09-01'], 'current stage groups by registration date')
  assert.equal(currentDaily[0].metrics['已接通待预约'].length, 1)
  assert.equal(dashboardDateRows(dateUsers, dailyCalls, [], { ...dateFilters, start: '2026-09-03' }).length, 0)
  const demoDays = dashboardDateRows(demo.students, demo.callRecords, demo.lessons, filters)
  assert.equal(demoDays.reduce((sum, row) => sum + row.metrics.total.length, 0), 180)
  // Every non-date dimension partitions the same headline metric without losing users.
  for (const grouping of ['cc', 'intent', 'age', 'registrationAge']) {
    for (const source of [demoCurrent, demoPeriod]) {
      const groups = dashboardGroupRows(source, grouping, '2026-09-16T08:00:00Z')
      for (const key of Object.keys(source)) {
        assert.equal(groups.reduce((sum, row) => sum + row.metrics[key].length, 0), source[key].length, grouping + ':' + key)
      }
    }
  }
  assert.equal(dashboardGroupKey(user('missing'), 'age'), '__unknown__')
  assert.equal(dashboardGroupKey(user('missing'), 'intent'), '未填写')
  assert.equal(dashboardGroupKey(user('boundary', { registerTime: '2026-09-08 17:00:00' }), 'registrationAge', '2026-09-16T08:00:00Z'), '0–7')
  assert.equal(dashboardGroupKey(user('boundary', { registerTime: '2026-09-08 16:59:59' }), 'registrationAge', '2026-09-16T08:00:00Z'), '8–30')
  assert.equal(dashboardGroupKey(user('old', { registerTime: '2026-08-01 00:00:00' }), 'registrationAge', '2026-09-16T08:00:00Z'), '31+')
  assert.equal(dashboardGroupKey(user('future', { registerTime: '2026-10-01 00:00:00' }), 'registrationAge', '2026-09-16T08:00:00Z'), '__unknown__')
  const pauseEvent = (reason, time) => ({ node: 'lead', result: '暂不跟进', reason, reportedAt: time })
  const paused = user('reason', { salesOwner: 'cc-a', salesProgress: '暂不跟进', salesLifecycleEvents: [
    pauseEvent('暂无需求', '2026-09-01 02:00:00'), pauseEvent('预算原因', '2026-09-02 02:00:00'), pauseEvent('预算原因', '2026-09-02 03:00:00'),
  ] })
  const noReason = user('no-reason', { salesProgress: '暂不跟进' })
  const reasonPeople = [paused, noReason, user('test-reason', { userType: '测试用户', salesProgress: '暂不跟进' })]
  const nowReasons = dashboardReasonRows(reasonPeople, [], [], filters, 'paused')
  assert.deepEqual(new Set(nowReasons.map(r => r.id)), new Set(['预算原因', '__unknown__']))
  assert.equal(nowReasons.reduce((sum, r) => sum + r.users.length, 0), 2)
  const priorReasons = dashboardReasonRows(reasonPeople, [], [], { ...filters, mode: 'period', start: '2026-09-01', end: '2026-09-02' }, 'paused')
  assert.equal(priorReasons.length, 2, 'period preserves multiple explicit reasons')
  assert(priorReasons.every(r => r.users.length === 1), 'repeated events deduplicate within a reason')
  assert.equal(dashboardReasonRows(reasonPeople, [], [], { ...filters, owner: 'cc-b' }, 'paused').length, 0)
  assert.equal(dashboardReasonRows(reasonPeople, [], [], { ...filters, mode: 'period', start: '2026-09-03' }, 'paused').length, 0)
  const freeText = { ...paused, salesLifecycleEvents: [pauseEvent('其他：客户自行填写', '2026-09-02 02:00:00')] }
  assert.equal(dashboardReasonRows([freeText], [], [], filters, 'paused')[0].id, '其他')
  const unknownReason = { ...paused, salesLifecycleEvents: [pauseEvent('', '2026-09-02 02:00:00')] }
  assert.equal(dashboardReasonRows([unknownReason], [], [], filters, 'paused')[0].id, '__unknown__')
  const demoReasons = dashboardReasonRows(demo.students, demo.callRecords, demo.lessons, filters, 'noShow')
  assert.equal(demoReasons.reduce((sum, row) => sum + row.users.length, 0), 12)
  assert(demoReasons.every(row => row.id !== '__unknown__'))
  const crmNoShow = user('crm-no-show', { salesAppointments: [{ appointmentStatus: '已预约', attendanceStatus: 'No Show', consultationStatus: '待标记' }], salesLifecycleEvents: [{ node: 'attendance', result: '未出勤', reason: '无法联系', reportedAt: '2026-09-02 01:00:00' }] })
  assert.equal(dashboardReasonRows([crmNoShow], [], [], filters, 'noShow')[0].id, '无法联系', 'Sales Center follow-up form uses 未出勤')
  assert.equal(dashboardReasonRows([crmNoShow], [], [], { ...filters, mode: 'period' }, 'noShow')[0].users.length, 1)
  const oldDemo = { ...demo, students: demo.students.map(s => ({ ...s, salesLifecycleEvents: s.salesLifecycleEvents?.map(e => ({ ...e, reason: undefined })) })) }
  const enriched = withManagementDemo(oldDemo)
  assert.equal(enriched.students.length, oldDemo.students.length)
  assert(enriched.students.flatMap(s => s.salesLifecycleEvents || []).some(e => e.reason))
  assert.equal(withManagementDemo(enriched), enriched)
  console.log('Dashboard checks passed: UTC+7 boundaries, deduplication, permissions, shared stages, dimensional totals, reason history, demo migration and recorded activity.')
} finally { rmSync(tmp, { recursive: true, force: true }) }
