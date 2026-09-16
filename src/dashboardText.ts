import { useI18n } from './i18n'
const words = {
 title: ['销售管理看板', 'Sales management dashboard'],
 subtitle: ['查看整体跟进情况，按 CC 查看同一组指标，并进入对应用户处理。', 'Review sales activity, compare the same metrics by CC, and open each user to take action.'],
 current: ['当前跟进', 'Current follow-up'], period: ['期间记录', 'Period activity'],
 currentHelp: ['按注册日期选择当前销售线索，查看其现在的跟进阶段。每位用户只属于一个阶段。', 'Filter current sales leads by registration date and view their stage now. Each user belongs to one stage.'],
 periodHelp: ['分别统计所选日期内有记录的用户，按用户 ID 去重。同一用户可出现在多项指标中，不能用这些人数计算转化率。', 'Count distinct users with records in the selected dates. A user may appear in several metrics; these counts do not form a conversion funnel.'],
 demo: ['原型演示数据，与销售、用户和订单中心共用。未连接测试或正式数据库。', 'Demo data shared with Sales, User and Order Centers. No test or production database is connected.'],
 allCC: ['全部 CC', 'All CCs'], unassigned: ['未分配', 'Unassigned'], assigned: ['已分配', 'Assigned'], total: ['销售线索', 'Sales leads'],
 allTypes: ['全部用户类型', 'All user types'], allDates: ['全部日期', 'All dates'],
 registerDates: ['注册日期', 'Registration dates'], recordDates: ['记录日期', 'Record dates'],
 stageTitle: ['当前跟进阶段', 'Current follow-up stage'], stageHelp: ['与销售中心三期使用相同的跟进阶段。点击人数查看用户。', 'Uses the same stages as Sales Center Phase 3. Select a count to view users.'],
 ccTitle: ['按 CC 查看', 'By CC'], ccHelp: ['按当前归属 CC 拆分上方指标，未分配用户单独列出。', 'The same metrics grouped by current CC. Unassigned users appear separately.'],
 registered: ['新注册线索', 'New leads'], called: ['外呼用户', 'Users called'], connected: ['接通用户', 'Users reached'], booked: ['创建预约用户', 'Users with bookings'], attended: ['登记出席用户', 'Attendance recorded'], completed: ['登记咨询完成用户', 'Consultations recorded'],
 periodNote: ['注册按注册时间、外呼和接通按通话时间、预约按创建时间；出席和咨询完成按登记时间统计。未记录的历史结果无法补算。', 'Registration uses registration time; calls use call time; bookings use creation time. Attendance and consultation completion use the time recorded. Missing historical records cannot be reconstructed.'],
 unavailable: ['暂不展示历史转化率、付费转化率和 CC 付费排名。', 'Historical conversion rates, paid conversion and CC payment rankings are not included.'],
 users: ['用户明细', 'User details'], count: ['位用户', 'users'], currentCC: ['当前 CC', 'Current CC'], salesAction: ['销售跟进', 'Sales follow-up'], userAction: ['用户详情', 'User details'], orderAction: ['用户订单', 'User orders'],
 back: ['返回管理看板', 'Back to dashboard'], clear: ['清除用户筛选', 'Clear user filter'],
 filtered: ['已按用户 ID 筛选', 'Filtered by User ID'], noRows: ['暂无符合条件的用户，请调整日期、用户类型或 CC。', 'No matching users. Try changing the dates, user type or CC.'],
 noOrders: ['该用户暂无符合条件的订单。', 'No matching orders for this user.'],
 orderDetail: ['订单详情', 'Order details'], orderTransactions: ['订单流水', 'Order transactions'], backOrders: ['返回订单中心', 'Back to Order Center'],
 ordersIntro: ['点击订单 ID 查看订单详情及全部交易流水。', 'Select an order ID to view its details and all transactions.'],
 noOrder: ['未找到该订单，或你没有访问权限。', 'This order was not found or you do not have access.'],
 subOrder: ['子订单号', 'Transaction ID'], recordTime: ['发生时间', 'Time'], amount: ['金额', 'Amount'],
 export: ['导出列表', 'Export list'],
} as const
export type DashboardWord = keyof typeof words
export function useDashboardText() {
 const { lang } = useI18n()
 return (key: DashboardWord) => words[key][lang === 'zh' || lang === 'zhTW' ? 0 : 1]
}
