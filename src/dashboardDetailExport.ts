import dayjs from 'dayjs'
import type { CallRecord, LessonRecord, Order, SalesAppointment, Student } from './types'
import { CURRENT_CALL_KEYS, CURRENT_FOLLOW_KEYS, CURRENT_INVENTORY_KEYS, FUNNEL_KEYS, currentFollowStage, followupStateEvidence, outcomeReasonGroups, scheduledInstant, uniquePeople, type PeopleMetrics } from './dashboard43'
import { dashboardDate, dashboardTimestamp } from './dashboardTime'
import { isDashboardPaidOrder } from './dashboardData'
import { callDurationSeconds, isCompletedCall, providerName, uniqueCalls } from './outbound'
import { followReason5 } from './salesLifecycle'

type Text = (zh: string, en: string) => string
type Column = readonly [string, string]
export type DetailContext = { text: Text; ownerName: (id: string) => string; calls: CallRecord[] }
const common: Column[] = [['用户 ID','User ID'],['姓名','Name'],['业务线','Business line'],['用户类型','User type'],['当前 CC','Current CC'],['当前 CC 账号','Current CC account'],['注册时间','Registration time'],['注册日期','Registration date'],['用户状态','User status']]
const state: Column[] = [['当前销售阶段','Current sales stage'],['跟进进度','Follow-up progress'],['最近跟进时间','Latest follow-up time'],['最近跟进备注','Latest follow-up note']]
const money: Column[] = [['有效已支付订单数','Valid paid orders'],['币种','Currency'],['用户实付金额合计','User amount paid']]
const flags = (names: Column[]): Column[] => names.map(([zh,en])=>[`${zh}（0/1）`,`${en} (0/1)`])
const inventoryFlags = flags([['当前销售线索','Current sales leads'],['已分配','Assigned'],['未分配','Unassigned'],['已拒绝','Rejected'],['已结束','Closed'],['暂不跟进','Paused']])
const callFlags = flags([['待外呼','Call pending'],['未接通 · 待跟进','Not reached'],['已拒绝','Rejected'],['外呼人数','Users called'],['接通人数','Users connected']])
const followFlags = flags([['待预约','Appointment pending'],['已预约','Booked'],['未出勤','No show'],['咨询未完成','Consultation incomplete'],['咨询已完成','Consultation completed'],['已结束','Closed'],['已支付','Paid']])
const businessTime: Column[] = [['状态统计口径','State date scope'],['状态业务日期','State business date'],['状态业务时间','State business time'],['状态时间依据','State time source'],['关联预约 ID','Linked appointment ID']]
export const DETAIL_SCHEMAS = {
 conversion: { name: ['转化用户明细','Conversion users'], columns: [...common,...flags([['线索数（含已付费）','Leads'],['外呼人数','Users called'],['接通人数','Users connected'],['预约人数','Users booked'],['体验课完成人数','Trial completed'],['已支付人数','Paid users']]),['首次有效外呼时间','First completed call'],['首次接通时间','First connected call'],['首次预约创建时间','First booking creation'],['首次体验课完成时间','First trial completion'],['首次有效支付时间','First valid payment'],...money] },
 inventory: { name: ['当前线索用户明细','Current lead users'], columns: [...common,...state,...inventoryFlags] },
 calling: { name: ['外呼用户明细','Calling users'], columns: [...common,...state,...callFlags,['期间首次外呼时间','First call in period'],['期间最近外呼时间','Latest call in period'],['期间首次接通时间','First connection in period'],['期间最近接通时间','Latest connection in period']] },
 followup: { name: ['跟进用户明细','Follow-up users'], columns: [...common,...state,...followFlags,...businessTime,['期间首次支付时间','First payment in period'],['期间最近支付时间','Latest payment in period'],...money] },
 calls: { name: ['通话记录明细','Call records'], columns: [...common,['通话 ID','Call ID'],['外呼系统','Calling system'],['第三方通话 ID','Provider call ID'],['线路 ID','Route ID'],['线路名称','Route name'],['坐席','Seat'],['操作人','Agent'],['起呼时间','Call start time'],['通话日期','Call date'],['接通时间','Answered time'],['结束时间','Ended time'],['通话状态','Call status'],['通话结果','Call result'],['接通时长（秒）','Talk time (seconds)'],['结束原因','End reason'],['同步时间','Synced time'],['通话备注','Call note']] },
 appointments: { name: ['预约记录明细','Appointment records'], columns: [...common,['预约 ID','Appointment ID'],['预约创建时间','Booking creation time'],['预约上课时间','Scheduled lesson time'],['预约上课日期','Scheduled lesson date'],['预约状态','Booking status'],['出勤状态','Attendance status'],['咨询状态','Consultation status'],['原因','Reason'],['预约备注','Booking note'],['创建人','Created by'],['更新时间','Updated time'],['更新人','Updated by']] },
 lessons: { name: ['体验课记录明细','Trial lesson records'], columns: [...common,['课程记录 ID','Lesson record ID'],['课标','Course label'],['课程名称','Course name'],['课程类型','Lesson type'],['课程状态','Lesson status'],['老师','Teacher'],['上课时间','Lesson start time'],['完课时间','Completion time'],['完课日期','Completion date']] },
 orders: { name: ['支付订单明细','Paid order records'], columns: [...common,['订单 ID','Order ID'],['商品名称','Product name'],['订单状态','Order status'],['原价','Original price'],['实付金额','Amount paid'],['币种','Currency'],['支付方式','Payment method'],['支付时间','Payment time'],['支付日期','Payment date'],['有效期截止时间','Valid until']] },
 reasons: { name: ['原因用户明细','Reason users'], columns: [...common,['当前销售阶段','Current sales stage'],['原因分类','Reason category'],['具体原因','Reason detail'],['拒绝或结束时间','Rejection or closure time'],['拒绝或结束日期','Rejection or closure date'],['时间依据','Time source'],['最近跟进时间','Latest follow-up time'],['最近跟进备注','Latest follow-up note']] },
} satisfies Record<string,{name:Column;columns:Column[]}>
export type DetailSchema = keyof typeof DETAIL_SCHEMAS
export const detailHeaders = (key: DetailSchema, text: Text) => DETAIL_SCHEMAS[key].columns.map(c=>text(c[0],c[1]))
const sheet = (key: DetailSchema, rows: unknown[][], ctx: DetailContext) => ({name:ctx.text(...DETAIL_SCHEMAS[key].name),headers:detailHeaders(key,ctx.text),rows})
const time = (value?: string) => value && dayjs.utc(value).isValid() ? dashboardTimestamp(value) : ''
const date = (value?: string) => value && dayjs.utc(value).isValid() ? dashboardDate(value) : ''
const firstLast = (values: (string | undefined)[]) => { const sorted=values.filter((v):v is string=>!!v&&dayjs.utc(v).isValid()).sort((a,b)=>dayjs.utc(a).valueOf()-dayjs.utc(b).valueOf());return [time(sorted[0]),time(sorted[sorted.length-1])] }
const user = (s: Student, ctx: DetailContext) => [s.studentId,s.name,s.businessLine,s.userType,ctx.ownerName(s.salesOwner||'__unassigned__'),s.salesOwner||'',time(s.registerTime),date(s.registerTime),s.status]
const stateValues = (s: Student, ctx: DetailContext) => [currentFollowStage(s,ctx.calls),s.salesProgress||'',time(s.salesUpdatedAt),s.salesLatestNote||'']
const metricValues = (s: Student, metrics: PeopleMetrics, keys: readonly string[]) => keys.map(k=>Number((metrics[k]||[]).some(p=>p.studentId===s.studentId)))
const peopleFor = (metrics: PeopleMetrics, keys: readonly string[]) => uniquePeople(keys.flatMap(k=>metrics[k]||[]))
const userMoney = (orders: Order[]) => { const currencies=[...new Set(orders.map(o=>o.currency?.trim()||''))]; return [orders.length,currencies.join(', '),currencies.length>1||currencies.includes('')?'':orders.reduce((n,o)=>n+o.paidAmount,0)] }

