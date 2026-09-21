import { useState } from 'react'
import { Card, Radio, Space } from 'antd'
import { useSearchParams } from 'react-router-dom'
import dayjs from 'dayjs'
import type { CallRecord, LessonRecord, Order, Student } from '../types'
import { ACTIVITY_CALL_KEYS, ACTIVITY_FOLLOW_KEYS, CURRENT_CALL_KEYS, CURRENT_FOLLOW_KEYS, followupMetrics, followupComparisonRows, scopedPeople, uniquePeople } from '../dashboard43'
import { dashboardGroupRows, dashboardPaymentOrders, inVietnamRange, type DashboardFilters, type DashboardGrouping } from '../dashboardData'
import { Export43, MetricTable43, useDashboard43, type MetricRow43 } from './Dashboard43Shared'

type Props = { population:Student[]; calls:CallRecord[]; lessons:LessonRecord[]; orders:Order[]; filters:DashboardFilters; rangeLabel:string }
export default function DashboardFollowup43(props:Props) {
 const { population,calls,lessons,orders,filters,rangeLabel } = props
 const { text,label,count,ownerName } = useDashboard43()
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
 const currentGroup = (['cc','intent','age','registrationAge'].includes(query.get('currentGroup')||'') ? query.get('currentGroup') : 'cc') as Exclude<DashboardGrouping,'date'|'source'>
 const setCurrentGroup = (value:string) => changeView('currentGroup',value)
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
 const dailyMetrics = activityDates.map(date=>({date,metrics:followupMetrics(population,calls,lessons,orders,{...filters,start:date,end:date}).activity}))
 const comparisonRows = (currentKeys:string[],activityKeys:string[]):MetricRow43[] => followupComparisonRows(metrics.current,metrics.activity,dailyMetrics,currentGroup,currentKeys,activityKeys).map(row=>({
  ...row,name:groupName(row.value,currentGroup),
  children:row.children?.map(child=>({...child,children:undefined,name:child.value,scopeName:`${groupName(row.value,currentGroup)} / ${child.value}`})),
 }))
 const exportCurrent = (keys:string[]) => <Export43 name="followup-current" sheets={()=>[{name:'Current snapshot',headers:['CRM ID','Name','Current CC',...keys.map(label)],rows:uniquePeople(keys.flatMap(k=>metrics.current[k]||[])).map(s=>[s.studentId,s.name,ownerName(s.salesOwner||'__unassigned__'),...keys.map(k=>Number(metrics.current[k]?.some(u=>u.studentId===s.studentId)))])},{name:'Scope',headers:['Scope','Value'],rows:[['Time','Current snapshot; activity dates do not apply'],['Exported UTC',dayjs.utc().toISOString()]]}]} />
 const exportSection = (section:'calls'|'followup') => <Export43 name={`followup-${section}`} sheets={()=>[
  {name:'Current snapshot',headers:['CRM ID','Name','Current CC',...(section==='calls'?CURRENT_CALL_KEYS:CURRENT_FOLLOW_KEYS).map(section==='followup'?followupLabel:label)],rows:uniquePeople((section==='calls'?CURRENT_CALL_KEYS:CURRENT_FOLLOW_KEYS).flatMap(k=>metrics.current[k]||[])).map(s=>[s.studentId,s.name,ownerName(s.salesOwner||'__unassigned__'),...(section==='calls'?CURRENT_CALL_KEYS:CURRENT_FOLLOW_KEYS).map(k=>Number(metrics.current[k]?.some(u=>u.studentId===s.studentId)))])},
  {name:'Period user metrics',headers:['CRM ID','Name','Current CC',...(section==='calls'?ACTIVITY_CALL_KEYS:ACTIVITY_FOLLOW_KEYS).map(section==='followup'?followupLabel:label)],rows:uniquePeople((section==='calls'?ACTIVITY_CALL_KEYS:ACTIVITY_FOLLOW_KEYS).flatMap(k=>metrics.activity[k])).map(s=>[s.studentId,s.name,ownerName(s.salesOwner||'__unassigned__'),...(section==='calls'?ACTIVITY_CALL_KEYS:ACTIVITY_FOLLOW_KEYS).map(k=>Number(metrics.activity[k].some(u=>u.studentId===s.studentId)))])},
  ...(section==='calls'?[{name:'Calls',headers:['CRM ID','Call ID','Time UTC','Result','Agent'],rows:calls.filter(c=>allowed.has(c.studentId)&&activityTime(c.time)).map(c=>[c.studentId,c.id,c.time,c.result,c.agent])}]:[
   {name:'Payments',headers:['CRM ID','Order ID','Paid UTC','Currency','Amount'],rows:dashboardPaymentOrders(orders,selected,filters).map(o=>[o.studentId,o.orderId,o.paidTime,o.currency,o.paidAmount])},
  ]),
  {name:'Scope',headers:['Scope','Value'],rows:[['Current workload','Snapshot as of export; activity dates do not apply'],['Grouping',groupLabel(currentGroup)],['Activity dates UTC+7',rangeLabel],['CC',Array.isArray(filters.owner)?filters.owner.join(','):filters.owner],['Deduplication','Unique CRM users per metric, raw events are not deduplicated'],['Exported UTC',dayjs.utc().toISOString()]]},
 ]} />
 const block = (section:'calls'|'followup') => {
  const currentKeys = section==='calls'?CURRENT_CALL_KEYS:CURRENT_FOLLOW_KEYS
  const activityKeys = section==='calls'?ACTIVITY_CALL_KEYS:ACTIVITY_FOLLOW_KEYS
  return <Card className="dashboard-followup-section" title={<Space><span className="dashboard-section-index">{section==='calls'?'01':'02'}</span>{text(section==='calls'?'外呼情况':'跟进情况',section==='calls'?'Calling':'Sales follow-up')}</Space>}>
   <div className="dashboard-table-tools">
    <Radio.Group className="dashboard-dimensions" optionType="button" buttonStyle="solid" value={currentGroup} onChange={e=>setCurrentGroup(e.target.value)} options={['cc','intent','age','registrationAge'].map(value=>({value,label:groupLabel(value)}))}/>
    {exportSection(section)}
   </div>
   <MetricTable43 key={`${section}-${currentGroup}`} rows={comparisonRows(currentKeys,activityKeys)} total={{...metrics.current,...metrics.activity}} keys={[...currentKeys,...activityKeys]} currentKeys={currentKeys} labels={section==='followup'?followupLabels:undefined} firstTitle={`${groupLabel(currentGroup)} → ${section==='followup'?text('支付日期','Payment date'):text('活动日期','Activity date')}`} context={rangeLabel} orders={section==='followup'?dashboardPaymentOrders(orders,selected,filters):undefined}/>
   {section==='calls'&&<p className="dashboard-help dashboard-bottom-note">{text('展开查看每日活动；日期行的“—”表示不重复展示当前状态。期间合计按用户去重，不等于每日人数相加。','Expand for daily activity. A dash on date rows means current status is not repeated. Period totals deduplicate users across days.')}</p>}
   {section==='followup'&&<p className="dashboard-help dashboard-bottom-note">{text('前五项按当前跟进阶段统计；已支付、金额 / AOV 按所选期间的支付日期统计。展开查看每日支付，当前阶段列不重复展示。','The first five columns use current follow-up stages. Paid users and amount / AOV use payment dates in the selected period. Expand for daily payments; current stages are not repeated.')}</p>}
  </Card>
 }
 const [inventoryOpen,setInventoryOpen] = useState(false)
 return <>
 <Card className="dashboard-inventory" size="small"><div className="dashboard-inventory-row"><span className="dashboard-section-note">{text('当前线索概况','Current lead inventory')}</span>{exportCurrent(['total','assigned','unassigned','已关闭'])}{['total','assigned','unassigned','已关闭'].map(key=><div key={key}><span>{label(key)}</span>{count(metrics.current[key]||[],label(key))}</div>)}<button className="dashboard-count" onClick={()=>setInventoryOpen(!inventoryOpen)}>{text(inventoryOpen?'收起 CC 明细':'查看 CC 明细',inventoryOpen?'Hide CC details':'CC details')}</button></div>{inventoryOpen&&<MetricTable43 rows={dashboardGroupRows(metrics.current,'cc').map(row=>({...row,name:ownerName(row.id)}))} total={metrics.current} keys={['total','assigned','unassigned','已关闭']} firstTitle={groupLabel('cc')} context={text('当前线索概况','Current inventory')}/>}</Card>
 {block('calls')}{block('followup')}
 </>
}
