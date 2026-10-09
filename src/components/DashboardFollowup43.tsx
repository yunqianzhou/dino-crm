import OutboundDashboard from './OutboundDashboard'
import { structuredCallHeaders, structuredCallRow } from '../outbound'
import { useState } from 'react'
import DashboardOutcomeReasons43 from './DashboardOutcomeReasons43'
import { Card, Radio, Space } from 'antd'
import { useSearchParams } from 'react-router-dom'
import dayjs from 'dayjs'
import type { CallRecord, LessonRecord, Order, Student } from '../types'
import { ACTIVITY_CALL_KEYS, ACTIVITY_FOLLOW_KEYS, CURRENT_INVENTORY_KEYS, CURRENT_CALL_KEYS, CURRENT_FOLLOW_KEYS, followupMetrics, followupComparisonRows, datedFollowupRows, datedFollowupMetrics, followupStateEvidence, scopedPeople, uniquePeople } from '../dashboard43'
import { dashboardGroupRows, dashboardPaymentOrders, inVietnamRange, type DashboardFilters } from '../dashboardData'
import { useDashboardCurrency, currencyExportHeaders, currencyExportRow } from './DashboardCurrency'
import { Export43, MetricTable43, useDashboard43, type MetricRow43 } from './Dashboard43Shared'

