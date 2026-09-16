import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import type { Account, CallRecord, LessonRecord, Order, SalesLifecycleEvent, Student } from './types'
import { CONSULTATION_STAGES } from './salesLifecycle'

dayjs.extend(utc)
const DATASET = 'management-vietnam-v1'
const REASON_DATASET = 'management-vietnam-reasons-v1'
const demoReasons: Record<string, string[]> = {
  'No Show': ['客户未到会', '无法联系', '会议技术问题'],
  '咨询未完成': ['中途离开', '时间不足', '会议异常'],
  '暂不跟进': ['暂无需求', '暂不方便', '预算原因'],
  '已关闭': ['明确拒绝', '号码无效', '要求不联系'],
}


type DemoState = {
  students: Student[]
  accounts: Account[]
  callRecords: CallRecord[]
  orders: Order[]
  lessons: LessonRecord[]
  demoDatasets?: string[]
}

/** Synthetic prototype fixtures only. Stable IDs keep links intact across reloads. */
export function createManagementDemo(now = dayjs.utc().toISOString()): DemoState {
  const base = dayjs.utc(now).startOf('day')
  const fmt = (time: dayjs.Dayjs) => time.format('YYYY-MM-DD HH:mm:ss')
  const accounts: Account[] = ['Chloe', 'Linh', 'Thy', 'Thư', 'Thảo', 'Macie'].map((name, i) => ({
    id: `management-demo-cc-${i + 1}`, name,
    email: `cc${i + 1}@demo.example.invalid`, roleId: 'role_support',
    businessLines: ['越南'], status: '启用', outboundSeatBound: true,
  }))
  const students: Student[] = []
  const callRecords: CallRecord[] = []
  const orders: Order[] = []
  const lessons: LessonRecord[] = []
  const counts = [42, 30, 24, 24, 12, 12, 18, 12, 6]
  const stages: string[] = CONSULTATION_STAGES.flatMap((stage, index) => Array(counts[index]).fill(stage))
  stages.push(...Array(24).fill('付费'))
  const names = ['Minh Nguyen', 'An Tran', 'Bao Le', 'Linh Pham', 'Mai Hoang', 'Nam Vu', 'Lan Do', 'Khanh Bui']

  stages.forEach((stage, i) => {
    const sequence = String(i + 1).padStart(4, '0')
    const studentId = `990000000000000${sequence}`
    const owner = accounts[(i + Math.floor(i / 7)) % accounts.length]
    const unassigned = i < 24
    const registered = base.subtract(4 + i % 18, 'day').add(i % 8, 'hour')
    const called = registered.add(2, 'hour')
    const booked = called.add(1, 'hour')
    const consulted = booked.add(1, 'day')
    const paid = consulted.add(2, 'hour')
    const connected = ['已接通待预约', '已预约', '未出勤待跟进', '咨询未完成待跟进', '咨询完成待支付', '付费'].includes(stage)
    const hasAppointment = ['已预约', '未出勤待跟进', '咨询未完成待跟进', '咨询完成待支付', '付费'].includes(stage)
    const attended = ['咨询未完成待跟进', '咨询完成待支付', '付费'].includes(stage)
    const completed = ['咨询完成待支付', '付费'].includes(stage)
    const student: Student = {
      studentId, name: `${names[i % names.length]} ${sequence}`, localName: `${names[i % names.length]} ${sequence}`,
      userType: '正式用户', loginMethod: 'AppID', account: `demo-user-${sequence}@example.invalid`,
      // Deliberately invalid contact numbers; AppID accounts use the explicit userType field.
      phone: `+8400000${sequence}`, countryCode: '+84', businessLine: '越南', country: '越南',
      registerChannel: '演示 / Demo', channelCode: '', registerTime: fmt(registered),
      status: stage === '付费' ? '付费' : '未付费-未体验',
      paymentStatusStr: stage === '付费' ? '已付费' : '未付费',
      ageGroup: ['3-5', '6-8', '9-12'][i % 3] as Student['ageGroup'], courseLevel: `L${i % 3 + 1}`,
      salesOwner: unassigned ? undefined : owner.email,
      salesProgress: unassigned ? '待领取' : stage === '暂不跟进' ? '暂不跟进' : '跟进中',
      salesLifecycleStatus: stage === '已关闭' ? '已关闭' : '进行中',
      purchaseIntention: stage === '已关闭' ? '无意向' : connected ? '有意向' : '未填写',
      salesLatestNote: '演示记录，可用于查看跟进和明细。 / Demo record for follow-up and detail review.',
      salesUpdatedAt: fmt(hasAppointment && stage !== '已预约' ? consulted : called),
      salesHistory: [], salesAppointments: [], salesLifecycleEvents: [],
      landingEnglishLevel: 'Beginner', landingLearningGoal: 'Speaking practice',
    }
    const event = (node: SalesLifecycleEvent['node'], result: string, time: dayjs.Dayjs, appointmentId?: string) => {
      student.salesLifecycleEvents!.push({ eventId: `management-demo-event-${sequence}-${student.salesLifecycleEvents!.length}`,
        node, result, reason: demoReasons[result]?.[i % 3], description: '演示 / Demo', appointmentId,
        occurredAt: fmt(time), reportedAt: fmt(time), reportedBy: owner.email, source: 'CC手动' })
    }
    if (stage !== '待外呼') {
      const call: CallRecord = { id: `management-demo-call-${sequence}`, studentId, customer: student.name,
        phone: student.phone!, businessLine: '越南', result: connected ? '已接通' : '无人接听',
        duration: connected ? `0${2 + i % 6}:${String(i % 60).padStart(2, '0')}` : '—',
        note: '演示通话 / Demo call', agent: owner.email, time: fmt(called) }
      callRecords.push(call)
      event('outbound', call.result, called)
    } else if (!unassigned) {
      student.landingCallbackAt = fmt(base.add(1, 'day').add(i % 8, 'hour'))
    }
    if (hasAppointment) {
      const appointmentId = `management-demo-appointment-${sequence}`
      const scheduled = stage === '已预约' ? base.add(1 + i % 3, 'day').add(3, 'hour') : consulted
      student.salesAppointments!.push({ appointmentId,
        scheduledStartAt: scheduled.utcOffset(7 * 60).format('YYYY-MM-DD HH:mm:ss'), timezone: 'Asia/Ho_Chi_Minh',
        appointmentStatus: '已预约', attendanceStatus: attended ? '已出勤' : stage === '未出勤待跟进' ? 'No Show' : '待标记',
        consultationStatus: completed ? '已完成' : stage === '咨询未完成待跟进' ? '未完成' : '待标记',
        createdBy: owner.email, createdAt: fmt(booked), updatedBy: owner.email,
        updatedAt: fmt(stage === '已预约' ? booked : consulted), note: '演示咨询预约 / Demo consultation booking' })
      event('appointment', '已预约', booked, appointmentId)
      if (attended) event('attendance', '已出勤', consulted, appointmentId)
      if (completed || stage === '咨询未完成待跟进') event('consultation', completed ? '咨询完成' : '咨询未完成', consulted.add(45, 'minute'), appointmentId)
      if (stage === '未出勤待跟进') event('attendance', 'No Show', consulted, appointmentId)
    }
    if (stage === '暂不跟进' || stage === '已关闭') event('lead', stage, called.add(1, 'hour'))
    student.salesHistory = [{ progress: student.salesProgress!, note: student.salesLatestNote!, time: student.salesUpdatedAt!, owner: unassigned ? '系统 / System' : owner.email }]
    const orderStatus = stage === '付费' ? '已支付' : stage === '咨询完成待支付' ? '待支付' : stage === '暂不跟进' ? (i % 2 ? '已取消' : '已退款') : undefined
    if (orderStatus) {
      const orderId = `VN-DEMO-${sequence}`
      const amount = 1790000 + (i % 3) * 600000
      const order: Order = { orderId, productName: 'Dino English · 12 weeks (Demo)', studentId,
        userStatus: student.status, orderStatus, originalPrice: amount + 300000, paidAmount: orderStatus === '已支付' ? amount : 0,
        payMethod: 'Airwallex - Card', currency: 'VND',
        transactions: [{ id: `${orderId}-1`, time: fmt(booked), event: '创建订单 / Order created', status: '待支付', amount: 0 }] }
      if (orderStatus === '已支付' || orderStatus === '已退款') {
        order.paidTime = fmt(paid)
        order.transactions.push({ id: `${orderId}-2`, time: fmt(paid), event: '支付成功 / Payment received', status: '已支付', amount, paymentMethod: order.payMethod })
      }
      if (orderStatus === '已退款' || orderStatus === '已取消') order.transactions.push({ id: `${orderId}-3`, time: fmt(paid.add(1, 'day')), event: orderStatus === '已退款' ? '退款 / Refund' : '取消 / Canceled', status: orderStatus, amount: orderStatus === '已退款' ? -amount : 0, paymentMethod: order.payMethod })
      if (stage === '付费') {
        student.ccName = owner.name
        student.expireTime = order.validUntil = fmt(paid.add(84, 'day'))
        event('sale', '已付费', paid)
        lessons.push({ id: `management-demo-lesson-${sequence}`, studentId, courseLabel: `L${i % 3 + 1}-U1-L1`, courseName: 'Hello, Dino! (Demo)',
          lessonType: '正式课', status: '进行中', teacher: 'Alex (Demo)', startedAt: fmt(base.subtract(1, 'hour')) })
      }
      orders.push(order)
    }
    students.push(student)
  })
  return { students, accounts, callRecords, orders, lessons, demoDatasets: [DATASET] }
}

