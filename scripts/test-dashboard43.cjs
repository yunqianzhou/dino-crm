const assert = require('node:assert/strict')
const { mkdtempSync, symlinkSync, rmSync } = require('node:fs')
const { tmpdir } = require('node:os')
const { resolve, join } = require('node:path')
const { execFileSync } = require('node:child_process')
const tmp = mkdtempSync(join(tmpdir(), 'crm-dashboard43-tests-'))
try {
 execFileSync(resolve('node_modules/.bin/tsc'), ['src/dashboard43.ts', 'src/dashboardView.ts', 'src/managementDemo.ts', '--outDir',tmp,'--module','commonjs','--moduleResolution','node','--target','ES2020','--esModuleInterop','--skipLibCheck'],{stdio:'inherit'})
 symlinkSync(resolve('node_modules'),join(tmp,'node_modules'),'dir')
 const {cohortFunnel,followupMetrics,reasonEvidence,scheduledAppointments,l2s,scheduledInstant,followupComparisonRows,outcomeReasonGroups,CURRENT_CALL_KEYS,CURRENT_FOLLOW_KEYS} = require(join(tmp,'dashboard43.js'))
 const {dashboardView,dashboardViewRange,dashboardSwitchView} = require(join(tmp,'dashboardView.js'))
 const {withManagementDemo} = require(join(tmp,'managementDemo.js'))
 const filters={mode:'current',start:'2026-09-01',end:'2026-09-01',owner:[],userType:'正式用户'}
 const user=(id,extra={})=>({studentId:id,name:id,phone:'+84000000',account:id,userType:'正式用户',businessLine:'越南',status:'未付费-未体验',registerTime:'2026-09-01T00:00:00Z',...extra})
 const event=(id,node,result,extra={})=>({eventId:id,node,result,reportedAt:'2026-09-03T00:00:00Z',occurredAt:'2026-09-02T00:00:00Z',...extra})
 const booking=(id,extra={})=>({appointmentId:id,createdAt:'2026-09-02T00:00:00Z',scheduledStartAt:'2026-09-03 10:00:00',timezone:'Asia/Ho_Chi_Minh',appointmentStatus:'已预约',attendanceStatus:'待标记',consultationStatus:'待标记',createdBy:'cc-a',...extra})
 const a=user('a',{salesOwner:'cc-a',salesAppointments:[booking('ap-a',{attendanceStatus:'已出勤'})],salesLifecycleEvents:[event('attend','attendance','已出勤',{appointmentId:'ap-a'})]})
 const b=user('b',{salesOwner:'cc-b'})
 const pre=user('pre')
 const paid=user('paid',{status:'付费'})
 const other=user('other',{registerTime:'2026-09-02T00:00:00Z'})
 const users=[a,b,pre,paid,other,user('test',{userType:'测试用户'}),a]
 const calls=[{studentId:'a',result:'已接通',time:'2026-09-02T00:00:00Z'},{studentId:'a',result:'已接通',time:'2026-09-02T01:00:00Z'},{studentId:'b',result:'无人接听',time:'2026-09-03T00:00:00Z'},{studentId:'pre',result:'已接通',time:'2026-08-31T00:00:00Z'}]
 const lessons=[{id:'trial-b',studentId:'b',lessonType:'体验课',status:'已完课',completedAt:'2026-09-04T00:00:00Z'},{id:'trial-b2',studentId:'b',lessonType:'体验课',status:'已完课',completedAt:'2026-09-05T00:00:00Z'},{id:'formal-a',studentId:'a',lessonType:'正式课',status:'已完课',completedAt:'2026-09-04T00:00:00Z'},{id:'old',studentId:'pre',lessonType:'体验课',status:'已完课',completedAt:'2026-08-31T00:00:00Z'},{id:'future',studentId:'paid',lessonType:'体验课',status:'已完课',completedAt:'2030-09-01T00:00:00Z'}]
 const orders=[{orderId:'o',studentId:'paid',orderStatus:'已支付',paidAmount:100,currency:'VND',paidTime:'2026-09-06T00:00:00Z'}]
 const funnel=cohortFunnel(users,calls,lessons,orders,filters,'2026-09-21T00:00:00Z')
 assert.deepEqual(Object.fromEntries(Object.entries(funnel).map(([k,v])=>[k,v.length])),{leads:4,called:2,connected:1,booked:1,trialCompleted:1,paid:1})
 assert.equal(l2s(funnel),25)
 assert.deepEqual(funnel.trialCompleted.map(s=>s.studentId),['b'],'actual trial completion does not come from attendance or formal lessons')
 assert.equal(cohortFunnel(users,calls,lessons,orders,{...filters,owner:['cc-a','cc-b']}).leads.length,2)
 assert.equal(l2s(cohortFunnel([],[],[],[],filters)),null)
 const first=followupMetrics(users,calls,lessons,orders,{...filters,start:'2026-09-02',end:'2026-09-02'})
 const second=followupMetrics(users,calls,lessons,orders,{...filters,start:'2026-09-03',end:'2026-09-03'})
 assert.deepEqual(first.current,second.current,'activity dates cannot change current workload')
 assert.equal(first.current['已预约'].length,1,'dashboard uses the existing Sales Center stage without inventing an attended/pending stage')
 assert.equal(first.activity.booked.length,1)
 assert.equal(first.activity.attended.length,0)
 assert.equal(second.activity.attended.length,1)
 assert.equal(second.activity.booked.length,0,'booking created date differs from attendance recorded date')
 assert.equal(second.activity.completed.length,0,'attendance does not imply consultation completion')
 const closed=user('closed',{salesLifecycleStatus:'已关闭',salesLifecycleEvents:[event('c','lead','已关闭',{reason:'明确拒绝'})]})
 const rejected=user('reject',{salesLifecycleStatus:'已关闭',salesLifecycleEvents:[event('r','lead','已关闭',{closureType:'phone',reason:'暂无需求'})]})
 const consultationClosed=user('after',{salesLifecycleStatus:'已关闭',salesLifecycleEvents:[event('cc','lead','已关闭',{closureType:'consultation',reason:'费用高'})]})
 const reasonFilters={...filters,start:'',end:''}
 // Current outcomes share Sales Center v5 state precedence; historical events
 // alone must not retain a reactivated lead in a terminal status.
 const rejected5=user('rejected5',{salesOwner:'cc-a',salesOutcome5:{stage:'rejected',reason:'无需求'}})
 const closed5=user('closed5',{salesOwner:'cc-b',salesLifecycleStatus:'已关闭',salesOutcome5:{stage:'closed',reason:'费用高'}})
 const restarted5=user('restarted5',{salesOwner:'cc-a',salesLifecycleEvents:[event('old-rejection','lead','已拒绝')]})
 const conflicting5=user('conflicting5',{salesLifecycleStatus:'已关闭',salesOutcome5:{stage:'rejected',reason:'无需求'}})
 const outcomeUsers=[rejected5,rejected5,closed5,restarted5,conflicting5,
  user('test-rejected',{userType:'测试用户',salesOutcome5:{stage:'rejected'}}),
  user('paid-rejected',{status:'付费',salesOutcome5:{stage:'rejected'}}),
  user('order-rejected',{salesOutcome5:{stage:'rejected'}})]
 const outcomeOrders=[{orderId:'paid-outcome',studentId:'order-rejected',orderStatus:'已支付',paidAmount:100,paidTime:'2026-09-06T00:00:00Z'}]
 const outcomes=followupMetrics(outcomeUsers,[],[],outcomeOrders,reasonFilters)
 assert.deepEqual(outcomes.current['已拒绝'].map(s=>s.studentId),['rejected5'],'deduplicate and exclude test / paid users')
 assert.deepEqual(outcomes.current['已关闭'].map(s=>s.studentId),['closed5','conflicting5'],'Closed takes precedence exactly as in Sales Center v5')
 assert.deepEqual(outcomes.current['待外呼'].map(s=>s.studentId),['restarted5'],'rejection is not also counted as a pending call')
 assert.deepEqual(followupMetrics(outcomeUsers,[],[],outcomeOrders,filters).current,outcomes.current,'outcomes ignore activity date filters')
 const ownerOutcomes=followupMetrics(outcomeUsers,[],[],outcomeOrders,{...reasonFilters,owner:['cc-a']}).current
 assert.equal(ownerOutcomes['已拒绝'].length,1)
 assert.equal(ownerOutcomes['已关闭'].length,0,'outcomes obey current CC filters')
 const outcomeGroups=followupComparisonRows(outcomes.current,outcomes.activity,[],'cc',['已拒绝','已关闭'],['paid'])
 assert.equal(outcomeGroups.find(r=>r.value==='cc-a').metrics['已拒绝'].length,1)
 assert.equal(outcomeGroups.find(r=>r.value==='cc-b').metrics['已关闭'].length,1)
 assert.equal(followupMetrics([],[],[],[],reasonFilters).current['已拒绝'].length,0)
 assert(CURRENT_CALL_KEYS.includes('已拒绝') && !CURRENT_FOLLOW_KEYS.includes('已拒绝'),'rejection belongs to the calling module only')
 assert(CURRENT_FOLLOW_KEYS.includes('已关闭') && !CURRENT_CALL_KEYS.includes('已关闭'),'closure belongs to the follow-up module only')
 const reasonUsers=[
  closed5,
  user('closed-other-1',{salesLifecycleStatus:'已关闭',salesOutcome5:{stage:'closed',reason:'其他：搬家'}}),
  user('closed-other-2',{salesLifecycleStatus:'已关闭',salesOutcome5:{stage:'closed',reason:'其他：没时间'}}),
  user('closed-missing',{salesLifecycleStatus:'已关闭'}),
  user('closed-legacy',{salesLifecycleStatus:'已关闭',salesLifecycleEvents:[event('latest','lead','已关闭',{reason:'费用高'}),event('old','lead','已关闭',{reason:'设备问题'})]}),
  user('closed-current',{salesLifecycleStatus:'已关闭',salesOutcome5:{stage:'closed',reason:'费用高'},salesLifecycleEvents:[event('old','lead','已关闭',{reason:'设备问题'})]}),
 ]
 const reasonGroups=outcomeReasonGroups([...reasonUsers,closed5])
 assert.equal(reasonGroups.reduce((n,g)=>n+g.users.length,0),reasonUsers.length,'each user has one reason, duplicates cannot inflate counts')
 assert.equal(reasonGroups.find(g=>g.reason==='费用高').users.length,3,'use current outcome first, with Sales Center legacy fallback')
 assert.equal(reasonGroups.find(g=>g.reason==='其他').users.length,2,'different Other notes share one distribution category')
 assert.equal(reasonGroups.find(g=>g.reason==='__unknown__').users.length,1,'missing reason stays in the denominator')
 assert.equal(reasonGroups.find(g=>g.reason==='费用高').share,50)
 assert(Math.abs(reasonGroups.reduce((n,g)=>n+g.share,0)-100)<1e-9)
 assert.deepEqual(outcomeReasonGroups([]),[],'empty distribution has no invalid percentage')
 assert.deepEqual(outcomeReasonGroups(ownerOutcomes['已拒绝']).map(g=>g.reason),['无需求'],'reason distribution uses the exact CC-filtered status population')
 assert.equal(reasonEvidence([closed,rejected,consultationClosed],[],[],[],reasonFilters,'closedUnknown',false).length,1)
 assert.equal(reasonEvidence([closed,rejected,consultationClosed],[],[],[],reasonFilters,'rejected',true).length,1)
 assert.equal(reasonEvidence([closed,rejected,consultationClosed],[],[],[],reasonFilters,'closedAfter',false).length,1)
 const reopened=user('reopened',{salesLifecycleEvents:[event('old','lead','已关闭',{closureType:'phone'})]})
 assert.equal(reasonEvidence([reopened],[],[],[],reasonFilters,'rejected',true).length,0)
 assert.equal(reasonEvidence([reopened],[],[],[],reasonFilters,'rejected',false).length,1,'historical event survives reopen')
 const oldAppointment=user('new-appointment',{salesAppointments:[booking('new',{attendanceStatus:'No Show'})],salesLifecycleEvents:[event('old-reason','attendance','No Show',{appointmentId:'old',reason:'旧原因'})]})
 assert.equal(reasonEvidence([oldAppointment],[],[],[],reasonFilters,'noShow',true)[0].reason,'__unknown__','do not reuse another appointment’s reason')
 const scheduleUser=user('schedule',{salesAppointments:[booking('attend',{attendanceStatus:'已出勤'}),booking('no',{attendanceStatus:'No Show'}),booking('past'),booking('future',{scheduledStartAt:'2026-09-03 23:00:00'}),booking('cancel',{appointmentStatus:'已取消'}),booking('reschedule',{appointmentStatus:'已改期'}),booking('invalid',{scheduledStartAt:'bad'}),booking('utc',{scheduledStartAt:'2026-09-02T17:00:00Z'})]})
 const scheduled=scheduledAppointments([scheduleUser,scheduleUser],reasonFilters,'2026-09-03','2026-09-03','2026-09-03T12:00:00Z')
 assert.equal(scheduled.length,7)
 assert.deepEqual(scheduled.map(r=>r.bucket),['attended','noShow','unconfirmed','future','cancelled','rescheduled','unconfirmed'])
 assert.equal(scheduledInstant(booking('vietnam')).toISOString(),'2026-09-03T03:00:00.000Z','local scheduled time must not receive a second UTC+7 shift')
 assert.equal(scheduled.filter(r=>!['cancelled','rescheduled'].includes(r.bucket)).length,5)
 assert.equal(dashboardView(new URLSearchParams('view=current&start=2026-09-01')), 'followup')
 assert.deepEqual(dashboardViewRange(new URLSearchParams('view=current&start=2026-09-01'), 'followup'),{start:'',end:''},'legacy registration date is not reinterpreted as activity date')
 assert.deepEqual(dashboardViewRange(new URLSearchParams('view=period&start=2026-09-01&end=2026-09-02'),'followup'),{start:'2026-09-01',end:'2026-09-02'})
 const switched=dashboardSwitchView(new URLSearchParams('view=cohort&cc=cc-a&cc=cc-b&start=2026-09-01&end=2026-09-02'),'followup')
 assert.deepEqual(switched.getAll('cc'),['cc-a','cc-b'])
 assert.equal(switched.get('start'),'')
 assert.equal(dashboardSwitchView(switched,'cohort').get('start'),'2026-09-01')
 // A single comparison table must preserve current-only and activity-only CCs.
 const currentOnly=user('waiting',{salesOwner:'cc-current'})
 const activityOnly=user('active',{salesOwner:'cc-activity'})
 const mixed=user('mixed',{salesOwner:'cc-mixed'})
 const comparison=followupComparisonRows(
  {'待外呼':[currentOnly,mixed]},
  {called:[activityOnly,mixed]},
  [{date:'2026-09-03',metrics:{called:[activityOnly,mixed]}},{date:'2026-09-02',metrics:{called:[mixed]}}],
  'cc',['待外呼'],['called'])
 assert.equal(comparison.length,3,'union of current and period CCs is kept')
 const waitingRow=comparison.find(row=>row.value==='cc-current')
 assert.equal(waitingRow.metrics['待外呼'].length,1)
 assert.equal(waitingRow.metrics.called.length,0)
 assert.equal(waitingRow.children,undefined,'no invented activity for a current-only CC')
 const activeRow=comparison.find(row=>row.value==='cc-activity')
 assert.equal(activeRow.metrics['待外呼'].length,0)
 assert.equal(activeRow.metrics.called.length,1)
 const mixedRow=comparison.find(row=>row.value==='cc-mixed')
 assert.equal(mixedRow.metrics.called.length,1,'parent count is a distinct-user count across dates')
 assert.equal(mixedRow.children.length,2)
 assert.deepEqual(mixedRow.children.map(row=>row.activityDate),['2026-09-03','2026-09-02'])
 assert(mixedRow.children.every(row=>!Object.hasOwn(row.metrics,'待外呼')),'daily rows never repeat a current snapshot as historical data')
 assert.equal(followupComparisonRows({'待外呼':[currentOnly,mixed]},{called:[activityOnly,mixed]},[],'age',['待外呼'],['called']).length,1,'alternate dimensions apply to both metric groups together')
 const migrated=withManagementDemo({students:[],accounts:[],orders:[],callRecords:[],lessons:[]},'2026-09-16T08:00:00Z')
 assert(migrated.lessons.some(l=>l.lessonType==='体验课'&&l.status==='已完课'))
 assert.equal(withManagementDemo(migrated),migrated,'one-time migration preserves edits')
 const deleted={...migrated,lessons:[]}
 assert.equal(withManagementDemo(deleted),deleted,'deleted demo records stay deleted')
 console.log('Dashboard 4.3 checks passed: six independent cohort facts, time scopes, CC union, reasons, reopen history, schedule timezones/statuses, legacy URLs and additive fixtures.')
} finally { rmSync(tmp,{recursive:true,force:true}) }