type Props = { population:Student[]; calls:CallRecord[]; lessons:LessonRecord[]; orders:Order[]; filters:DashboardFilters; rangeLabel:string }
export default function DashboardFollowup43(props:Props) {
 const { population,calls,lessons,orders,filters,rangeLabel } = props
 const { text,label,count,ownerName } = useDashboard43()
 const currencyConfig = useDashboardCurrency()
 const followupLabels:Record<string,string> = {
  '已接通待预约':text('待预约','Appointment pending'),
  '已预约':text('已预约','Appointment booked'),
  '未出勤待跟进':text('未出勤','No show'),
  '咨询未完成待跟进':text('咨询未完成','Consultation incomplete'),
  '咨询完成待支付':text('咨询已完成','Consultation completed'),
  paid:text('已支付','Paid'),
 }
 const followupLabel=(key:string)=>followupLabels[key]||label(key)
 const [query,setQuery] = useSearchParams()
 const changeView = (key:string,value:string) => { const next=new URLSearchParams(query);next.set(key,value);setQuery(next) }
 type Section = 'calls' | 'followup'
 const primary = (section:Section) => query.get(`${section}Primary`) === 'date' ? 'date' : 'cc'
 const secondary = (section:Section) => query.get(`${section}Secondary`) !== ''
 const groupLabel = (key:string,section:Section) => key==='cc'?text('当前 CC','Current CC'):text('活动日期','Activity date')
 const groupName = (id:string,key:string) => key==='cc'?ownerName(id):id==='__unknown_date__'?text('业务日期缺失','Business date missing'):id
 const metrics = followupMetrics(population,calls,lessons,orders,filters)
 const followup = datedFollowupMetrics(metrics.current,calls,filters)
 const selected = scopedPeople(population,filters)
 const paidOrders = dashboardPaymentOrders(orders,selected,filters)
 const allowed = new Set(selected.map(s=>s.studentId))
 const activityTime = (time?:string) => inVietnamRange(time,filters.start,filters.end) && dayjs.utc(time).valueOf() <= Date.now()
 const activityDates = [...new Set([
  ...calls.filter(c=>allowed.has(c.studentId)).map(c=>c.time),
  ...selected.flatMap(s=>[...(s.salesAppointments||[]).map(a=>a.createdAt),...(s.salesLifecycleEvents||[]).map(e=>e.reportedAt)]),
  ...dashboardPaymentOrders(orders,selected,filters).map(o=>o.paidTime!),
 ].filter(activityTime).map(time=>dayjs.utc(time).utcOffset(420).format('YYYY-MM-DD')))].sort().reverse()
 const dailyMetrics = activityDates.map(date=>({date,metrics:followupMetrics(population,calls,lessons,orders,{...filters,start:date,end:date}).activity}))
 const comparisonRows = (section:Section,currentKeys:string[],activityKeys:string[]):MetricRow43[] => (section==='followup'?datedFollowupRows(followup,paidOrders,selected,calls,primary(section),secondary(section)):followupComparisonRows(metrics.current,metrics.activity,dailyMetrics,primary(section),currentKeys,activityKeys,secondary(section))).map(row=>({
  ...row,name:groupName(row.value,primary(section)),
  children:row.children?.map(child=>({...child,children:undefined,name:groupName(child.value,primary(section)==='cc'?'date':'cc'),scopeName:`${groupName(row.value,primary(section))} / ${groupName(child.value,primary(section)==='cc'?'date':'cc')}`})),
 }))
 const exportCurrent = (keys:string[]) => <Export43 name="followup-current" sheets={()=>[{name:'Current snapshot',headers:['CRM ID','Name','Current CC',...keys.map(label)],rows:uniquePeople(keys.flatMap(k=>metrics.current[k]||[])).map(s=>[s.studentId,s.name,ownerName(s.salesOwner||'__unassigned__'),...keys.map(k=>Number(metrics.current[k]?.some(u=>u.studentId===s.studentId)))])},{name:'Scope',headers:['Scope','Value'],rows:[['Time','Current snapshot; activity dates do not apply'],['Exported UTC',dayjs.utc().toISOString()]]}]} />
 const exportSection = (section:Section) => <Export43 name={`followup-${section}`} sheets={()=>{
  const current = section==='followup' ? followup : metrics.current
  const keys = section==='calls' ? CURRENT_CALL_KEYS : CURRENT_FOLLOW_KEYS
  const users = uniquePeople(keys.flatMap(k=>current[k]||[]))
  const stateRows = users.map(s=>{const evidence=followupStateEvidence(s,calls);return [s.studentId,s.name,ownerName(s.salesOwner||'__unassigned__'),...(section==='followup'?[evidence.stage,groupName(evidence.date,'date'),evidence.source,evidence.time||'',evidence.appointmentId]:[]),...keys.map(k=>Number(current[k]?.some(u=>u.studentId===s.studentId)))]})
  return [
   {name:'Current snapshot',headers:['CRM ID','Name','Current CC',...(section==='followup'?['Current stage','Business date UTC+7','Date source','Source time UTC','Appointment ID']:[]),...keys.map(followupLabel)],rows:stateRows},
   {name:'Period user metrics',headers:['CRM ID','Name','Current CC',...(section==='calls'?ACTIVITY_CALL_KEYS:ACTIVITY_FOLLOW_KEYS).map(followupLabel)],rows:uniquePeople((section==='calls'?ACTIVITY_CALL_KEYS:ACTIVITY_FOLLOW_KEYS).flatMap(k=>metrics.activity[k])).map(s=>[s.studentId,s.name,ownerName(s.salesOwner||'__unassigned__'),...(section==='calls'?ACTIVITY_CALL_KEYS:ACTIVITY_FOLLOW_KEYS).map(k=>Number(metrics.activity[k].some(u=>u.studentId===s.studentId)))])},
   ...(section==='calls'?[{name:'Calls',headers:structuredCallHeaders,rows:calls.filter(c=>allowed.has(c.studentId)&&activityTime(c.time)).map(structuredCallRow)}]:[
    {name:'Appointments',headers:['CRM ID','Appointment ID','Status','Scheduled start','Timezone','Business date UTC+7'],rows:users.flatMap(s=>{const e=followupStateEvidence(s,calls);const a=(s.salesAppointments||[]).find(a=>a.appointmentId===e.appointmentId);return a?[[s.studentId,a.appointmentId,a.appointmentStatus,a.scheduledStartAt,a.timezone,e.date]]:[]})},
    {name:'Payments',headers:['CRM ID','Order ID','Paid UTC','Paid date UTC+7',...currencyExportHeaders],rows:paidOrders.map(o=>[o.studentId,o.orderId,o.paidTime,dayjs.utc(o.paidTime).utcOffset(420).format('YYYY-MM-DD'),...currencyExportRow(o,currencyConfig)])},
   ]),
   {name:'Scope',headers:['Scope','Value'],rows:[['Current workload',section==='followup'?'Current state, filtered by its business date':'Current snapshot; activity dates do not apply'],['First grouping',groupLabel(primary(section),section)],['Second grouping',secondary(section)?groupLabel(primary(section)==='cc'?'date':'cc',section):text('不再细分','No subgroup')],['Activity dates UTC+7',rangeLabel],['Date rules','Waiting: latest stage entry; booked/no-show/consultation: current session scheduled date; closed: latest closure; paid: order payment date'],['Rebooking','Only latest current stage and new scheduled date; previous stage/date removed'],['Missing business dates','Included only with no date filter; no inferred registration or update date'],['Money display',currencyConfig.mode],['FX','Fixed demo rates, not market quotes; raw and converted amounts preserved'],['CC',Array.isArray(filters.owner)?filters.owner.join(','):filters.owner],['Deduplication','Unique CRM users per metric; paid totals deduplicate across dates'],['Exported UTC',dayjs.utc().toISOString()]]},
  ]
 }} />
 const block = (section:'calls'|'followup') => {
  const currentKeys = section==='calls'?CURRENT_CALL_KEYS:CURRENT_FOLLOW_KEYS
  const activityKeys = section==='calls'?ACTIVITY_CALL_KEYS:ACTIVITY_FOLLOW_KEYS
  return <Card className="dashboard-followup-section" title={<Space><span className="dashboard-section-index">{section==='calls'?'01':'02'}</span>{text(section==='calls'?'外呼情况':'跟进情况',section==='calls'?'Calling':'Sales follow-up')}</Space>}>
   <div className="dashboard-table-tools">
    <div className="dashboard-hierarchy-controls" aria-label={section==='calls'?text('外呼分组','Calling grouping'):text('跟进分组','Follow-up grouping')}>
     <div><span>{text('先按','Group first by')}</span><Radio.Group aria-label={text('先按','Group first by')} optionType="button" buttonStyle="solid" value={primary(section)} onChange={e=>changeView(`${section}Primary`,e.target.value)} options={['cc','date'].map(value=>({value,label:groupLabel(value,section)}))}/></div>
     <div><span>{text('再按','Then by')}</span><Radio.Group aria-label={text('再按','Then by')} optionType="button" buttonStyle="solid" value={secondary(section)?'yes':''} onChange={e=>changeView(`${section}Secondary`,e.target.value)} options={[{value:'',label:text('不再细分','No subgroup')},{value:'yes',label:groupLabel(primary(section)==='cc'?'date':'cc',section)}]}/></div>
    </div>
    {exportSection(section)}
   </div>
   {section==='calls' && <OutboundDashboard calls={calls.filter(c=>allowed.has(c.studentId)&&activityTime(c.time))} />}
   <MetricTable43 key={`${section}-${primary(section)}-${secondary(section)}`} rows={comparisonRows(section,currentKeys,activityKeys)} total={{...(section==='followup'?followup:metrics.current),...metrics.activity}} keys={[...currentKeys,...activityKeys]} currentKeys={currentKeys} datedCurrent={section==='followup'} labels={section==='followup'?followupLabels:undefined} firstTitle={`${groupLabel(primary(section),section)}${secondary(section)?' → '+groupLabel(primary(section)==='cc'?'date':'cc',section):''}`} context={rangeLabel} orders={section==='followup'?paidOrders:undefined}/>
   {section==='calls'&&<p className="dashboard-help dashboard-bottom-note">{text('已拒绝按当前状态统计；展开查看每日活动，日期行的“—”表示不重复展示当前状态。期间合计按用户去重，不等于每日人数相加。','Rejected counts the current state. Expand for daily activity. A dash on date rows means current status is not repeated. Period totals deduplicate users across days.')}</p>}
   {section==='followup'&&<p className="dashboard-help dashboard-bottom-note">{text('先取当前状态，再按活动日期筛选：待预约按最近进入该阶段的日期；已预约、未出勤和咨询状态按当前关联场次的上课日期；已结束按最近结束日期。重约后只归入新预约日期。已支付、金额及 AOV 按支付日期统计；各指标分别去重。业务日期缺失只在全部日期中显示。','Resolve the current stage first, then filter its business date: waiting-stage entry, current session scheduled date for booking/attendance/consultation, or latest closure. Rebooking moves the user to the new date. Payments use payment dates; each metric deduplicates users. Missing business dates appear only with no date filter.')}</p>}
   {section==='calls'&&primary(section)==='date'&&<p className="dashboard-help dashboard-bottom-note">{text('日期行仅展示当天活动，当前状态显示为“—”；当前状态总数仍保留在合计行，可切换为先按 CC 查看负责人分布。','Date rows show that day’s activity; current states display a dash. Current totals remain in the summary. Group first by CC to see the current owner breakdown.')}</p>}
   <DashboardOutcomeReasons43 users={(section==='followup'?followup:metrics.current)[section==='calls'?'已拒绝':'已关闭'] || []} dateScope={section==='followup'?rangeLabel:undefined} metric={section==='calls'?'已拒绝':'已关闭'}/>
  </Card>
 }
 const [inventoryOpen,setInventoryOpen] = useState(false)
 return <>
 <Card className="dashboard-inventory" size="small"><div className="dashboard-inventory-row"><span className="dashboard-section-note">{text('当前线索概况','Current lead inventory')}</span>{exportCurrent(CURRENT_INVENTORY_KEYS)}{CURRENT_INVENTORY_KEYS.map(key=><div key={key}><span>{label(key)}</span>{count(metrics.current[key]||[],label(key),key)}</div>)}<button className="dashboard-count" onClick={()=>setInventoryOpen(!inventoryOpen)}>{text(inventoryOpen?'收起 CC 明细':'查看 CC 明细',inventoryOpen?'Hide CC details':'CC details')}</button></div>{inventoryOpen&&<MetricTable43 rows={dashboardGroupRows(metrics.current,'cc').map(row=>({...row,name:ownerName(row.id)}))} total={metrics.current} keys={CURRENT_INVENTORY_KEYS} firstTitle={groupLabel('cc','calls')} context={text('当前线索概况','Current inventory')}/>}</Card>
 {block('calls')}{block('followup')}
 </>
}
