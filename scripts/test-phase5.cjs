const assert = require('node:assert/strict')
const { mkdtempSync, symlinkSync, rmSync } = require('node:fs')
const { tmpdir } = require('node:os')
const { resolve, join } = require('node:path')
const { execFileSync } = require('node:child_process')
const tmp = mkdtempSync(join(tmpdir(), 'crm-phase5-tests-'))
try {
  execFileSync(resolve('node_modules/.bin/tsc'), ['src/phase5.ts', 'src/phase5Orders.ts', 'src/review5.ts', 'src/salesReporting.ts', '--outDir', tmp, '--module', 'commonjs', '--moduleResolution', 'node', '--target', 'ES2020', '--esModuleInterop', '--skipLibCheck'], { stdio: 'inherit' })
  symlinkSync(resolve('node_modules'), join(tmp, 'node_modules'), 'dir')
  const { assignLeads, canReceiveLead, withPhase5Members } = require(join(tmp, 'phase5.js'))
  const { matchesOrderFilters5, orderCreatedTime, orderTime5 } = require(join(tmp, 'phase5Orders.js'))
  const { changeSalesTimeKind5, changeSalesPresence5, defaultSalesTime5, matchesSalesTime5, outcomeAction5, outcomeAllowed5, outcomeReasonLabel5, canTransferUser5, ccFilterAccounts5, addMembership5, membershipLimit5, appointmentMatches5, followStage5, followReason5, REJECTED_REASONS5, CLOSED_REASONS5 } = require(join(tmp, 'review5.js'))
  const { matchesLocalDateRange } = require(join(tmp, 'salesReporting.js'))
  const { followHistoryStage5 } = require(join(tmp, 'salesLifecycle.js'))
  const dayjs = require('dayjs')
  const target = { id: 'cc', name: '真实销售', email: 'cc@test.invalid', roleId: 'sales', isSalesMember: true, status: '启用', businessLines: ['越南'] }
  const roles = [{ id: 'sales', dataScope: 'line', perms: { salesV3: 'operate' } }]
  assert(canReceiveLead(target, roles, '越南'))
  assert(!canReceiveLead(target, roles, '韩国'))
  assert(!canReceiveLead({ ...target, isSalesMember: false }, roles, '越南'), 'page permission alone is insufficient')
  assert(!canReceiveLead({ ...target, status: '停用' }, roles, '越南'))
  assert(!canReceiveLead(target, [{ ...roles[0], perms: { salesV3: 'view' } }], '越南'))
  const marked = withPhase5Members({ accounts: [{ ...target, isSalesMember: false, id: 'management-demo-cc-1' }, { ...target, isSalesMember: undefined, id: 'real-staff' }] })
  assert.equal(marked.accounts[0].isSalesMember, false, 'preserve explicit member choices')
  assert.equal(marked.accounts[1].isSalesMember, false, 'never guess real sales membership from page access')
  const lead = { studentId: 'one', name: 'One', phone: '12345678', businessLine: '越南', status: '未付费-未体验', salesOwner: 'old@test.invalid', salesProgress: '暂不跟进', salesLatestNote: '用户下周有时间', salesHistory: [{ note: 'old history' }], salesAppointments: [{ appointmentId: 'original' }], salesLifecycleEvents: [{ eventId: 'original' }] }
  const state = { students: [lead, { ...lead, studentId: 'same', salesOwner: target.email }, { ...lead, studentId: 'paid', status: '付费' }, { ...lead, studentId: 'foreign', businessLine: '韩国' }], accounts: [target], roles, channels: [], lessons: [], logs: [] }
  const request = { records: [...state.students, state.students[0]], target: target.email, actor: 'manager', source: '销售中心五期', scope: ['越南'], permitted: true, seeAllOwners: true, reason: '轮岗', now: '2026-09-20 09:00:00' }
  const result = assignLeads(state, request)
  assert.deepEqual(result.results.map(r => r.status), ['成功', '跳过', '失败', '失败'])
  assert.equal(result.state.students[0].salesOwner, target.email)
  assert.equal(result.state.students[0].ccName, target.name)
  assert.equal(result.state.students[0].salesProgress, '暂不跟进')
  assert.equal(result.state.students[0].salesLatestNote, lead.salesLatestNote)
  assert.deepEqual(result.state.students[0].salesAppointments, lead.salesAppointments)
  assert.deepEqual(result.state.students[0].salesLifecycleEvents, lead.salesLifecycleEvents)
  assert.equal(result.state.students[0].salesHistory.length, 2)
  assert.equal(result.state.students[0].editHistory[0].changes[0].field, 'CC')
  assert.equal(result.state.logs.length, 1)
  assert.equal(state.students[0].salesOwner, 'old@test.invalid', 'input state is immutable')
  assert.equal(assignLeads(result.state, request).results[0].status, '失败', 'stale original owner cannot overwrite transfer')
  assert.equal(assignLeads(state, { ...request, permitted: false }).state.logs.length, 0)
  assert.equal(assignLeads(state, { ...request, seeAllOwners: false }).results[0].status, '失败')
  assert.equal(assignLeads(state, { ...request, source: '用户中心五期', seeAllOwners: false }).results[0].status, '成功', 'user center permission is independent of existing reassign permission')
  const transferredUsers = assignLeads(state, { ...request, source: '用户中心五期' })
  assert.equal(transferredUsers.results[2].status, '成功', 'paid users may change their CC in User Center')
  assert.equal(transferredUsers.state.students[2].status, '付费', 'ownership transfer must not change paid status')
  assert.deepEqual(transferredUsers.state.students[2].salesAppointments, lead.salesAppointments)
  assert.deepEqual(transferredUsers.state.students[2].salesLifecycleEvents, lead.salesLifecycleEvents)
  const perms = {usersV2:'view', salesV3:'view', salesV3_config:'operate'}
  assert(canTransferUser5(key => perms[key] || 'none', target))
  for (const key of ['usersV2', 'salesV3', 'salesV3_config']) assert(!canTransferUser5(k => k === key ? 'none' : perms[k] || 'none', target), `${key} required`)
  assert(!canTransferUser5(key => perms[key] || 'none', {...target,status:'停用'}))
  assert.deepEqual(ccFilterAccounts5([target, {...target,id:'noncc',isSalesMember:false}, {...target,id:'disabled',status:'停用'}, {...target,id:'foreign',businessLines:['韩国']}], roles, line => line === '越南', ['越南']), [target])
  assert.equal(ccFilterAccounts5([target], roles, line => line === '韩国', ['韩国']).length, 0, 'hide CC filter if the scope has no CCs')
  const membershipState = {...state, students:[{...lead,expireTime:'2026-09-30 00:00:00'}]}
  const membershipRequest = {studentId:lead.studentId,days:3,actor:target.email,permitted:true,scope:['越南'],source:'users',now:'2026-09-28 00:00:00'}
  for (const source of ['users','sales']) {
    const extended = addMembership5(membershipState,{...membershipRequest,source})
    assert.equal(extended.students[0].expireTime,'2026-10-03 00:00:00')
    assert.equal(extended.students[0].editHistory[0].changes[0].before,'2026-09-30 00:00:00')
    for (const days of [0, -1, 1.5, 4, NaN]) assert.throws(() => addMembership5(membershipState,{...membershipRequest,source,days}))
  }
  assert.throws(() => addMembership5(membershipState,{...membershipRequest,permitted:false}))
  assert.throws(() => addMembership5(membershipState,{...membershipRequest,scope:['韩国']}))
  assert.throws(() => addMembership5({...membershipState,accounts:[{...target,status:'停用'}]},membershipRequest))
  assert.equal(membershipLimit5({...target,isSalesMember:false}),365, 'non-CC limit remains unchanged')
  assert.equal(addMembership5({...membershipState,students:[{...lead,expireTime:'2020-01-01 00:00:00'}]},membershipRequest).students[0].expireTime,'2026-10-01 00:00:00', 'expired memberships extend from now')
  const range = [dayjs('2026-09-28'),dayjs('2026-09-28')]
  assert(matchesLocalDateRange('2026-09-27 17:00:00',range,'越南'))
  assert(matchesLocalDateRange('2026-09-28 16:59:59',range,'越南'))
  assert(!matchesLocalDateRange('2026-09-27 16:59:59',range,'越南'))
  assert(!matchesLocalDateRange('2026-09-28 17:00:00',range,'越南'))
  const booking = {appointmentId:'booking',appointmentStatus:'已预约',scheduledStartAt:'2026-09-30 23:59:59',timezone:'Asia/Ho_Chi_Minh',attendanceStatus:'待标记',consultationStatus:'待标记'}
  const booked = {...lead,salesProgress:'跟进中',salesAppointments:[booking]}
  assert(appointmentMatches5(booked,'booked','2026-09-30','2026-09-30'))
  assert(!appointmentMatches5(booked,'booked','2026-10-01','2026-10-02'))
  assert(!appointmentMatches5({...booked,salesAppointments:[{...booking,appointmentStatus:'已取消'}]},'booked'))
  assert(appointmentMatches5({...booked,salesAppointments:[{...booking,appointmentStatus:'已取消'}]},'none'))
  assert(!appointmentMatches5({...booked,salesAppointments:[]},undefined,'2026-09-30','2026-10-01'))
  assert.equal(followStage5({...booked,salesOutcome5:{stage:'rejected',reason:'号码错误'}}),'Rejected')
  assert.equal(followStage5({...booked,salesLifecycleStatus:'已关闭',salesOutcome5:{stage:'closed',reason:'费用高'}}),'Closed')
  assert.equal(followStage5(booked),'已预约', 'trial facts are not required for existing appointment flow')
  assert.equal(followReason5({...booked,salesOutcome5:{stage:'closed',reason:'费用高'}}),'费用高')
  const closedEvent = {result:'已关闭',reportedAt:'2026-09-28 10:55:17',reportedBy:'manager'}
  const closedLog = {progress:'跟进中',note:'【销售咨询】已关闭：课程不适合孩子',time:closedEvent.reportedAt,owner:'manager'}
  assert.equal(followHistoryStage5(closedLog,[closedEvent]),'Closed', 'recover existing closed logs without rewriting their stored history')
  assert.equal(followHistoryStage5({...closedLog,note:'补充备注\n【销售咨询】已拒绝：无需求'},[{...closedEvent,result:'已拒绝'}]),'Rejected')
  assert.equal(followHistoryStage5({...closedLog,note:'【销售咨询】新建预约'},[closedEvent]),undefined, 'do not relabel earlier appointment or unrelated records')
  assert.equal(followHistoryStage5({...closedLog,time:'2026-09-01 00:00:00'},[closedEvent]),undefined)
  assert.equal(followHistoryStage5({...closedLog,owner:'someone-else'},[closedEvent]),undefined)
  assert.equal(followHistoryStage5({...closedLog,stage5:'已预约'},[closedEvent]),'已预约', 'reactivation uses its saved stage, never a later closure')
  for (const stage of ['Rejected','Closed','已预约','咨询完成待支付']) {
    assert.equal(followHistoryStage5({...closedLog,stage5:stage}),stage, 'new logs retain a stage snapshot without requiring event lookup')
  }
  const timeQuery = defaultSalesTime5()
  const noBooking = {...booked,salesAppointments:[],salesUpdatedAt:undefined}
  assert(matchesSalesTime5(noBooking,timeQuery), 'empty default range must not filter users without a follow-up')
  const appointmentQuery = {...timeQuery,kind:'appointment'}
  assert(matchesSalesTime5(booked,appointmentQuery))
  assert(!matchesSalesTime5(noBooking,appointmentQuery), 'appointment type requires a sales booking even without dates')
  assert(!matchesSalesTime5({...booked,salesAppointments:[{...booking,appointmentStatus:'已取消'}]},appointmentQuery))
  assert(matchesSalesTime5(noBooking,{...timeQuery,appointmentPresence:'no'}))
  assert(!matchesSalesTime5(booked,{...timeQuery,appointmentPresence:'no'}))
  const dayRange = [dayjs('2026-09-30'),dayjs('2026-09-30')]
  assert(matchesSalesTime5(booked,{...appointmentQuery,range:dayRange}), 'appointment dates use the stored local date')
  assert(!matchesSalesTime5(booked,{...appointmentQuery,range:range}))
  const timed = {...noBooking,registerTime:'2026-09-29 17:00:00',salesUpdatedAt:'2026-09-28 00:00:00',landingCallbackAt:'2026-09-30 16:59:59'}
  assert(matchesSalesTime5(timed,{...timeQuery,kind:'register',range:dayRange}))
  assert(!matchesSalesTime5(timed,{...timeQuery,range:dayRange}), 'follow-up dates are independent from registration dates')
  const callbackQuery = {...timeQuery,kind:'callback'}
  assert(!matchesSalesTime5(noBooking,callbackQuery), 'callback type requires a provided valid callback')
  assert(!matchesSalesTime5({...timed,landingCallbackAt:'invalid'},callbackQuery))
  assert(matchesSalesTime5(timed,{...callbackQuery,range:dayRange}), 'callback date uses the user timezone')
  assert(!matchesSalesTime5({...timed,landingCallbackAt:'2026-09-30 17:00:00'},{...callbackQuery,range:dayRange}))
  assert(matchesSalesTime5(timed,{...callbackQuery,appointmentPresence:'no'}), 'no sales booking can combine with a scheduled callback')
  const presenceCases = [noBooking, {...noBooking,salesAppointments:[booking]}, timed, {...timed,salesAppointments:[booking]}]
  for (const appointmentPresence of ['all','yes','no']) for (const callbackPresence of ['all','yes','no']) {
    const actual = presenceCases.map(student => matchesSalesTime5(student,{...timeQuery,appointmentPresence,callbackPresence}))
    const expected = [[false,false],[true,false],[false,true],[true,true]].map(([a,c]) => (appointmentPresence === 'all' || a === (appointmentPresence === 'yes')) && (callbackPresence === 'all' || c === (callbackPresence === 'yes')))
    assert.deepEqual(actual,expected,`${appointmentPresence}/${callbackPresence} independent presence filters`)
  }
  for (const [kind,field] of [['appointment','appointmentPresence'],['callback','callbackPresence']]) {
    const chosen = changeSalesTimeKind5({...timeQuery,range:dayRange},kind)
    assert.equal(chosen[field],'yes', 'time type visibly sets the matching presence filter')
    assert.equal(chosen.range,null)
    for (const value of ['all','no']) {
      const changed = changeSalesPresence5({...chosen,range:dayRange},field,value)
      assert.equal(changed.kind,'follow', 'removing the positive condition removes its dependent time filter')
      assert.equal(changed.range,null)
    }
    const negative = changeSalesPresence5(timeQuery,field,'no')
    assert.equal(changeSalesTimeKind5(negative,kind),negative,'negative presence blocks the corresponding time type')
  }
  const beforeBooking = {...booked,salesAppointments:[],salesLifecycleEvents:[]}
  assert.equal(outcomeAction5(beforeBooking),'reject')
  assert(outcomeAllowed5(beforeBooking,'reject','家长拒绝接听电话'))
  assert(!outcomeAllowed5(beforeBooking,'close','费用高'), 'cannot close before a booking')
  assert(!outcomeAllowed5(beforeBooking,'reject','费用高'), 'closure reasons are not rejection reasons')
  for (const appointment of [booking, {...booking,appointmentStatus:'已取消'}, {...booking,appointmentStatus:'已改期'}, {...booking,attendanceStatus:'No Show'}, {...booking,attendanceStatus:'已出勤',consultationStatus:'已完成'}]) {
    const student = {...booked,salesAppointments:[appointment]}
    assert.equal(outcomeAction5(student),'close')
    assert(outcomeAllowed5(student,'close','费用高'))
    assert(!outcomeAllowed5(student,'reject','号码错误'), 'booked leads can only close, including cancelled/no-show bookings')
    assert(!outcomeAllowed5(student,'close','家长拒绝接听电话'), 'rejection reasons cannot close a lead')
  }
  assert.equal(outcomeAction5({...beforeBooking,salesLifecycleEvents:[{node:'appointment',result:'已预约'}]}),'close', 'historical booking event is sufficient')
  assert.equal(outcomeAction5({...beforeBooking,landingCallbackAt:'2026-09-30 10:00:00'}),'reject', 'landing callback is not a sales appointment')
  assert.equal(outcomeReasonLabel5('其他：用户补充', key => key === 'sales.outcome.reason.其他' ? 'Others' : key),'Others：用户补充')
  assert.equal(REJECTED_REASONS5.length,6)
  assert.equal(CLOSED_REASONS5.length,11)
  assert.equal(assignLeads({ ...state, accounts: [{ ...target, status: '停用' }] }, request).results[0].status, '失败')
  const pool = { ...lead, studentId: 'pool', salesOwner: undefined, salesProgress: '待领取' }
  const allocated = assignLeads({ ...state, students: [pool] }, { ...request, records: [pool] })
  assert.equal(allocated.state.students[0].salesProgress, '跟进中')
  const order = { orderId: 'o', currency: 'VND', paidAmount: 100, productName: 'A', paidTime: '2026-09-19 16:00:00', transactions: [{ time: '2026-09-02 01:00:00' }, { time: '2026-09-01 01:00:00' }] }
  assert.equal(orderCreatedTime(order), '2026-09-01 01:00:00')
  assert.equal(orderTime5(order.paidTime), '2026-09-20 00:00')
  const filters = { dateField: 'paidTime', from: '2026-09-20', to: '2026-09-20' }
  assert(matchesOrderFilters5(order, filters))
  assert(!matchesOrderFilters5({ ...order, paidTime: '2026-09-19 15:59:59' }, filters))
  assert(matchesOrderFilters5({ ...order, paidTime: '2026-09-20 15:59:59' }, filters))
  assert(!matchesOrderFilters5({ ...order, paidTime: '2026-09-20 16:00:00' }, filters))
  assert(!matchesOrderFilters5({ ...order, paidTime: undefined }, filters))
  assert(matchesOrderFilters5(order, { dateField: 'createdTime', from: '2026-09-01', to: '2026-09-01' }))
  assert(!matchesOrderFilters5(order, { dateField: 'paidTime', currency: 'USD' }))
  assert(!matchesOrderFilters5(order, { dateField: 'paidTime', cc: 'other' }, target.email))
  assert(matchesOrderFilters5(order, { dateField: 'paidTime', cc: '__unassigned__' }))
  console.log('Phase 5 checks passed: explicit sales membership, transfer authorization/scope/concurrency/history, batch outcomes, order timezone/currency/CC filters.')
} finally { rmSync(tmp, { recursive: true, force: true }) }
