process.env.TZ='Asia/Shanghai'
const assert=require('node:assert/strict')
const {mkdtempSync,symlinkSync,rmSync}=require('node:fs')
const {join,resolve}=require('node:path')
const {tmpdir}=require('node:os')
const {execFileSync}=require('node:child_process')
const tmp=mkdtempSync(join(tmpdir(),'crm-detail-'))
try {
 execFileSync(resolve('node_modules/.bin/tsc'),['src/dashboardDetailExport.ts','src/managementDemo.ts','--outDir',tmp,'--module','commonjs','--moduleResolution','node','--target','ES2020','--esModuleInterop','--skipLibCheck'],{stdio:'inherit'})
 symlinkSync(resolve('node_modules'),join(tmp,'node_modules'),'dir')
 const detail=require(join(tmp,'dashboardDetailExport.js'))
 const {cohortFunnel,followupMetrics,datedFollowupMetrics,scopedPeople,FUNNEL_KEYS,CURRENT_INVENTORY_KEYS,CURRENT_CALL_KEYS,CURRENT_FOLLOW_KEYS}=require(join(tmp,'dashboard43.js'))
 const {dashboardPaymentOrders,inDashboardRange}=require(join(tmp,'dashboardData.js'))
 const {createManagementDemo}=require(join(tmp,'managementDemo.js'))
 const {outboundSummary}=require(join(tmp,'outbound.js'))
 const demo=createManagementDemo('2026-09-25T00:00:00Z')
 const ctx={text:zh=>zh,ownerName:id=>id,calls:demo.callRecords}
 const val=(sh,row,col)=>row[sh.headers.indexOf(col)]
 const flagSum=(sh,from,count)=>Array.from({length:count},(_,i)=>sh.rows.reduce((n,r)=>n+r[from+i],0))
 const checkShape=sheets=>sheets.forEach(sh=>{assert.equal(new Set(sh.headers).size,sh.headers.length);sh.rows.forEach(r=>assert.equal(r.length,sh.headers.length,sh.name));assert.equal(new Set(sh.rows.map(r=>JSON.stringify(r))).size,sh.rows.length,'no duplicated complete rows')})
 for(const businessLine of ['越南','马来'])for(const dates of [['',''],['2026-09-23','2026-09-24'],['2035-01-01','2035-01-02']]){
  const filters={mode:'current',start:dates[0],end:dates[1],owner:[],userType:'正式用户'}
  const people=demo.students.filter(s=>s.businessLine===businessLine),selected=scopedPeople(people,filters)
  const funnel=cohortFunnel(people,demo.callRecords,demo.lessons,demo.orders,filters)
  const exports=detail.conversionDetailSheets(funnel,demo.callRecords,demo.lessons,demo.orders,ctx)
  checkShape(exports)
  assert.deepEqual(flagSum(exports[0],9,6),FUNNEL_KEYS.map(k=>funnel[k].length),'conversion user flags equal six page counts')
  assert.equal(exports[0].rows.length,new Set(exports[0].rows.map(r=>r[0])).size,'one row per user')
  for(const sh of exports)for(const row of sh.rows){assert.equal(row[2],businessLine);assert.match(row[6],/\+08:00$/)}
  const metrics=followupMetrics(people,demo.callRecords,demo.lessons,demo.orders,filters)
  const inventory=detail.inventoryDetailSheet(metrics.current,ctx)
  assert.deepEqual(flagSum(inventory,13,6),CURRENT_INVENTORY_KEYS.map(k=>metrics.current[k].length))
  const follow=datedFollowupMetrics(metrics.current,demo.callRecords,filters)
  const orders=dashboardPaymentOrders(demo.orders,selected,filters)
  const fs=detail.followupDetailSheets(follow,metrics.activity,orders,ctx)
  checkShape(fs)
  assert.deepEqual(flagSum(fs[0],13,7),[...CURRENT_FOLLOW_KEYS.map(k=>follow[k].length),metrics.activity.paid.length])
  assert.equal(fs[2].rows.reduce((n,r)=>n+val(fs[2],r,'实付金额'),0),orders.reduce((n,o)=>n+o.paidAmount,0),'payment evidence sums to page money')
  const ids=new Set(selected.map(s=>s.studentId)),calls=demo.callRecords.filter(c=>ids.has(c.studentId)&&inDashboardRange(c.time,...dates))
  const cs=detail.callingDetailSheets(metrics.current,metrics.activity,calls,ctx)
  checkShape(cs)
  assert.deepEqual(flagSum(cs[0],13,5),[...CURRENT_CALL_KEYS.map(k=>metrics.current[k].length),metrics.activity.called.length,metrics.activity.connected.length])
  const total=outboundSummary(calls)
  assert.equal(cs[1].rows.length,total.total)
  assert.equal(cs[1].rows.reduce((n,r)=>n+val(cs[1],r,'接通时长（秒）'),0),total.seconds)
  for(const metric of ['已拒绝','已关闭']){
   const rs=detail.reasonDetailSheet((metric==='已关闭'?follow:metrics.current)[metric],metric,x=>x,ctx)
   checkShape([rs]);assert.equal(rs.rows.length,(metric==='已关闭'?follow:metrics.current)[metric].length)
  }
  if(dates[0]==='2035-01-01')assert.equal(fs[0].rows.length,follow['已接通待预约'].length,'date-independent waiting retained without old period rows')
 }
 const s={studentId:'00001234567890123456',name:'测试',businessLine:'马来',userType:'正式用户',registerTime:'2026-09-01T00:00:00Z',salesOwner:'cc',salesHistory:[]}
 const a={appointmentId:'a',scheduledStartAt:'2026-09-10 10:00:00',timezone:'Asia/Ho_Chi_Minh',createdAt:'2026-09-01T00:00:00Z'}
 const as=detail.appointmentDetailSheet([{student:s,appointment:a}],ctx)
 assert.equal(as.rows[0][0],s.studentId,'IDs retain leading zero and long precision as strings')
 assert.equal(val(as,as.rows[0],'预约上课时间'),'2026-09-10 11:00:00 +08:00','source appointment timezone converted to browser timezone')
 const order={studentId:s.studentId,orderId:'o1',orderStatus:'已支付',paidTime:'2026-09-10T00:00:00Z',paidAmount:100,currency:'MYR'}
 const multi=detail.orderDetailSheet([s],[order,{...order,orderId:'o2',paidAmount:200}],ctx)
 assert.equal(multi.rows.length,2,'multiple orders retained as separate records, not multiplied by user join')
 const rejected={...s,salesOutcome5:{stage:'rejected',reason:'其他：预算'},salesHistory:[{stage5:'Rejected',time:'2026-09-12T00:00:00Z'},{stage5:'Rejected',time:'2026-09-10T00:00:00Z'},{stage5:'待外呼',time:'2026-09-09T00:00:00Z'}]}
 const reason=detail.reasonDetailSheet([rejected],'已拒绝',x=>x,ctx)
 assert.equal(val(reason,reason.rows[0],'拒绝或结束日期'),'2026-09-10','repeated note must not move rejection date')
 assert.equal(val(reason,reason.rows[0],'原因分类'),'其他');assert.equal(val(reason,reason.rows[0],'具体原因'),'其他：预算')
 console.log('Dashboard detail exports passed: per-user reconciliation, every event record, currency totals, browser-time conversion, long IDs, reason dates and empty-period waiting.')
}finally{rmSync(tmp,{recursive:true,force:true})}
