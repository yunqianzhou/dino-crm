import { Card, Radio, Space, Tag } from 'antd'
import { useSearchParams } from 'react-router-dom'
import dayjs from 'dayjs'
import type { CallRecord, LessonRecord, Order, Student } from '../types'
import { cohortFunnel, FUNNEL_KEYS, l2s, metricGroups } from '../dashboard43'
import { dashboardPaymentOrders, type DashboardFilters } from '../dashboardData'
import { Export43, MetricTable43, rateText, useDashboard43, type MetricRow43 } from './Dashboard43Shared'

type Props = { population:Student[]; calls:CallRecord[]; lessons:LessonRecord[]; orders:Order[]; filters:DashboardFilters; rangeLabel:string }
export default function DashboardConversion43({ population,calls,lessons,orders,filters,rangeLabel }: Props) {
 const { text,label,count,ownerName } = useDashboard43()
 const [query,setQuery] = useSearchParams()
 const metrics = cohortFunnel(population,calls,lessons,orders,filters)
 const primary = query.get('conversionPrimary') === 'cc' ? 'cc' : 'date'
 const secondary = query.get('conversionSecondary') !== ''
 const dimension = (key:string) => key === 'cc' ? text('当前 CC','Current CC') : text('注册日期','Registration date')
 const rowName = (value:string,key:string) => key === 'cc' ? ownerName(value) : value
 const rows:MetricRow43[] = metricGroups(metrics,primary).map(row => ({...row,name:rowName(row.name,primary), children:secondary ? metricGroups(row.metrics,primary==='cc'?'date':'cc').map(child => ({...child,id:JSON.stringify([row.id,child.id]),name:rowName(child.name,primary==='cc'?'date':'cc')})) : undefined }))
 const change = (values:Record<string,string>) => {const next = new URLSearchParams(query);Object.entries(values).forEach(([k,v]) => next.set(k,v));setQuery(next)}
 const metricIds = Object.fromEntries(FUNNEL_KEYS.map(k => [k,new Set(metrics[k].map(s => s.studentId))]))
 const evidence = (id:string,time?:string) => { const s = metrics.leads.find(s => s.studentId===id); return !!s && !!time && dayjs.utc(time).isValid() && dayjs.utc(time).valueOf() >= dayjs.utc(s.registerTime).valueOf() && dayjs.utc(time).valueOf() <= Date.now() }
 const paidOrders = dashboardPaymentOrders(orders,metrics.leads,{...filters,start:'',end:''}).filter(o=>evidence(o.studentId,o.paidTime))
 const context = `${text('注册日期','Registration dates')}: ${rangeLabel}`
 const exportButton = (section: 'cohort' | 'details') => <Export43 name={`conversion-${section}`} disabled={!metrics.leads.length} sheets={() => [
  {name:text('用户指标','User metrics'),headers:['CRM ID',text('姓名','Name'),text('当前 CC','Current CC'),text('注册时间 UTC','Registered UTC'),text('注册日期 UTC+7','Registration date UTC+7'),text('当前 CC 账号','Current CC account'),...FUNNEL_KEYS.map(label)],rows:metrics.leads.map(s=>[s.studentId,s.name,ownerName(s.salesOwner||'__unassigned__'),s.registerTime,dayjs.utc(s.registerTime).utcOffset(420).format('YYYY-MM-DD'),s.salesOwner||'__unassigned__',...FUNNEL_KEYS.map(k=>Number(metricIds[k].has(s.studentId)))])},
  {name:text('通话','Calls'),headers:['CRM ID','Call ID','Result','Time UTC','Agent'],rows:calls.filter(c=>evidence(c.studentId,c.time)).map(c=>[c.studentId,c.id,c.result,c.time,c.agent])},
  {name:text('预约','Bookings'),headers:['CRM ID','Appointment ID','Created UTC','Scheduled local','Timezone','Status','Attendance'],rows:metrics.leads.flatMap(s=>(s.salesAppointments||[]).filter(a=>evidence(s.studentId,a.createdAt)).map(a=>[s.studentId,a.appointmentId,a.createdAt,a.scheduledStartAt,a.timezone,a.appointmentStatus,a.attendanceStatus]))},
  {name:text('体验课','Trial lessons'),headers:['CRM ID','Lesson ID','Course','Status','Completed UTC'],rows:lessons.filter(l=>l.lessonType==='体验课'&&l.status==='已完课'&&evidence(l.studentId,l.completedAt)).map(l=>[l.studentId,l.id,l.courseLabel,l.status,l.completedAt])},
  {name:text('支付','Payments'),headers:['CRM ID','Order ID','Paid UTC','Currency','Amount'],rows:paidOrders.map(o=>[o.studentId,o.orderId,o.paidTime,o.currency,o.paidAmount])},
  {name:text('统计范围','Scope'),headers:['Scope','Value'],rows:[['Section',section==='details'?'Conversion details':'Registration cohort funnel'],['First grouping',dimension(primary)],['Second grouping',secondary?dimension(primary==='cc'?'date':'cc'):text('不再细分','No subgroup')],['Export range','All matching records, independent of pagination, sorting and expanded rows'],['Registration dates UTC+7',rangeLabel],['CC',Array.isArray(filters.owner)?filters.owner.join(','):filters.owner],['Business line','Vietnam'],['User type','Formal'],['Deduplication','CRM user ID; each step independent'],['L2S','Paid users / Leads'],['Exported UTC',dayjs.utc().toISOString()]]},
 ]} />
 return <>
 <Card className="dashboard-funnel-card" title={text('注册批次转化漏斗','Registration cohort funnel')} extra={exportButton('cohort')}>
  <div className="dashboard-funnel-meta"><Tag color="blue">{context}</Tag><span>{text('截至当前 · 各环节按用户去重','As of now · unique users at each step')}</span></div>
  <div className="dashboard-funnel-layout"><div className="dashboard-funnel-bars">{FUNNEL_KEYS.map((key,index)=><div className={`dashboard-funnel-step step-${index}`} key={key}>
   <div className="dashboard-funnel-label"><small>{String(index+1).padStart(2,'0')}</small><span>{label(key)}</span></div>
   {count(metrics[key],`${context} · ${label(key)}`,key)}
   <div className="dashboard-funnel-track"><div style={{height:`${metrics.leads.length?metrics[key].length/metrics.leads.length*100:0}%`}} /></div>
  </div>)}</div><aside className="dashboard-l2s-panel"><span>{text('线索 → 付费转化率','Lead-to-paid conversion')}</span><strong>{rateText(l2s(metrics))}</strong><b>L2S</b><small>{metrics.paid.length} / {metrics.leads.length}</small><span>{text('已支付人数 ÷ 线索数','Paid users ÷ leads')}</span></aside></div>
  <p className="dashboard-help dashboard-bottom-note">{text('同一注册批次可跳过部分环节，人数不强制递减。体验课完成来自课程记录，与销售预约出席分别统计。','Users in the same cohort may skip steps. Trial completion comes from lesson records; appointment attendance is counted separately.')}</p>
 </Card>
 <Card title={text('转化明细','Conversion details')} extra={<Space wrap><span className="dashboard-section-note">{text('展开查看下一层 · 金额按币种分列','Expand for the next level · currencies shown separately')}</span>{exportButton('details')}</Space>}>
 <div className="dashboard-hierarchy-controls"><div><span>{text('先按','Group first by')}</span><Radio.Group optionType="button" buttonStyle="solid" value={primary} onChange={e=>change({conversionPrimary:e.target.value})} options={['date','cc'].map(value=>({value,label:dimension(value)}))}/></div><div><span>{text('再按','Then by')}</span><Radio.Group optionType="button" buttonStyle="solid" value={secondary?'yes':''} onChange={e=>change({conversionSecondary:e.target.value?primary==='cc'?'date':'cc':''})} options={[{value:'',label:text('不再细分','No subgroup')},{value:'yes',label:dimension(primary==='cc'?'date':'cc')}]}/></div></div>
 <MetricTable43 key={`${primary}-${secondary}`} rows={rows} total={metrics} keys={FUNNEL_KEYS} firstTitle={`${dimension(primary)}${secondary?' → '+dimension(primary==='cc'?'date':'cc'):''}`} context={context} conversion orders={paidOrders}/>
 <p className="dashboard-help dashboard-bottom-note">{text('金额 / AOV 为这批线索截至当前的有效已支付订单；不代表注册当天收入。','Amount / AOV uses valid paid orders for this cohort to date, rather than revenue on the registration day.')}</p>
 </Card>
 </>
}
