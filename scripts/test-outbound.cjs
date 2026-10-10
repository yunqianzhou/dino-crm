const assert = require('node:assert/strict')
const { mkdtempSync, symlinkSync, rmSync } = require('node:fs')
const { tmpdir } = require('node:os')
const { resolve, join } = require('node:path')
const { execFileSync } = require('node:child_process')
// These date-boundary fixtures model a browser in Vietnam.
process.env.TZ = 'Asia/Ho_Chi_Minh'
const temp = mkdtempSync(join(tmpdir(), 'crm-outbound-'))
try {
  execFileSync(resolve('node_modules/.bin/tsc'), ['src/outbound.ts','src/dashboard43.ts','--outDir',temp,'--module','commonjs','--moduleResolution','node','--target','ES2020','--esModuleInterop','--skipLibCheck'], {stdio:'inherit'})
  symlinkSync(resolve('node_modules'), join(temp,'node_modules'),'dir')
  const o = require(join(temp,'outbound.js'))
  const { followupMetrics, cohortFunnel } = require(join(temp,'dashboard43.js'))
  const account = {status:'启用',outboundSeatBound:true}
  assert.equal(o.bindingsOf(account)[0].provider,'existing')
  assert.equal(o.bindingsOf({...account,outboundBindings:[]}).length,0)
  const bindings = [{provider:'existing'},{provider:'omicall'}]
  assert.equal(o.availableBindings({...account,outboundBindings:bindings},'越南').length,2)
  assert.equal(o.availableBindings({...account,outboundBindings:bindings},'泰国').length,1)
  assert.equal(o.availableBindings({...account,status:'停用',outboundBindings:bindings},'越南').length,0)
  assert.equal(o.availableBindings({...account,outboundBindings:[]},'越南').length,0)
  assert.equal(o.providerName('existing'),'Sobot')
  assert.equal(o.availableBindings({...account,outboundBindings:[{provider:'omicall',seat:'',routeId:''}]},'越南').length,1)
  const base = {id:'crm-1',studentId:'u1',provider:'omicall',providerCallId:'p-1',result:'已接通',callStatus:'COMPLETED',duration:'99:00',durationSeconds:9,note:'人工备注',time:'2026-09-28T01:00:00Z',agent:'cc1'}
  const second = {...base,id:'crm-2',provider:'existing',providerCallId:'p-1',durationSeconds:11}
  const failed = {...base,id:'crm-3',providerCallId:'p-3',result:'发起失败',callStatus:'START_FAILED'}
  const pending = {...base,id:'crm-4',providerCallId:'p-4',result:'待确认',callStatus:'DIALING'}
  const all = [base,base,second,failed,pending]
  assert.deepEqual(o.outboundSummary(all),{total:2,people:1,connected:2,connectedPeople:1,seconds:20})
  assert.equal(o.callDurationSeconds({...base,durationSeconds:-2}),0)
  assert.equal(o.callDurationSeconds({...base,durationSeconds:undefined,duration:'01:10'}),70)
  assert.equal(o.callDurationSeconds({...base,durationSeconds:0}),0)
  let records = o.upsertCall([base], {...base,id:'another',note:'',recordingStatus:'available',audioUrl:'demo-recording'})
  assert.equal(records.length,1); assert.equal(records[0].id,'crm-1'); assert.equal(records[0].note,'人工备注')
  records = o.upsertCall(records,{...base,result:'待确认',callStatus:'DIALING'})
  assert.equal(records[0].callStatus,'COMPLETED'); assert.equal(records[0].audioUrl,'demo-recording')
  const user = {studentId:'u1',name:'Demo',phone:'+8400000000',businessLine:'越南',userType:'正式用户',status:'未付费-未体验',registerTime:'2026-09-27T01:00:00Z',salesOwner:'cc1'}
  const filters = {mode:'current',start:'2026-09-28',end:'2026-09-28',owner:[],userType:'正式用户'}
  assert.equal(followupMetrics([user],[failed,pending],[],[],filters).activity.called.length,0)
  const metrics = followupMetrics([user],all,[],[],filters)
  assert.equal(metrics.activity.called.length,1); assert.equal(metrics.activity.connected.length,1)
  assert.equal(followupMetrics([user],all,[],[],{...filters,owner:['other']}).activity.called.length,0)
  assert.equal(followupMetrics([user],[{...base,time:'2026-09-27T16:59:59Z'}],[],[],filters).activity.called.length,0)
  assert.equal(followupMetrics([user],[{...base,time:'2026-09-27T17:00:00Z'}],[],[],filters).activity.called.length,1)
  const funnel = cohortFunnel([user],all,[],[],{...filters,start:'2026-09-27',end:'2026-09-27'},'2026-09-29T00:00:00Z')
  assert.equal(funnel.called.length,1); assert.equal(funnel.connected.length,1)
  assert.equal(o.structuredCallHeaders.length,o.structuredCallRow(base).length)
  console.log('Outbound checks passed: bindings, permissions, deduplication, late updates, durations, Dashboard users, date boundaries and export.')
} finally {rmSync(temp,{recursive:true,force:true})}
