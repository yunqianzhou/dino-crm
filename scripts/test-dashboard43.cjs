const assert = require('node:assert/strict')
const { mkdtempSync, symlinkSync, rmSync } = require('node:fs')
const { tmpdir } = require('node:os')
const { resolve, join } = require('node:path')
const { execFileSync } = require('node:child_process')
const tmp = mkdtempSync(join(tmpdir(), 'crm-dashboard43-tests-'))
try {
 execFileSync(resolve('node_modules/.bin/tsc'), ['src/dashboard43.ts', 'src/dashboardView.ts', 'src/managementDemo.ts', '--outDir',tmp,'--module','commonjs','--moduleResolution','node','--target','ES2020','--esModuleInterop','--skipLibCheck'],{stdio:'inherit'})
 symlinkSync(resolve('node_modules'),join(tmp,'node_modules'),'dir')
 const {cohortFunnel,followupMetrics,reasonEvidence,scheduledAppointments,l2s,scheduledInstant,followupComparisonRows,appointmentFollowupRows,followupAppointmentDate,outcomeReasonGroups,CURRENT_CALL_KEYS,CURRENT_FOLLOW_KEYS} = require(join(tmp,'dashboard43.js'))
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
 const paused=user('paused-current',{salesOwner:'cc-a',salesProgress:'暂不跟进'})
 const pauseUsers=[paused,paused,user('paused-unassigned',{salesProgress:'暂不跟进'}),
  user('pause-resumed',{salesProgress:'跟进中',salesLifecycleEvents:[event('old-pause','lead','暂不跟进')]}),
  user('pause-rejected',{salesProgress:'暂不跟进',salesOutcome5:{stage:'rejected'}}),
  user('pause-closed',{salesProgress:'暂不跟进',salesLifecycleStatus:'已关闭'}),
  user('pause-test',{userType:'测试用户',salesProgress:'暂不跟进'}),
  user('pause-paid',{status:'付费',salesProgress:'暂不跟进'}),
  user('pause-order',{salesProgress:'暂不跟进'})]
 const pauseOrders=[{orderId:'pause-paid-order',studentId:'pause-order',orderStatus:'已支付',paidAmount:100,paidTime:'2026-09-06T00:00:00Z'}]
 const pauseMetrics=followupMetrics(pauseUsers,[],[],pauseOrders,reasonFilters).current
 assert.deepEqual(pauseMetrics['暂不跟进'].map(s=>s.studentId),['paused-current','paused-unassigned'],'paused counts only current eligible leads, deduplicated, respecting terminal-stage precedence')
 assert.deepEqual(followupMetrics(pauseUsers,[],[],pauseOrders,filters).current,pauseMetrics,'paused inventory ignores activity dates')
 assert.deepEqual(followupMetrics(pauseUsers,[],[],pauseOrders,{...filters,owner:['cc-a']}).current['暂不跟进'],[paused],'paused inventory obeys current CC filtering')
 assert.equal(pauseMetrics.total.length,pauseMetrics.assigned.length+pauseMetrics.unassigned.length,'paused is a subset, not an extra lead total')
 assert.deepEqual(followupMetrics([],[],[],[],filters).current['暂不跟进'],[],'empty inventory includes a zero paused count')
 const appointmentA=user('appointment-a',{salesOwner:'cc-a',salesAppointments:[booking('new',{scheduledStartAt:'2026-09-04T18:00:00Z'}),booking('old',{appointmentStatus:'已改期'})]})
 const appointmentB=user('appointment-b',{salesOwner:'cc-b',salesAppointments:[booking('b',{scheduledStartAt:'2026-09-05 14:00:00'})]})
 const appointmentMissing=user('appointment-missing',{salesAppointments:[booking('missing',{scheduledStartAt:''})]})
 const cancelledOnly=user('cancelled-only',{salesAppointments:[booking('cancelled',{appointmentStatus:'已取消'})]})
 assert.equal(followupAppointmentDate(appointmentA),'2026-09-05','scheduled start crosses the UTC+7 day, not booking creation or payment date')
 assert.equal(followupAppointmentDate(appointmentMissing),'__unknown_date__')
 assert.equal(followupAppointmentDate(cancelledOnly),'__unbooked__','cancelled appointments do not provide a current appointment date')
 const appointmentCurrent={'已预约':[appointmentA,appointmentB,appointmentMissing],'已接通待预约':[cancelledOnly]}
 const appointmentActivity={paid:[appointmentA,appointmentA,appointmentB]}
 for(const primary of ['date','cc'])for(const secondary of [false,true]){
  const groups=appointmentFollowupRows(appointmentCurrent,appointmentActivity,primary,secondary)
  assert.equal(groups.reduce((n,r)=>n+r.metrics['已预约'].length,0),3,'appointment grouping includes every current user exactly once')
  assert.equal(groups.reduce((n,r)=>n+r.metrics.paid.length,0),2,'payments are grouped by users without duplicating paid users')
  for(const row of groups){assert.equal(row.activityDate,undefined,'appointment rows must not apply the daily-payment filter or hide current statuses');if(secondary)for(const key of [...CURRENT_FOLLOW_KEYS,'paid'])assert.equal(row.children.reduce((n,c)=>n+c.metrics[key].length,0),row.metrics[key].length);else assert.equal(row.children,undefined)}
 }
 const appointmentDates=appointmentFollowupRows(appointmentCurrent,appointmentActivity,'date')
 assert.deepEqual(appointmentDates.find(r=>r.value==='2026-09-05').metrics.paid.map(s=>s.studentId),['appointment-a','appointment-b'])
 assert.equal(appointmentDates.find(r=>r.value==='__unbooked__').metrics['已接通待预约'].length,1,'unbooked leads remain visible')
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
 const hierarchyCurrent={'待外呼':[currentOnly,mixed]}
 const hierarchyActivity={called:[activityOnly,mixed]}
 const hierarchyDaily=[{date:'2026-09-03',metrics:{called:[activityOnly,mixed]}},{date:'2026-09-02',metrics:{called:[mixed]}},{date:'2026-09-01',metrics:{paid:[activityOnly]}}]
 const dateFirst=followupComparisonRows(hierarchyCurrent,hierarchyActivity,hierarchyDaily,'date',['待外呼'],['called'])
 assert.deepEqual(dateFirst.map(row=>row.value),['2026-09-03','2026-09-02'],'date-first excludes days with no relevant activity')
 assert.equal(dateFirst[0].metrics.called.length,2)
 assert.equal(dateFirst[0].children.length,2,'each date expands into current CCs')
 assert.equal(dateFirst[1].children[0].value,'cc-mixed')
 assert(dateFirst.every(row=>row.activityDate===row.value&&!Object.hasOwn(row.metrics,'待外呼')),'date parents never invent historical current states')
 assert(dateFirst.flatMap(row=>row.children).every(row=>row.activityDate&&!Object.hasOwn(row.metrics,'待外呼')),'CC children retain their parent date for drilldown and payment amounts')
 for (const group of ['cc','date']) {
  const flat=followupComparisonRows(hierarchyCurrent,hierarchyActivity,hierarchyDaily,group,['待外呼'],['called'],false)
  assert(flat.every(row=>!row.children),'no subgroup removes expansion')
 }
 const ccOnly=followupComparisonRows(hierarchyCurrent,hierarchyActivity,hierarchyDaily,'cc',['待外呼'],['called'],false)
 assert.equal(ccOnly.find(row=>row.value==='cc-current').metrics['待外呼'].length,1,'CC grouping preserves current-only owners')
 const datePaid=followupComparisonRows({}, {paid:[mixed]}, [{date:'2026-09-03',metrics:{paid:[mixed]}}], 'date', ['已关闭'], ['paid'])
 assert.equal(datePaid[0].children[0].activityDate,'2026-09-03','payment date remains attached when grouping date then CC')
 assert.equal(datePaid[0].children[0].metrics.paid[0].studentId,'mixed')
 const migrated=withManagementDemo({students:[],accounts:[],orders:[],callRecords:[],lessons:[]},'2026-09-16T08:00:00Z')
 const outcomeDemo=migrated.students.filter(s=>s.studentId.startsWith('management-v5-'))
 assert.equal(outcomeDemo.length,24,'add 12 rejected and 12 closed synthetic users')
 const demoMetrics=followupMetrics(outcomeDemo,migrated.callRecords,[],[],reasonFilters).current
 assert.equal(demoMetrics['已拒绝'].length,12)
 assert.equal(demoMetrics['已关闭'].length,12)
 for (const stage of ['已拒绝','已关闭']) {
  assert.equal(outcomeReasonGroups(demoMetrics[stage]).length,6,'six distinct reasons per outcome for distribution demos')
  assert.equal(outcomeReasonGroups(demoMetrics[stage]).reduce((n,row)=>n+row.users.length,0),12)
 }
 assert(outcomeDemo.every(s=>s.account.endsWith('@example.invalid')&&s.salesOwner&&s.salesLatestNote.includes('演示')))
 assert(demoMetrics['已拒绝'].every(s=>s.salesAppointments.length===0),'rejection stays before booking')
 assert(demoMetrics['已关闭'].every(s=>s.salesAppointments.length===1&&s.salesAppointments[0].consultationStatus==='已完成'),'closure demos include completed consultation evidence')
 assert(outcomeDemo.every(s=>s.salesLifecycleEvents[0].reason===s.salesOutcome5.reason),'latest event and current reason agree')
 assert(outcomeDemo.every(s=>s.salesLifecycleEvents.every(e=>e.reportedAt>=s.registerTime&&e.reportedAt<'2026-09-16 08:00:00')),'demo history follows registration and is not in the future')
 const afterOutcomeDelete={...migrated,students:migrated.students.filter(s=>s.studentId!==outcomeDemo[0].studentId)}
 assert.equal(withManagementDemo(afterOutcomeDelete),afterOutcomeDelete,'do not recreate deleted outcome fixtures')
 const legacyState={...migrated,students:migrated.students.filter(s=>!s.studentId.startsWith('management-v5-')),callRecords:migrated.callRecords.filter(c=>!c.id.startsWith('management-v5-')),demoDatasets:migrated.demoDatasets.filter(d=>d!=='management-vietnam-outcomes-v5-v1')}
 const upgraded=withManagementDemo(legacyState,'2026-09-16T08:00:00Z')
 assert.equal(upgraded.students.length,legacyState.students.length+24,'existing saved sessions receive the new demo once')
 assert(legacyState.students.every((s,i)=>upgraded.students[i]===s),'existing users and edits are preserved')
 assert(migrated.lessons.some(l=>l.lessonType==='体验课'&&l.status==='已完课'))
 assert.equal(withManagementDemo(migrated),migrated,'one-time migration preserves edits')
 const deleted={...migrated,lessons:[]}
 assert.equal(withManagementDemo(deleted),deleted,'deleted demo records stay deleted')
 console.log('Dashboard 4.3 checks passed: six independent cohort facts, time scopes, CC union, reasons, reopen history, schedule timezones/statuses, legacy URLs and additive fixtures.')
} finally { rmSync(tmp,{recursive:true,force:true}) }
