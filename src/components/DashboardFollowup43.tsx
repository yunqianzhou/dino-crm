import { useState } from 'react'
import { Card, DatePicker, Radio, Segmented, Space, Table, Tag } from 'antd'
import { useSearchParams } from 'react-router-dom'
import dayjs from 'dayjs'
import type { CallRecord, LessonRecord, Order, Student } from '../types'
import { ACTIVITY_CALL_KEYS, ACTIVITY_FOLLOW_KEYS, APPOINTMENT_BUCKETS, CURRENT_CALL_KEYS, CURRENT_FOLLOW_KEYS, followupMetrics, reasonEvidence, scheduledAppointments, scopedPeople, uniquePeople, type PeopleMetrics, type Reason43 } from '../dashboard43'
import { dashboardGroupRows, dashboardPaymentOrders, inVietnamRange, type DashboardFilters, type DashboardGrouping } from '../dashboardData'
import { Export43, MetricTable43, rateText, useDashboard43, type MetricRow43 } from './Dashboard43Shared'

type Props = { population:Student[]; calls:CallRecord[]; lessons:LessonRecord[]; orders:Order[]; filters:DashboardFilters; rangeLabel:string }
export default function DashboardFollowup43(props:Props) {
 const { population,calls,lessons,orders,filters,rangeLabel } = props
 const { text,label,count,ownerName } = useDashboard43()
 const [query,setQuery] = useSearchParams()
 const changeView = (key:string,value:string) => { const next=new URLSearchParams(query);next.set(key,value);setQuery(next) }
 const currentGroup = (['cc','intent','age','registrationAge'].includes(query.get('currentGroup')||'') ? query.get('currentGroup') : 'cc') as Exclude<DashboardGrouping,'date'|'source'>
 const setCurrentGroup = (value:string) => changeView('currentGroup',value)
 const activityGroup = query.get('activityGroup')==='cc'?'cc':'date'
 const setActivityGroup = (value:string) => changeView('activityGroup',value)
 const metrics = followupMetrics(population,calls,lessons,orders,filters)
 const selected = scopedPeople(population,filters)
 const allowed = new Set(selected.map(s=>s.studentId))
 const activityTime = (time?:string) => inVietnamRange(time,filters.start,filters.end) && dayjs.utc(time).valueOf() <= Date.now()
 const activityDates = [...new Set([
  ...calls.filter(c=>allowed.has(c.studentId)).map(c=>c.time),
  ...selected.flatMap(s=>[...(s.salesAppointments||[]).map(a=>a.createdAt),...(s.salesLifecycleEvents||[]).map(e=>e.reportedAt)]),
  ...dashboardPaymentOrders(orders,selected,filters).map(o=>o.paidTime!),
 ].filter(activityTime).map(time=>dayjs.utc(time).utcOffset(420).format('YYYY-MM-DD')))].sort().reverse()
 const groupLabel = (key:string) => key==='cc'?text('当前 CC','Current CC'):key==='intent'?text('购买意向','Purchase intent'):key==='age'?text('年龄段','Age group'):key==='registrationAge'?text('注册时长','Days since registration'):text('活动日期','Activity date')
 const groupName = (id:string,key:string) => key==='cc'?ownerName(id):id==='__unknown__'?text('未知','Unknown'):key==='registrationAge'?`${id} ${text('天','days')}`:key==='intent'?id==='有意向'?text('有意向','Interested'):id==='无意向'?text('无意向','Not interested'):text('未填写','Not set'):id
 const currentRows = (keys:string[]) => dashboardGroupRows(Object.fromEntries(keys.map(k=>[k,metrics.current[k]||[]])),currentGroup).map(row=>({...row,name:groupName(row.id,currentGroup)}))
 const activityRows = (keys:string[]):MetricRow43[] => {
  const narrow = (m:PeopleMetrics) => Object.fromEntries(keys.map(k=>[k,m[k]||[]]))
  if(activityGroup==='cc') return dashboardGroupRows(narrow(metrics.activity),'cc').map(r=>({...r,name:ownerName(r.id)}))
  return activityDates.map(date=>{
   const daily = narrow(followupMetrics(population,calls,lessons,orders,{...filters,start:date,end:date}).activity)
   return {id:date,name:date,metrics:daily,children:dashboardGroupRows(daily,'cc').map(row=>({...row,id:JSON.stringify([date,row.id]),name:ownerName(row.id)}))}
  }).filter(row=>Object.values(row.metrics).some(users=>users.length))
 }
 const exportCurrent = (keys:string[]) => <Export43 name="followup-current" sheets={()=>[{name:'Current snapshot',headers:['CRM ID','Name','Current CC',...keys.map(label)],rows:uniquePeople(keys.flatMap(k=>metrics.current[k]||[])).map(s=>[s.studentId,s.name,ownerName(s.salesOwner||'__unassigned__'),...keys.map(k=>Number(metrics.current[k]?.some(u=>u.studentId===s.studentId)))])},{name:'Scope',headers:['Scope','Value'],rows:[['Time','Current snapshot; activity dates do not apply'],['Exported UTC',dayjs.utc().toISOString()]]}]} />
 const exportActivity = (section:'calls'|'followup') => <Export43 name={`followup-${section}`} sheets={()=>[
  {name:'User metrics',headers:['CRM ID','Name','Current CC',...(section==='calls'?ACTIVITY_CALL_KEYS:ACTIVITY_FOLLOW_KEYS).map(label)],rows:uniquePeople((section==='calls'?ACTIVITY_CALL_KEYS:ACTIVITY_FOLLOW_KEYS).flatMap(k=>metrics.activity[k])).map(s=>[s.studentId,s.name,ownerName(s.salesOwner||'__unassigned__'),...(section==='calls'?ACTIVITY_CALL_KEYS:ACTIVITY_FOLLOW_KEYS).map(k=>Number(metrics.activity[k].some(u=>u.studentId===s.studentId)))])},
  ...(section==='calls'?[{name:'Calls',headers:['CRM ID','Call ID','Time UTC','Result','Agent'],rows:calls.filter(c=>allowed.has(c.studentId)&&activityTime(c.time)).map(c=>[c.studentId,c.id,c.time,c.result,c.agent])}]:[
   {name:'Bookings created',headers:['CRM ID','Appointment ID','Created UTC','Scheduled local','Timezone','Creator'],rows:selected.flatMap(s=>(s.salesAppointments||[]).filter(a=>activityTime(a.createdAt)).map(a=>[s.studentId,a.appointmentId,a.createdAt,a.scheduledStartAt,a.timezone,a.createdBy]))},
   {name:'Payments',headers:['CRM ID','Order ID','Paid UTC','Currency','Amount'],rows:dashboardPaymentOrders(orders,selected,filters).map(o=>[o.studentId,o.orderId,o.paidTime,o.currency,o.paidAmount])},
  ]),
  {name:'Recorded events',headers:['CRM ID','Event ID','Node','Result','Reason','Occurred UTC','Recorded UTC','Recorded by','Appointment ID'],rows:selected.flatMap(s=>(s.salesLifecycleEvents||[]).filter(e=>activityTime(e.reportedAt)).map(e=>[s.studentId,e.eventId,e.node,e.result,e.reason,e.occurredAt,e.reportedAt,e.reportedBy,e.appointmentId]))},
  {name:'Scope',headers:['Scope','Value'],rows:[['Activity dates UTC+7',rangeLabel],['CC',Array.isArray(filters.owner)?filters.owner.join(','):filters.owner],['Deduplication','Unique CRM users per metric, raw events are not deduplicated'],['Exported UTC',dayjs.utc().toISOString()]]},
 ]} />
 const block = (section:'calls'|'followup') => {
  const currentKeys = section==='calls'?CURRENT_CALL_KEYS:CURRENT_FOLLOW_KEYS
  const activityKeys = section==='calls'?ACTIVITY_CALL_KEYS:ACTIVITY_FOLLOW_KEYS
  return <Card className="dashboard-followup-section" title={<Space><span className="dashboard-section-index">{section==='calls'?'01':'02'}</span>{text(section==='calls'?'外呼情况':'跟进情况',section==='calls'?'Calling':'Sales follow-up')}</Space>}>
   <div className="dashboard-block-heading"><div><Tag>{text('当前待处理','Current workload')}</Tag><span className="dashboard-section-note">{text('截至当前 · 不受活动日期影响','As of now · independent of activity dates')}</span></div>{exportCurrent(currentKeys)}</div>
   <Radio.Group className="dashboard-dimensions" optionType="button" buttonStyle="solid" value={currentGroup} onChange={e=>setCurrentGroup(e.target.value)} options={['cc','intent','age','registrationAge'].map(value=>({value,label:groupLabel(value)}))}/>
   <MetricTable43 rows={currentRows(currentKeys)} total={metrics.current} keys={currentKeys} firstTitle={groupLabel(currentGroup)} context={text('当前待处理','Current workload')} />
   <div className="dashboard-block-heading dashboard-activity-heading"><div><Tag color="blue">{text('本期推进','Activity in period')}</Tag><span className="dashboard-section-note">{rangeLabel} · UTC+7</span></div>{exportActivity(section)}</div>
   <div className="dashboard-table-tools"><Radio.Group optionType="button" buttonStyle="solid" value={activityGroup} onChange={e=>setActivityGroup(e.target.value)} options={['date','cc'].map(value=>({value,label:groupLabel(value)}))}/><span className="dashboard-section-note">{text('人数分别去重，不相加；可展开日期查看 CC','Counts are deduplicated independently; expand a date for CCs')}</span></div>
   <MetricTable43 rows={activityRows(activityKeys)} labels={{booked:text('新建预约人数','Newly booked users')}} total={metrics.activity} keys={activityKeys} firstTitle={activityGroup==='date'?`${groupLabel('date')} → CC`:groupLabel('cc')} context={`${text('活动日期','Activity dates')}: ${rangeLabel}`} orders={section==='followup'?dashboardPaymentOrders(orders,selected,filters):undefined}/>
   {section==='followup'&&<p className="dashboard-help dashboard-bottom-note">{text('预约出席来自销售预约登记，独立于体验课完成。支付人数、金额 / AOV 按本期支付日期统计。','Appointment attendance uses sales appointment records, independently of trial completion. Paid users and amount / AOV use payment dates in this period.')}</p>}
   <Reasons43 {...props} kinds={section==='calls'?['rejected']:['noShow','incomplete','paymentConcern','closedAfter','paused','closedUnknown']}/>
  </Card>
 }
 const [inventoryOpen,setInventoryOpen] = useState(false)
 return <>
 <Card className="dashboard-inventory" size="small"><div className="dashboard-inventory-row"><span className="dashboard-section-note">{text('当前线索概况','Current lead inventory')}</span>{exportCurrent(['total','assigned','unassigned','已关闭'])}{['total','assigned','unassigned','已关闭'].map(key=><div key={key}><span>{label(key)}</span>{count(metrics.current[key]||[],label(key))}</div>)}<button className="dashboard-count" onClick={()=>setInventoryOpen(!inventoryOpen)}>{text(inventoryOpen?'收起 CC 明细':'查看 CC 明细',inventoryOpen?'Hide CC details':'CC details')}</button></div>{inventoryOpen&&<MetricTable43 rows={dashboardGroupRows(metrics.current,'cc').map(row=>({...row,name:ownerName(row.id)}))} total={metrics.current} keys={['total','assigned','unassigned','已关闭']} firstTitle={groupLabel('cc')} context={text('当前线索概况','Current inventory')}/>}</Card>
 {block('calls')}{block('followup')}<Schedule43 {...props} query={query} setQuery={setQuery}/>
 </>
}
function Reasons43({population,calls,lessons,orders,filters,rangeLabel,kinds}:Props&{kinds:Reason43[]}) {
 const {text,label,count,reason,ownerName}=useDashboard43()
 const [reasonQuery,setReasonQuery]=useSearchParams()
 const prefix=kinds[0]==='rejected'?'callReason':'followReason'
 const kind=kinds.includes(reasonQuery.get(prefix) as Reason43)?reasonQuery.get(prefix) as Reason43:kinds[0]
 const current=reasonQuery.get(prefix+'Scope')==='current'
 const setKind=(value:Reason43)=>{const next=new URLSearchParams(reasonQuery);next.set(prefix,value);setReasonQuery(next)}
 const setCurrent=(value:boolean)=>{const next=new URLSearchParams(reasonQuery);next.set(prefix+'Scope',value?'current':'period');setReasonQuery(next)}
 const evidence=reasonEvidence(population,calls,lessons,orders,filters,kind,current)
 const rows=[...new Set(evidence.map(e=>e.reason))].map(id=>({id,users:uniquePeople(evidence.filter(e=>e.reason===id).map(e=>e.student))})).sort((a,b)=>b.users.length-a.users.length)
 const total=uniquePeople(evidence.map(e=>e.student))
 const scope=current?text('当前仍处于该状态','Currently in this state'):`${text('期间原因','Reasons in period')} · ${rangeLabel}`
 return <div className="dashboard-reasons-inline"><div className="dashboard-block-heading"><strong>{text('原因分布','Reasons')}</strong><Export43 name={`reasons-${kind}-${current?'current':'period'}`} sheets={()=>[{name:'Reason records',headers:['CRM ID','Name','Current CC','Category','Reason','Event ID','Recorded UTC','Recorded by'],rows:evidence.map(e=>[e.student.studentId,e.student.name,ownerName(e.student.salesOwner||'__unassigned__'),label(kind),reason(e.reason),e.event?.eventId,e.event?.reportedAt,e.event?.reportedBy])},{name:'Scope',headers:['Scope','Value'],rows:[['Scope',scope],['Exported UTC',dayjs.utc().toISOString()]]}]} /></div>
 <div className="dashboard-table-tools"><Radio.Group className="dashboard-dimensions" optionType="button" buttonStyle="solid" value={kind} onChange={e=>setKind(e.target.value)} options={kinds.map(value=>({value,label:label(value)}))}/><Segmented aria-label={text('原因时间范围','Reason time scope')} value={current?'current':'period'} onChange={v=>setCurrent(v==='current')} options={[{value:'period',label:text('期间记录','Period records')},{value:'current',label:text('当前状态','Current state')}]}/></div>
 <p className="dashboard-help">{scope}{kind==='paymentConcern'?text(' · 有顾虑仍继续跟进，不自动关闭。',' · Concerns keep the lead active; they do not close it.') : kind==='closedUnknown'?text(' · 旧关闭记录未记录环节，保留在此，不归入电话拒绝或咨询后关闭。',' · Legacy closures without a recorded stage stay separate.') : ''}</p>
 <Table rowKey="id" size="small" pagination={false} dataSource={rows} locale={{emptyText:text('该范围暂无已记录原因','No recorded reasons in this scope')}} columns={[{title:text('原因','Reason'),dataIndex:'id',render:reason},{title:text('人数','Users'),width:150,sorter:(a,b)=>a.users.length-b.users.length,render:(_,row)=>count(row.users,`${scope} · ${label(kind)} · ${reason(row.id)}`)},{title:text('占比','Share'),width:150,sorter:(a,b)=>a.users.length-b.users.length,render:(_,row)=>rateText(total.length?row.users.length/total.length*100:null)}]} summary={()=><Table.Summary fixed="top"><Table.Summary.Row><Table.Summary.Cell index={0}>{text('合计（去重）','Total (unique users)')}</Table.Summary.Cell><Table.Summary.Cell index={1}>{count(total,`${scope} · ${label(kind)}`)}</Table.Summary.Cell><Table.Summary.Cell index={2}>{total.length?'100%':'—'}</Table.Summary.Cell></Table.Summary.Row></Table.Summary>}/>
 {rows.length>1&&<p className="dashboard-help dashboard-bottom-note">{text('同一用户可有多条原因记录；合计按用户去重，各行占比可能相加超过 100%。','A user may have several reasons. Total users are deduplicated; row shares can sum to over 100%.')}</p>}
 </div>
}
function Schedule43({population,filters,query,setQuery}:Props&{query:URLSearchParams;setQuery:(query:URLSearchParams)=>void}) {
 const {text,label,count,ownerName}=useDashboard43()
 const today=dayjs().utcOffset(420).format('YYYY-MM-DD')
 const start=query.has('scheduleStart')?query.get('scheduleStart')||'':today
 const end=query.has('scheduleEnd')?query.get('scheduleEnd')||'':today
 const rows=scheduledAppointments(population,filters,start,end)
 const bucket=(APPOINTMENT_BUCKETS as readonly string[]).includes(query.get('scheduleBucket')||'')?query.get('scheduleBucket')!:'all'
 const setBucket=(value:string)=>{const next=new URLSearchParams(query);next.set('scheduleBucket',value);setQuery(next)}
 const displayed=rows.filter(row=>bucket==='all'||row.bucket===bucket)
 const effective=rows.filter(row=>!['cancelled','rescheduled'].includes(row.bucket))
 const attended=rows.filter(row=>row.bucket==='attended')
 const bucketName=(key:string)=>key==='attended'?text('已出席','Attended'):key==='noShow'?text('明确未出席','Confirmed no show'):label(key)
 const format=(time?:string)=>time&&dayjs.utc(time).isValid()?dayjs.utc(time).utcOffset(420).format('YYYY-MM-DD HH:mm'):'—'
 return <Card title={text('预约计划日明细','Scheduled appointments')} extra={<Export43 name="scheduled-appointments" disabled={!displayed.length} sheets={()=>[{name:'Appointments',headers:['Appointment ID','CRM ID','Name','Current CC','Scheduled UTC+7','Result','Consultation','Created UTC','Created by','Result recorded by','Result recorded UTC'],rows:displayed.map(r=>[r.id,r.student.studentId,r.student.name,ownerName(r.student.salesOwner||'__unassigned__'),format(r.instant),bucketName(r.bucket),r.appointment.consultationStatus,r.appointment.createdAt,r.appointment.createdBy,r.result?.reportedBy,r.result?.reportedAt])},{name:'Scope',headers:['Scope','Value'],rows:[['Scheduled dates UTC+7',`${start||'All'} / ${end||'All'}`],['Result',bucket],['Unit','Appointment instances'],['Effective appointments',effective.length],['Attended',attended.length],['Exported UTC',dayjs.utc().toISOString()]]}]} />}>
 <div className="dashboard-table-tools"><div className="dashboard-date"><span>{text('预约计划日期','Scheduled date')}</span><DatePicker.RangePicker aria-label={text('预约计划日期','Scheduled date')} value={start&&end?[dayjs(start),dayjs(end)]:null} presets={[{label:text('今天','Today'),value:[dayjs(today),dayjs(today)]}]} onChange={value=>{const next=new URLSearchParams(query);next.set('scheduleStart',value?.[0]?.format('YYYY-MM-DD')||'');next.set('scheduleEnd',value?.[1]?.format('YYYY-MM-DD')||'');setQuery(next)}}/></div><span className="dashboard-section-note">{text('独立于活动日期 · 单位：个预约','Independent of activity dates · appointment instances')}</span></div>
 <div className="dashboard-schedule-stats"><div><span>{text('有效预约','Effective appointments')}</span><strong>{effective.length}</strong></div><div><span>{text('预约用户（去重）','Unique users booked')}</span>{count(uniquePeople(rows.map(r=>r.student)),text('预约计划日用户','Users with scheduled appointments'))}</div><div><span>{text('出席率（截至当前）','Attendance rate to date')}</span><strong>{rateText(effective.length?attended.length/effective.length*100:null)}</strong><small>{attended.length} / {effective.length}</small></div></div>
 <Radio.Group className="dashboard-dimensions dashboard-schedule-filters" optionType="button" buttonStyle="solid" value={bucket} onChange={e=>setBucket(e.target.value)} options={[{value:'all',label:`${text('全部','All')} ${rows.length}`},...APPOINTMENT_BUCKETS.map(value=>({value,label:`${bucketName(value)} ${rows.filter(r=>r.bucket===value).length}`}))]}/>
 <Table rowKey="id" size="small" dataSource={displayed} pagination={displayed.length>10?{pageSize:10,showSizeChanger:false}:false} scroll={{x:1400}} columns={[
 {title:text('用户','User'),width:180,fixed:'left',render:(_,row)=><div>{row.student.name}<small className="dashboard-record-id">{row.student.studentId}</small></div>},
 {title:text('当前 CC','Current CC'),width:100,sorter:(a,b)=>ownerName(a.student.salesOwner||'__unassigned__').localeCompare(ownerName(b.student.salesOwner||'__unassigned__')),render:(_,row)=>ownerName(row.student.salesOwner||'__unassigned__')},
 {title:text('计划时间 UTC+7','Scheduled UTC+7'),width:180,sorter:(a,b)=>a.instant.localeCompare(b.instant),render:(_,row)=>format(row.instant)},
 {title:text('履约结果','Attendance result'),width:170,sorter:(a,b)=>a.bucket.localeCompare(b.bucket),render:(_,row)=><Tag color={row.bucket==='attended'?'green':row.bucket==='unconfirmed'?'orange':undefined}>{bucketName(row.bucket)}</Tag>},
 {title:text('咨询结果','Consultation result'),width:150,sorter:(a,b)=>a.appointment.consultationStatus.localeCompare(b.appointment.consultationStatus),render:(_,row)=>text(row.appointment.consultationStatus,({已完成:'Completed',未完成:'Incomplete',待标记:'Not recorded'} as const)[row.appointment.consultationStatus])},
 {title:text('创建人','Created by'),width:140,sorter:(a,b)=>a.appointment.createdBy.localeCompare(b.appointment.createdBy),render:(_,row)=>ownerName(row.appointment.createdBy)},
 {title:text('结果登记人','Recorded by'),width:140,sorter:(a,b)=>(a.result?.reportedBy||'').localeCompare(b.result?.reportedBy||''),render:(_,row)=>row.result?ownerName(row.result.reportedBy):'—'},
 {title:text('结果登记时间 UTC+7','Recorded UTC+7'),width:180,sorter:(a,b)=>(a.result?.reportedAt||'').localeCompare(b.result?.reportedAt||''),render:(_,row)=>format(row.result?.reportedAt)},
 ]} summary={()=><Table.Summary fixed="top"><Table.Summary.Row><Table.Summary.Cell index={0} colSpan={8}>{text('合计','Total')}: {displayed.length} {text('个预约','appointments')} · {text('用户','users')} {uniquePeople(displayed.map(r=>r.student)).length}</Table.Summary.Cell></Table.Summary.Row></Table.Summary>}/>
 <p className="dashboard-help dashboard-bottom-note">{text('出席率 = 已出席预约 ÷ 有效预约。取消、改期不计有效预约；待发生、待确认仍在分母内，未登记不等于未出席。','Attendance rate = attended / effective appointments. Cancelled and rescheduled bookings are excluded; upcoming and unconfirmed bookings remain in the denominator. Unrecorded does not mean no show.')}</p>
 </Card>
}
