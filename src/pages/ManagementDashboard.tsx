import { isCompletedCall, uniqueCalls } from '../outbound'
import { useState } from 'react'
import { Button, Card, DatePicker, Modal, Select, Space, Tag, Typography } from 'antd'
import { useSearchParams } from 'react-router-dom'
import dayjs from 'dayjs'
import { salesBusinessLineOptions } from '../channel'
import { resolveUserType } from '../userType'
import { useStore } from '../store'
import { usePerm } from '../perm'
import { dashboardCCAccounts, dashboardOwnerIds, dashboardPopulation, type DashboardFilters } from '../dashboardData'
import { dashboardView, dashboardViewRange, dashboardSwitchView, DASHBOARD_VIEWS, type DashboardView } from '../dashboardView'
import DashboardPayments from '../components/DashboardPayments'
import DashboardConversion43 from '../components/DashboardConversion43'
import DashboardFollowup43 from '../components/DashboardFollowup43'
import { useDashboard43 } from '../components/Dashboard43Shared'
import './ManagementDashboard.css'

export default function ManagementDashboard() {
 const { text,ownerName }=useDashboard43()
 const { allowedLines,actor }=usePerm()
 const students=useStore(s=>s.students)
 const accounts=useStore(s=>s.accounts)
 const roles=useStore(s=>s.roles)
 const channels=useStore(s=>s.channels)
 const rawCalls=useStore(s=>s.callRecords??[])
 const calls=uniqueCalls(rawCalls).filter(isCompletedCall)
 const lessons=useStore(s=>s.lessons??[])
 const orders=useStore(s=>s.orders)
 const [query,setQuery]=useSearchParams()
 const [rulesOpen,setRulesOpen]=useState(false)
 const view=dashboardView(query)
 const range=dashboardViewRange(query,view)
 const valid=(value:string)=>/^\d{4}-\d{2}-\d{2}$/.test(value)&&dayjs(value).isValid()?value:''
 const filters:DashboardFilters={mode:view==='cohort'?'current':'period',start:valid(range.start),end:valid(range.end),owner:dashboardOwnerIds(query.getAll('cc')),userType:'正式用户'}
 const scope=allowedLines()
 const lines=dashboardOwnerIds(query.getAll('line'))
 const lineOptions=salesBusinessLineOptions(channels,students).filter(line=>scope===null||scope.includes(line))
 const lineLabel=lines.length?lines.join(' / '):text('全部授权业务线','All permitted business lines')
 const scopedPopulation=dashboardPopulation(students,scope,true,actor,lines,channels)
 const population=scopedPopulation.filter(s=>resolveUserType(s)==='正式用户')
 const ownerIds=['__unassigned__',...dashboardCCAccounts(accounts,roles,lineOptions.filter(line=>!lines.length||lines.includes(line)),scopedPopulation).map(account=>account.email)].sort()
 const owners=dashboardOwnerIds(filters.owner)
 const title=(v:DashboardView)=>v==='cohort'?text('转化总览','Conversion overview'):v==='followup'?text('销售跟进','Sales follow-up'):text('支付结果','Payments')
 const subtitle=(v:DashboardView)=>v==='cohort'?text('同一注册批次的六项转化','Six milestones for one registration cohort'):v==='followup'?text('外呼与跟进情况','Calls and follow-up'):text('支付人数、收入与 AOV','Payers, revenue and AOV')
 const dateTitle=view==='cohort'?text('注册日期','Registration dates'):view==='followup'?text('活动日期','Activity dates'):text('支付日期','Payment dates')
 const rangeLabel=filters.start&&filters.end?`${filters.start} — ${filters.end}`:text('全部日期','All dates')
 const change=(values:Record<string,string|string[]>)=>{const next=new URLSearchParams(query);next.set('view',view);next.set('start',filters.start);next.set('end',filters.end);Object.entries(values).forEach(([key,value])=>{next.delete(key);(Array.isArray(value)?value:[value]).filter(Boolean).forEach(v=>next.append(key,v))});setQuery(next)}
 const today=dayjs().utcOffset(420)
 const shared={population,calls,lessons,orders,filters,rangeLabel}
 return <div className="management-dashboard">
 <header className="dashboard-heading"><div><Space><Tag color="blue">{lineLabel}</Tag><Tag>{text('演示数据','Demo data')}</Tag><span className="dashboard-version">{text('五期','Phase 5')}</span></Space><Typography.Title level={2}>{text('管理看板','Management dashboard')}</Typography.Title></div><Button onClick={()=>setRulesOpen(true)}>{text('统计口径','Counting rules')}</Button></header>
 <nav className="dashboard-questions" aria-label={text('看板页面','Dashboard views')}>{DASHBOARD_VIEWS.map(value=><button key={value} aria-pressed={view===value} onClick={()=>setQuery(dashboardSwitchView(query,value))}><strong>{title(value)}</strong><span>{subtitle(value)}</span></button>)}</nav>
 <Card className="dashboard-filters"><Space wrap size={16}><Select mode="multiple" allowClear showSearch optionFilterProp="label" aria-label={text('业务线','Business line')} placeholder={text('全部授权业务线','All permitted business lines')} value={lines} style={{minWidth:220,maxWidth:'100%'}} onChange={values=>change({line:values,cc:[]})} options={lineOptions.map(value=>({value,label:value}))}/><Select mode="multiple" allowClear showSearch optionFilterProp="label" aria-label={text('当前 CC','Current CC')} placeholder={text('全部 CC','All CCs')} value={owners} style={{minWidth:220,maxWidth:'100%'}} onChange={values=>change({cc:values})} options={ownerIds.map(value=>({value,label:ownerName(value)}))}/><div className="dashboard-date"><span>{dateTitle}</span><DatePicker.RangePicker aria-label={dateTitle} value={filters.start&&filters.end?[dayjs(filters.start),dayjs(filters.end)]:null} placeholder={[text('全部日期','All dates'),text('全部日期','All dates')]} presets={[{label:text('今天','Today'),value:[today,today]},{label:text('近 7 天','Last 7 days'),value:[today.subtract(6,'day'),today]},{label:text('本月','This month'),value:[today.startOf('month'),today]}]} onChange={v=>change({start:v?.[0]?.format('YYYY-MM-DD')||'',end:v?.[1]?.format('YYYY-MM-DD')||''})}/></div>{(lines.length>0||owners.length>0||filters.start||filters.end)&&<Button type="text" onClick={()=>change({line:[],cc:[],start:'',end:''})}>{text('重置筛选','Reset filters')}</Button>}</Space><p className="dashboard-help">{view==='cohort'?text('注册日期选定同一批线索，后续结果统计至当前。','Registration dates select the cohort; subsequent outcomes are counted to date.'):view==='followup'?text('活动日期仅作用于所选期间的活动；当前待处理截至当前。','Activity dates apply to period activity; current workload always shows the present state.'):text('按订单支付日期统计，币种分别展示。','Based on payment dates; currencies are shown separately.')} <span>UTC+7</span></p></Card>
 {view==='cohort'&&<DashboardConversion43 {...shared}/>}
 {view==='followup'&&<DashboardFollowup43 {...shared}/>}
 {view==='payments'&&<DashboardPayments population={population} orders={orders} filters={filters} rangeLabel={rangeLabel}/>}
 <p className="dashboard-footnote">{text('演示数据与销售、用户、订单中心共用；尚未连接正式业务数据。CC 均按当前归属统计。','Demo data is shared with Sales, User and Order Centers. No production database is connected. CC grouping uses current ownership.')}</p>
 <Modal title={text('统计口径','Counting rules')} open={rulesOpen} onCancel={()=>setRulesOpen(false)} footer={<Button onClick={()=>setRulesOpen(false)}>{text('关闭','Close')}</Button>}>
 <p>{text('范围：所选业务线、正式用户和当前账号可见数据。业务线选项与销售中心一致，清空表示全部授权业务线。所有人数按 CRM 用户 ID 去重。','Scope: formal users in the selected business lines visible to the current account. Options match Sales Center; clearing selects all permitted lines. All user counts deduplicate by CRM user ID.')}</p>
 <p>{text('转化总览：同一注册批次的线索、有效外呼、接通、预约、体验课完成、已支付人数。结果须发生在注册后，不要求在注册筛选期间内；各环节独立，允许跳步。','Conversion: leads, valid calls, connections, bookings, completed trials and payers within one registration cohort. Outcomes must follow registration, but may occur after the registration date range. Steps are independent.')}</p>
 <p>{text('L2S = 已支付人数 ÷ 线索数；无线索显示 —。体验课完成需真实体验课完课记录，不由销售预约或咨询状态推断。','L2S = paid users / leads, or — when there are no leads. Trial completion requires a completed trial lesson record; appointment and consultation statuses cannot substitute for it.')}</p>
 <p>{text('销售跟进：按线索当前状态去重统计待处理、已拒绝、已结束和暂不跟进人数；重新激活的线索不再计入已拒绝或已结束。活动日期不影响当前状态人数和原因分布；所选期间的外呼、接通按通话日期统计，已支付人数、实付金额及 AOV 按支付日期统计。','Follow-up counts distinct users by their current status, including leads awaiting action, rejected, closed and paused leads. Reactivated leads are no longer counted as rejected or closed. Activity dates do not affect current status counts or reason breakdowns; calls and connections use call dates, while paid users, paid amounts and AOV use payment dates in the selected period.')}</p>
 <p>{text('跟进情况按当前有效预约的上课日期（UTC+7）分组，未预约和日期缺失单列；日期分组不改变当前状态或所选期间支付的统计范围。','Follow-up groups users by the scheduled date of their current active appointment (UTC+7), with separate groups for not booked and missing dates. Grouping does not change the scope of current statuses or payments in the selected period.')}</p>
 <p>{text('支付只认有效已支付、实付大于 0 的订单；不同币种不相加。AOV = 实付金额 ÷ 已支付订单数。数据导出沿用当前权限和对应区块筛选。','Payment requires valid paid orders with positive amounts. Currencies are never added together. AOV = paid amount / paid orders. Exports respect permissions and the scope of their section.')}</p>
 </Modal>
 </div>
}