/** One-time additive migration: preserve existing users, edits, deletes and dates. */
export function withManagementDemo<T extends DemoState>(state: T, now?: string): T {
  if (state.demoDatasets?.includes(DATASET)) return withReasonDemo(state)
  const demo = createManagementDemo(now)
  const append = <R,>(existing: R[], additions: R[], id: (row: R) => string) => {
    const ids = new Set(existing.map(id))
    return [...existing, ...additions.filter(row => !ids.has(id(row)))]
  }
  return withReasonDemo({ ...state,
    students: append(state.students, demo.students, s => s.studentId),
    accounts: append(state.accounts, demo.accounts, a => a.email),
    callRecords: append(state.callRecords, demo.callRecords, c => c.id),
    orders: append(state.orders, demo.orders, o => o.orderId),
    lessons: append(state.lessons, demo.lessons, l => l.id),
    demoDatasets: [...(state.demoDatasets ?? []), DATASET],
  })
}

/** Enrich only original synthetic events. Existing reasons and customer records are untouched. */
function withReasonDemo<T extends DemoState>(state: T): T {
  if (state.demoDatasets?.includes(REASON_DATASET)) return state
  return { ...state, students: state.students.map(s => {
    if (!/^990000000000000\d{4}$/.test(s.studentId)) return s
    const index = Number(s.studentId.slice(-4)) - 1
    return { ...s, salesLifecycleEvents: s.salesLifecycleEvents?.map(e =>
      e.eventId.startsWith('management-demo-event-') && !e.reason && demoReasons[e.result]
        ? { ...e, reason: demoReasons[e.result][index % 3] } : e) }
  }), demoDatasets: [...(state.demoDatasets || []), REASON_DATASET] }
}