export function callDetailSheet(people: Student[], records: CallRecord[], ctx: DetailContext) {
 const byId=new Map(people.map(s=>[s.studentId,s]));
 return sheet('calls',uniqueCalls(records).filter(c=>isCompletedCall(c)&&byId.has(c.studentId)).map(c=>[...user(byId.get(c.studentId)!,ctx),c.id,providerName(c.provider,ctx.text('中','en')==='en'),c.providerCallId||'',c.routeId||'',c.routeName||'',c.seat||'',c.agent,time(c.time),date(c.time),time(c.answeredAt),time(c.endedAt),c.callStatus||ctx.text('历史已完结','Historical completed'),c.result,callDurationSeconds(c),c.endReason||'',time(c.syncedAt),c.note]),ctx)
}
export function appointmentDetailSheet(records: {student:Student;appointment:SalesAppointment}[], ctx: DetailContext) {
 return sheet('appointments',records.map(({student:s,appointment:a})=>{const instant=scheduledInstant(a)?.toISOString();return [...user(s,ctx),a.appointmentId,time(a.createdAt),time(instant),date(instant),a.appointmentStatus,a.attendanceStatus,a.consultationStatus,a.reason||'',a.note||'',a.createdBy,time(a.updatedAt),a.updatedBy||'']}),ctx)
}
export function orderDetailSheet(people: Student[], orders: Order[], ctx: DetailContext) {
 const byId=new Map(people.map(s=>[s.studentId,s]));
 return sheet('orders',orders.filter(o=>isDashboardPaidOrder(o)&&byId.has(o.studentId)).map(o=>[...user(byId.get(o.studentId)!,ctx),o.orderId,o.productName,o.orderStatus,o.originalPrice,o.paidAmount,o.currency,o.payMethod,time(o.paidTime),date(o.paidTime),time(o.validUntil)]),ctx)
}
export function conversionDetailSheets(metrics: PeopleMetrics, calls: CallRecord[], lessons: LessonRecord[], orders: Order[], ctx: DetailContext, now=Date.now()) {
 const byId=new Map(metrics.leads.map(s=>[s.studentId,s]));
 const valid=(id:string,t?:string)=>!!t&&byId.has(id)&&dayjs.utc(t).isValid()&&dayjs.utc(t).valueOf()>=dayjs.utc(byId.get(id)!.registerTime).valueOf()&&dayjs.utc(t).valueOf()<=now;
 const cs=uniqueCalls(calls).filter(c=>isCompletedCall(c)&&valid(c.studentId,c.time));
 const appointments=metrics.leads.flatMap(student=>(student.salesAppointments||[]).filter(a=>valid(student.studentId,a.createdAt)).map(appointment=>({student,appointment})));
 const ls=lessons.filter(l=>l.lessonType==='体验课'&&l.status==='已完课'&&valid(l.studentId,l.completedAt));
 const os=orders.filter(o=>isDashboardPaidOrder(o)&&valid(o.studentId,o.paidTime));
 return [sheet('conversion',metrics.leads.map(s=>{const paid=os.filter(o=>o.studentId===s.studentId);return [...user(s,ctx),...metricValues(s,metrics,FUNNEL_KEYS),firstLast(cs.filter(c=>c.studentId===s.studentId).map(c=>c.time))[0],firstLast(cs.filter(c=>c.studentId===s.studentId&&c.result==='已接通').map(c=>c.time))[0],firstLast(appointments.filter(a=>a.student.studentId===s.studentId).map(a=>a.appointment.createdAt))[0],firstLast(ls.filter(l=>l.studentId===s.studentId).map(l=>l.completedAt))[0],firstLast(paid.map(o=>o.paidTime))[0],...userMoney(paid)]}),ctx),callDetailSheet(metrics.leads,cs,ctx),appointmentDetailSheet(appointments,ctx),sheet('lessons',ls.map(l=>[...user(byId.get(l.studentId)!,ctx),l.id,l.courseLabel,l.courseName||'',l.lessonType,l.status,l.teacher||'',time(l.startedAt),time(l.completedAt),date(l.completedAt)]),ctx),orderDetailSheet(metrics.leads,os,ctx)]
}
export const inventoryDetailSheet = (metrics: PeopleMetrics, ctx: DetailContext) => sheet('inventory',peopleFor(metrics,CURRENT_INVENTORY_KEYS).map(s=>[...user(s,ctx),...stateValues(s,ctx),...metricValues(s,metrics,CURRENT_INVENTORY_KEYS)]),ctx)
export function callingDetailSheets(current: PeopleMetrics, activity: PeopleMetrics, calls: CallRecord[], ctx: DetailContext) {
 const keys=[...CURRENT_CALL_KEYS,'called','connected'], metrics={...current,...activity}, people=peopleFor(metrics,keys), valid=uniqueCalls(calls).filter(isCompletedCall);
 return [sheet('calling',people.map(s=>{const cs=valid.filter(c=>c.studentId===s.studentId);return [...user(s,ctx),...stateValues(s,ctx),...metricValues(s,metrics,keys),...firstLast(cs.map(c=>c.time)),...firstLast(cs.filter(c=>c.result==='已接通').map(c=>c.time))]}),ctx),callDetailSheet(people,valid,ctx)]
}
export function followupDetailSheets(current: PeopleMetrics, activity: PeopleMetrics, orders: Order[], ctx: DetailContext) {
 const keys=[...CURRENT_FOLLOW_KEYS,'paid'], metrics={...current,paid:activity.paid}, people=peopleFor(metrics,keys);
 const appointments:{student:Student;appointment:SalesAppointment}[]=[];
 const rows=people.map(s=>{const matchingState=CURRENT_FOLLOW_KEYS.find(k=>(current[k]||[]).some(p=>p.studentId===s.studentId));const evidence=matchingState?followupStateEvidence(s,ctx.calls,matchingState):undefined;const a=s.salesAppointments?.find(a=>a.appointmentId===evidence?.appointmentId);if(a)appointments.push({student:s,appointment:a});const paid=orders.filter(o=>o.studentId===s.studentId);return [...user(s,ctx),...stateValues(s,ctx),...metricValues(s,metrics,keys),...(evidence?[matchingState==='已接通待预约'?ctx.text('当前状态','Current status'):ctx.text('所选期间','Selected period'),matchingState==='已接通待预约'?'':date(evidence.time),time(evidence.time),evidence.source,evidence.appointmentId]:['','','','','']),...firstLast(paid.map(o=>o.paidTime)),...userMoney(paid)]});
 return [sheet('followup',rows,ctx),appointmentDetailSheet(appointments,ctx),orderDetailSheet(people,orders,ctx)]
}
export function reasonDetailSheet(people: Student[], metric:'已拒绝'|'已关闭', reasonLabel:(reason:string)=>string, ctx: DetailContext) {
 return sheet('reasons',outcomeReasonGroups(people).flatMap(group=>group.users.map(s=>{
  const evidence=metric==='已关闭'?followupStateEvidence(s,ctx.calls,metric):undefined;
  const histories=[...(s.salesHistory||[])].filter(h=>h.stage5&&dayjs.utc(h.time).isValid()&&dayjs.utc(h.time).valueOf()<=Date.now()).sort((a,b)=>dayjs.utc(b.time).valueOf()-dayjs.utc(a.time).valueOf());
  const run:typeof histories=[];for(const h of histories){if(h.stage5!=='Rejected')break;run.push(h)}
  const rejected=(s.salesLifecycleEvents||[]).filter(e=>['Rejected','已拒绝'].includes(e.result)).sort((a,b)=>dayjs.utc(b.occurredAt||b.reportedAt).valueOf()-dayjs.utc(a.occurredAt||a.reportedAt).valueOf())[0];
  const at=evidence?.time||rejected?.occurredAt||rejected?.reportedAt||run[run.length-1]?.time;
  return [...user(s,ctx),metric,reasonLabel(group.reason),followReason5(s)||'',time(at),date(at),at?(evidence?.source||ctx.text('拒绝事件或阶段记录','Rejection event or stage record')):'',time(s.salesUpdatedAt),s.salesLatestNote||''];
 })),ctx)
}
