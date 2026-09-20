const assert = require('node:assert/strict')
const { mkdtempSync, symlinkSync, rmSync } = require('node:fs')
const { tmpdir } = require('node:os')
const { resolve, join } = require('node:path')
const { execFileSync } = require('node:child_process')
const tmp = mkdtempSync(join(tmpdir(), 'crm-dashboard-tests-'))
try {
  execFileSync(resolve('node_modules/.bin/tsc'), ['src/dashboardData.ts', 'src/managementDemo.ts', 'src/dashboardView.ts', '--outDir', tmp, '--module', 'commonjs', '--moduleResolution', 'node', '--target', 'ES2020', '--esModuleInterop', '--skipLibCheck'], { stdio: 'inherit' })
  symlinkSync(resolve('node_modules'), join(tmp, 'node_modules'), 'dir')
  const { dashboardMetrics, dashboardPopulation, dashboardDateRows, dashboardGroupKey, dashboardGroupRows, dashboardReasonRows, dashboardPaymentOrders, dashboardPaymentSummary, dashboardBreakdownPayments, dashboardCohortRates, dashboardCohortMetrics, dashboardCohortRows, COHORT_METRICS, inVietnamRange } = require(join(tmp, 'dashboardData.js'))
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
  // Payment evidence comes from orders, independent of the profile flag and funnel history.
  const paidUsers = [user('payer', { salesOwner: 'cc-a' }), user('flag-only', { status: '付费' }), user('test-payer', { userType: '测试用户' })]
  const paidOrder = (id, studentId, overrides = {}) => ({ orderId: id, studentId, orderStatus: '已支付', paidAmount: 100, paidTime: '2026-09-01T17:00:00Z', ...overrides })
  const paymentOrders = [paidOrder('one', 'payer'), paidOrder('repeat', 'payer'), paidOrder('test', 'test-payer'),
    ...['待支付', '已退款', '已取消'].map((orderStatus, i) => paidOrder('excluded-' + i, 'flag-only', { orderStatus })),
    paidOrder('free', 'flag-only', { paidAmount: 0 }), paidOrder('missing-date', 'flag-only', { paidTime: undefined }),
    paidOrder('invalid-date', 'flag-only', { paidTime: 'invalid' }), paidOrder('unknown-user', 'absent'),
  ]
  const paymentFilter = { ...filters, mode: 'period', start: '2026-09-02', end: '2026-09-02' }
  assert.deepEqual(dashboardMetrics(paidUsers, [], [], paymentFilter, paymentOrders).paid.map(s => s.studentId), ['payer'])
  assert.equal(dashboardMetrics(paidUsers, [], [], { ...paymentFilter, start: '2026-09-01', end: '2026-09-01' }, paymentOrders).paid.length, 0, 'payment uses UTC+7 date')
  assert.equal(dashboardMetrics(paidUsers, [], [], { ...paymentFilter, owner: 'cc-b' }, paymentOrders).paid.length, 0)
  assert.equal(dashboardMetrics(paidUsers, [], [], { ...paymentFilter, mode: 'current' }, paymentOrders).paid.length, 0, 'current view uses registration date')
  assert.equal(dashboardMetrics(paidUsers, [], [], { ...filters, start: '2026-09-01', end: '2026-09-01' }, paymentOrders).paid.length, 1)
  const paymentDays = dashboardDateRows(paidUsers, [], [], paymentFilter, paymentOrders)
  assert.deepEqual(paymentDays.map(r => [r.id, r.metrics.paid.length]), [['2026-09-02', 1]], 'include payment-only days')
  const repeatDays = [...paymentOrders, paidOrder('next-day', 'payer', { paidTime: '2026-09-02T17:00:00Z' })]
  assert.equal(dashboardDateRows(paidUsers, [], [], { ...paymentFilter, end: '2026-09-03' }, repeatDays).reduce((sum, r) => sum + r.metrics.paid.length, 0), 2)
  assert.equal(dashboardMetrics(paidUsers, [], [], { ...paymentFilter, end: '2026-09-03' }, repeatDays).paid.length, 1)
  const demoPayments = dashboardMetrics(demo.students, demo.callRecords, demo.lessons, filters, demo.orders)
  assert.equal(demoPayments.paid.length, 24)
  assert.equal(demoPayments.total.length, 180, 'paid card does not change current lead denominator')
  // Payment panels must use payment dates (not registration dates) and exact payer sets.
  const periodOrders = dashboardPaymentOrders(paymentOrders, paidUsers, paymentFilter)
  assert.deepEqual(periodOrders.map(o => o.orderId), ['one', 'repeat'])
  assert.equal(dashboardPaymentOrders(paymentOrders, paidUsers, { ...paymentFilter, owner: 'cc-b' }).length, 0)
  assert.equal(dashboardPaymentOrders(paymentOrders, paidUsers, { ...paymentFilter, start: '2026-09-01', end: '2026-09-01' }).length, 0)
  assert.deepEqual(new Set(periodOrders.map(o => o.studentId)), new Set(dashboardMetrics(paidUsers, [], [], paymentFilter, paymentOrders).paid.map(s => s.studentId)))
  const currencies = dashboardPaymentSummary([
    ...periodOrders.map(o => ({ ...o, currency: 'VND' })),
    paidOrder('usd', 'payer', { currency: 'USD', paidAmount: 5 }),
    paidOrder('missing-currency', 'payer', { currency: '', paidAmount: 20 }),
  ])
  assert.equal(currencies.find(c => c.currency === 'VND').amount, 200)
  assert.equal(currencies.find(c => c.currency === 'VND').users, 1)
  assert.equal(currencies.find(c => c.currency === 'VND').averagePerUser, 200)
  assert.equal(currencies.find(c => c.currency === 'USD').amount, 5, 'never add different currencies')
  assert.equal(currencies.find(c => c.currency === '__unknown__').amount, 20)
  assert.deepEqual(dashboardPaymentSummary([]), [])
  const refunded = paymentOrders.map(o => o.orderId === 'one' ? { ...o, orderStatus: '已退款' } : o)
  assert.deepEqual(dashboardPaymentOrders(refunded, paidUsers, paymentFilter).map(o => o.orderId), ['repeat'], 'refund restates original payment period')
  const allRefunded = paymentOrders.map(o => o.studentId === 'payer' ? { ...o, orderStatus: '已退款' } : o)
  assert.equal(dashboardPaymentOrders(allRefunded, paidUsers, paymentFilter).length, 0)
  const paymentDailyRows = dashboardPaymentSummary(dashboardPaymentOrders(repeatDays, paidUsers, { ...paymentFilter, end: '2026-09-03' }))
  assert.equal(paymentDailyRows[0].users, 1, 'whole-period payer total must deduplicate across dates')
  assert.equal(dashboardDateRows(demo.students, demo.callRecords, demo.lessons, filters, demo.orders).reduce((sum, r) => sum + r.metrics.paid.length, 0), 24)
  for (const group of ['cc', 'age', 'intent', 'registrationAge']) assert.equal(dashboardGroupRows(demoPayments, group).reduce((sum, r) => sum + r.metrics.paid.length, 0), 24)
  // Registration cohorts retain paid users and later outcomes, never current status guesses.
  const cohortPeople = [
    user('history', { salesOwner: 'cc-a', salesAppointments: [{ createdAt: '2026-09-10T00:00:00Z', appointmentStatus: '已取消', attendanceStatus: '已出勤' }] }),
    user('recorded', { salesOwner: 'cc-b', salesLifecycleEvents: [{ node: 'consultation', result: '咨询完成', reportedAt: '2026-09-12T00:00:00Z' }] }),
    user('paid-cohort', { status: '付费', salesOwner: 'cc-a' }),
    user('outside-cohort', { registerTime: '2026-09-02T00:00:00Z' }),
    user('test-cohort', { userType: '测试用户' }), user('no-phone', { phone: '' }),
  ]
  const cohortFilter = { ...filters, start: '2026-09-01', end: '2026-09-01' }
  const cohortCalls = [{ studentId: 'history', result: '已接通', time: '2026-09-10T00:00:00Z' }, { studentId: 'history', result: '已接通', time: '2026-09-11T00:00:00Z' }, { studentId: 'paid-cohort', result: '已接通', time: 'invalid' }]
  const cohortOrders = [paidOrder('later-payment', 'paid-cohort', { paidTime: '2026-09-13T00:00:00Z' })]
  const cohort = dashboardCohortMetrics(cohortPeople, cohortCalls, cohortFilter, cohortOrders)
  assert.deepEqual(cohort.leads.map(s => s.studentId), ['history', 'recorded', 'paid-cohort'])
  assert.deepEqual(cohort.connected.map(s => s.studentId), ['history'], 'later repeated calls count once; invalid dates excluded')
  assert.deepEqual(cohort.booked.map(s => s.studentId), ['history'], 'cancellation does not erase a past booking')
  assert.deepEqual(cohort.attended.map(s => s.studentId), ['recorded'], 'current attendance flags cannot substitute for historical records')
  assert.deepEqual(cohort.paid.map(s => s.studentId), ['paid-cohort'], 'keep paid cohort users and later payments')
  assert.equal(dashboardCohortMetrics(cohortPeople, cohortCalls, { ...cohortFilter, owner: 'cc-a' }, cohortOrders).leads.length, 2)
  const cohortTree = dashboardCohortRows(cohort, 'date', 'cc')
  assert.equal(cohortTree.length, 1)
  assert.equal(cohortTree[0].children.length, 2)
  assert.equal(new Set([cohortTree[0].id, ...cohortTree[0].children.map(row => row.id)]).size, 3)
  for (const key of COHORT_METRICS) {
    assert.equal(cohortTree[0].metrics[key].length, cohort[key].length)
    assert.equal(cohortTree[0].children.reduce((sum, row) => sum + row.metrics[key].length, 0), cohort[key].length, 'subgroups must preserve ' + key)
  }
  assert(dashboardCohortRows(cohort, 'cc', '').every(row => !row.children))
  assert(dashboardCohortRows(cohort, 'cc', 'cc').every(row => !row.children))
  assert.equal(dashboardCohortMetrics(cohortPeople, cohortCalls, { ...cohortFilter, start: '2026-10-01', end: '2026-10-31' }, cohortOrders).leads.length, 0)
  // Reference rates use agreed step denominators and reject missing preceding-step evidence.
  const referencePeople = ['r1', 'r2', 'r3', 'r4'].map(id => user(id))
  const referenceMetrics = { leads: referencePeople, connected: referencePeople.slice(0, 3), booked: referencePeople.slice(0, 2), attended: referencePeople.slice(0, 1), paid: referencePeople.slice(0, 1) }
  const referenceRates = dashboardCohortRates(referenceMetrics)
  assert.deepEqual(referenceRates.map(rate => Math.round(rate.value * 10) / 10), [75, 66.7, 50, 100, 25])
  assert(referenceRates.every(rate => rate.reason === null))
  const partialRates = dashboardCohortRates(cohort)
  assert.equal(partialRates.find(rate => rate.key === 'rateAttendance').reason, 'missingHistory')
  assert.equal(partialRates.find(rate => rate.key === 'ratePaid').value, null)
  assert(Math.abs(partialRates.find(rate => rate.key === 'rateTotal').value - 100 / 3) < 1e-10)
  const emptyRates = dashboardCohortRates(Object.fromEntries(COHORT_METRICS.map(key => [key, []])))
  assert(emptyRates.every(rate => rate.value === null && rate.reason === 'zeroDenominator'))
  const noPaymentRate = dashboardCohortRates({ ...referenceMetrics, paid: [] })
  assert.equal(noPaymentRate.find(rate => rate.key === 'ratePaid').value, 0)
  // AOV is per order, not per paying user; cohort amounts include payments made later.
  assert.equal(currencies.find(c => c.currency === 'VND').averagePerOrder, 100)
  assert.equal(currencies.find(c => c.currency === 'VND').averagePerUser, 200)
  const registeredFirst = { ...filters, start: '2026-09-01', end: '2026-09-01' }
  assert.equal(dashboardBreakdownPayments(paymentOrders, paidUsers, registeredFirst).length, 2)
  assert.equal(dashboardBreakdownPayments(paymentOrders, paidUsers, { ...registeredFirst, mode: 'period' }).length, 0)
  assert.equal(dashboardBreakdownPayments(paymentOrders, paidUsers, filters, 'date', '2026-09-01', 'cc-a').length, 2)
  assert.equal(dashboardBreakdownPayments(paymentOrders, paidUsers, filters, 'date', '2026-09-01', 'cc-b').length, 0)
  assert.equal(dashboardBreakdownPayments(paymentOrders, paidUsers, { ...filters, mode: 'period' }, 'date', '2026-09-02', 'cc-a').length, 2)
  assert.equal(dashboardBreakdownPayments(paymentOrders, paidUsers, filters, 'cc', 'cc-a').length, 2)
  assert.equal(dashboardBreakdownPayments(paymentOrders, paidUsers, filters, 'cc', 'cc-b').length, 0)
  assert.equal(dashboardBreakdownPayments(paymentOrders, paidUsers, filters, 'source', 'absent-source').length, 0)
  const matrixPeople = cohortPeople.map((person, i) => ({ ...person, channelSource: i % 2 ? 'Source B' : 'Source A' }))
  const matrixMetrics = dashboardCohortMetrics(matrixPeople, cohortCalls, cohortFilter, cohortOrders)
  for (const primary of ['date', 'cc']) {
    const matrix = dashboardCohortRows(matrixMetrics, primary, 'source')
    assert.equal(matrix.reduce((sum, row) => sum + row.metrics.leads.length, 0), 3)
    assert.equal(matrix.flatMap(row => row.children).reduce((sum, row) => sum + row.metrics.leads.length, 0), 3)
    for (const row of matrix) assert.equal(row.children.reduce((sum, child) => sum + child.metrics.paid.length, 0), row.metrics.paid.length)
  }
  // Question views keep their own date meaning and preserve old shared detail links.
  const { dashboardView, dashboardViewRange, dashboardSwitchView } = require(join(tmp, 'dashboardView.js'))
  assert.equal(dashboardView(new URLSearchParams()), 'cohort')
  assert.equal(dashboardView(new URLSearchParams('mode=period')), 'period')
  assert.equal(dashboardView(new URLSearchParams('detail=paid')), 'current')
  const legacyPayment = new URLSearchParams('mode=current&start=2026-09-01&end=2026-09-10&paymentStart=2026-09-11&paymentEnd=2026-09-12&paymentDetail=1')
  assert.equal(dashboardView(legacyPayment), 'payments')
  assert.deepEqual(dashboardViewRange(legacyPayment, 'payments'), { start: '2026-09-11', end: '2026-09-12' })
  const legacyCohort = new URLSearchParams('mode=period&start=2026-09-01&end=2026-09-10&cohortStart=2026-08-01&cohortEnd=2026-08-31&cohortDetail=paid')
  assert.equal(dashboardView(legacyCohort), 'cohort')
  assert.deepEqual(dashboardViewRange(legacyCohort, 'cohort'), { start: '2026-08-01', end: '2026-08-31' })
  const firstQuestion = new URLSearchParams('view=cohort&start=2026-09-01&end=2026-09-10&cc=cc-a&group=source')
  const paymentQuestion = dashboardSwitchView(firstQuestion, 'payments')
  assert.deepEqual(dashboardViewRange(paymentQuestion, 'payments'), { start: '', end: '' }, 'a new question must not reinterpret registration dates as payment dates')
  paymentQuestion.set('start', '2026-09-11'); paymentQuestion.set('end', '2026-09-20')
  const restoredCohort = dashboardSwitchView(paymentQuestion, 'cohort')
  assert.deepEqual(dashboardViewRange(restoredCohort, 'cohort'), { start: '2026-09-01', end: '2026-09-10' })
  assert.equal(restoredCohort.get('cc'), 'cc-a')
  assert.equal(restoredCohort.get('group'), 'source')
  const restoredPayment = dashboardSwitchView(restoredCohort, 'payments')
  assert.deepEqual(dashboardViewRange(restoredPayment, 'payments'), { start: '2026-09-11', end: '2026-09-20' })
  assert.equal(dashboardView(new URLSearchParams('view=payments&mode=current')), 'payments')
  console.log('Dashboard checks passed: UTC+7 boundaries, deduplication, permissions, shared stages, dimensional totals, reason history, demo migration and recorded activity.')
} finally { rmSync(tmp, { recursive: true, force: true }) }
