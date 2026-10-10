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
 const {localPaymentSummary,localMoneySortValue,localMoneySortable,currencyExportHeaders,currencyExportRow}=require(join(tmp,'dashboardCurrency.js'))
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
 const local=localPaymentSummary(paidOrders)
 assert.equal(local.length,2,'preserve both recorded currencies without conversion')
 assert.equal(local.find(r=>r.currency==='VND').amount,25000)
 assert.equal(local.find(r=>r.currency==='USD').amount,1,'original USD remains USD, never relabeled or converted')
 const multi=[...paidOrders,{orderId:'k',studentId:'k',currency:'KRW',paidAmount:1400}]
 assert.equal(localPaymentSummary(multi).length,3)
 assert.equal(localMoneySortValue(multi,'amount'),null,'never add unlike local currencies for sorting')
 assert.equal(localMoneySortable(multi),false)
 const same=[paidOrders[0],{...paidOrders[0],orderId:'p3',paidAmount:75000}]
 const vnd=localPaymentSummary(same)[0]
 assert.equal(vnd.amount,100000);assert.equal(vnd.averagePerOrder,50000);assert.equal(vnd.averagePerUser,100000)
 assert.equal(vnd.orders.length,2);assert.equal(vnd.users,1)
 assert.equal(localMoneySortable(same),true);assert.equal(localMoneySortValue(same,'amount'),100000)
 assert.equal(localMoneySortValue(same,'averagePerOrder'),50000)
 assert.equal(localMoneySortValue(same,'averagePerUser'),100000)
 const unknownOrder={...paidOrders[0],orderId:'missing',currency:''}
 const unknown=localPaymentSummary([unknownOrder])[0]
 assert.equal(unknown.amount,null);assert.equal(unknown.averagePerOrder,null);assert.equal(unknown.orders.length,1)
 assert.equal(localMoneySortable([unknownOrder]),false)
 assert.equal(localMoneySortValue([],'amount'),0);assert.equal(localMoneySortValue([],'averagePerUser'),null)
 assert.deepEqual(currencyExportHeaders,['Currency','Paid amount'])
 assert.deepEqual(currencyExportRow(paidOrders[0]),['VND',25000])
 assert.deepEqual(currencyExportRow(paidOrders[1]),['USD',1])
 assert.deepEqual(currencyExportRow(unknownOrder),['Currency not recorded',25000])
 assert.equal(paidOrders[0].paidAmount,25000,'display never mutates raw money')
 console.log('Current-stage dates, rebooking, UTC+7, payment grouping, local-currency totals, averages, sorting and exports passed.')
}finally{rmSync(tmp,{recursive:true,force:true})}
