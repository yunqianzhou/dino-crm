const assert=require('node:assert/strict')
const {mkdtempSync,symlinkSync,rmSync}=require('node:fs')
const {tmpdir}=require('node:os')
const {resolve,join}=require('node:path')
const {execFileSync}=require('node:child_process')
const tmp=mkdtempSync(join(tmpdir(),'crm-current-dates-'))
try {
 execFileSync(resolve('node_modules/.bin/tsc'),['src/dashboard43.ts','src/dashboardCurrency.ts','--outDir',tmp,'--module','commonjs','--moduleResolution','node','--target','ES2020','--esModuleInterop','--skipLibCheck'],{stdio:'inherit'})
 symlinkSync(resolve('node_modules'),join(tmp,'node_modules'),'dir')
 const {followupMetrics,datedFollowupMetrics,datedFollowupRows,followupStateEvidence}=require(join(tmp,'dashboard43.js'))
 const {convertedPayment,convertedSummary,convertedSortValue,localCurrency}=require(join(tmp,'dashboardCurrency.js'))
 const base={studentId:'a',name:'a',phone:'+84000',account:'a',userType:'正式用户',businessLine:'越南',status:'未付费-未体验',registerTime:'2026-09-01T00:00:00Z',salesOwner:'cc-a'}
 const ap=(id,date,extra={})=>({appointmentId:id,scheduledStartAt:date+' 10:00:00',timezone:'Asia/Ho_Chi_Minh',appointmentStatus:'已预约',attendanceStatus:'待标记',consultationStatus:'待标记',createdAt:'2026-09-08T00:00:00Z',...extra})
 const filters={mode:'period',start:'2026-09-10',end:'2026-09-10',owner:[],userType:'正式用户'}
 const filtered=(user,day,calls=[])=>datedFollowupMetrics(followupMetrics([user],calls,[],[],filters).current,calls,{...filters,start:day,end:day})
 const missed={...base,salesAppointments:[ap('old','2026-09-10',{attendanceStatus:'No Show'})]}
 assert.equal(filtered(missed,'2026-09-10')['未出勤待跟进'].length,1)
 const rebooked={...base,salesAppointments:[ap('new','2026-09-12'),ap('old','2026-09-10',{attendanceStatus:'No Show',appointmentStatus:'已改期'})]}
 assert.equal(Object.values(filtered(rebooked,'2026-09-10')).flat().length,0,'rebooking removes all old-date states')
 assert.equal(filtered(rebooked,'2026-09-12')['已预约'].length,1)
 assert.equal(filtered({...base,salesAppointments:[ap('unconfirmed','2026-09-10')]},'2026-09-10')['已预约'].length,1,'past time alone never implies no-show')
 const waiting={...base,salesHistory:[{stage5:'已接通待预约',time:'2026-09-09T00:00:00Z'},{stage5:'已接通待预约',time:'2026-09-08T00:00:00Z'},{stage5:'已预约',time:'2026-09-07T00:00:00Z'}]}
 const calls=[{studentId:'a',result:'已接通',time:'2026-09-02T00:00:00Z'},{studentId:'a',result:'已接通',time:'2026-09-09T00:00:00Z'}]
 assert.equal(filtered(waiting,'2026-09-08',calls)['已接通待预约'].length,1,'latest stage entry, not last follow-up note')
 assert.equal(filtered(waiting,'2026-09-09',calls)['已接通待预约'].length,0)
 assert.equal(followupStateEvidence(base,calls,'已接通待预约').date,'2026-09-02','repeated connections do not reset uninterrupted waiting')
 assert.equal(followupStateEvidence({...base,salesHistory:waiting.salesHistory.slice(0,2)},calls,'已接通待预约').date,'2026-09-02','notes without a previous different stage cannot override the original connected date')
 const cancel={...base,salesLifecycleEvents:[{node:'appointment',result:'已取消预约',occurredAt:'2026-09-08T17:00:00Z',reportedAt:'2026-09-09T00:00:00Z'}]}
 assert.equal(followupStateEvidence(cancel,calls,'已接通待预约').date,'2026-09-09','cancellation/re-entry crosses UTC+7 boundary')
 const missing={...base,salesAppointments:[ap('invalid','',{scheduledStartAt:'bad'})]}
 assert.equal(Object.values(filtered(missing,'2026-09-10')).flat().length,0)
 assert.equal(filtered(missing,'')['已预约'].length,1,'all dates retains missing-date leads')
 const future={...base,salesAppointments:[ap('future','2030-09-12')]}
 assert.equal(filtered(future,'2030-09-12')['已预约'].length,1,'future scheduled appointments are valid')
 for(const consultationStatus of ['未完成','已完成']) {
  const s={...base,salesAppointments:[ap('consult','2026-09-10',{attendanceStatus:'已出勤',consultationStatus})]}
  assert.equal(Object.values(filtered(s,'2026-09-10')).flat().length,1,'consultation states use session scheduled date')
 }
 const closed={...base,salesLifecycleStatus:'已关闭',salesLifecycleEvents:[{node:'lead',result:'已关闭',occurredAt:'2026-09-11T00:00:00Z',reportedAt:'2026-09-11T01:00:00Z'}]}
 assert.equal(filtered(closed,'2026-09-11')['已关闭'].length,1)
 assert.equal(filtered({...closed,salesLifecycleStatus:'进行中'},'2026-09-11')['已关闭'].length,0,'reactivation removes closure regardless of historical event')
 const payer={...base,studentId:'paid',salesOwner:'cc-b',status:'付费'}
 const paidOrders=[{orderId:'p1',studentId:'paid',currency:'VND',paidAmount:25000,paidTime:'2026-09-10T00:00:00Z'},{orderId:'p2',studentId:'paid',currency:'USD',paidAmount:1,paidTime:'2026-09-12T00:00:00Z'}]
 const current=datedFollowupMetrics(followupMetrics([rebooked],[],[],[],filters).current,[],{...filters,start:'2026-09-10',end:'2026-09-12'})
 for (const primary of ['cc','date'])for(const secondary of [true,false]) {
  const rows=datedFollowupRows(current,paidOrders,[rebooked,payer],[],primary,secondary)
  assert.equal(rows.reduce((n,r)=>n+r.metrics['已预约'].length,0),1)
  const dates=primary==='date'?rows:rows.flatMap(r=>r.children||[])
  if(primary==='date'||secondary) {
   assert.equal(dates.find(r=>r.value==='2026-09-10').metrics['已预约'].length,0)
   assert.equal(dates.find(r=>r.value==='2026-09-12').metrics['已预约'].length,1)
   assert.equal(dates.filter(r=>r.metrics.paid.length).length,2,'payment rows use payment dates and retain repeated payer across dates')
  }
 }
 const usd=convertedSummary(paidOrders,'USD',{paid:'VND'})[0]
 assert.equal(usd.amount,2);assert.equal(usd.averagePerOrder,1);assert.equal(usd.averagePerUser,2);assert.equal(usd.users,1);assert.equal(usd.orders.length,2)
 const local=convertedSummary(paidOrders,'local',{paid:'VND'})[0]
 assert.equal(local.amount,50000);assert.equal(local.averagePerOrder,25000);assert.deepEqual(local.orders,usd.orders)
 assert.equal(convertedPayment(paidOrders[1],'local',{paid:'VND'}).rate,25000)
 const multi=[...paidOrders,{orderId:'k',studentId:'k',currency:'KRW',paidAmount:1400}]
 assert.equal(convertedSummary(multi,'local',{paid:'VND',k:'KRW'}).length,2)
 assert.equal(convertedSummary(multi,'USD',{paid:'VND',k:'KRW'})[0].amount,3)
 assert.equal(convertedSortValue(multi,'local',{paid:'VND',k:'KRW'},'amount'),null,'never sort by sum of unlike local currencies')
 assert.equal(convertedSortValue(multi,'USD',{},'amount'),3)
 const unknown=convertedSummary([...paidOrders,{orderId:'x',studentId:'paid',currency:'XXX',paidAmount:10}],'USD',{})[0]
 assert.equal(unknown.amount,null);assert.equal(unknown.orders.length,3);assert.equal(unknown.users,1);assert.equal(unknown.missing,1,'missing rate must not hide order or produce partial total')
 assert.equal(localCurrency('越南'),'VND');assert.equal(localCurrency('韩国'),'KRW');assert.equal(localCurrency('未知'),undefined)
 assert.equal(convertedPayment(paidOrders[0],'USD',{}, {USD:1,VND:0}).amount,null)
 assert.equal(paidOrders[0].paidAmount,25000,'conversion never mutates raw money')
 console.log('Current-stage business dates, rebooking, missing dates, UTC+7, payment grouping and local/USD conversion checks passed.')
}finally{rmSync(tmp,{recursive:true,force:true})}
