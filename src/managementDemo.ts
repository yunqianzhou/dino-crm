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
  return createManagementFixtures(now, {
    prefix: 'management-demo', studentPrefix: '990000000000000', orderPrefix: 'VN-DEMO',
    businessLine: '越南', country: '越南', dialCode: '+84', currency: 'VND',
    timezone: 'Asia/Ho_Chi_Minh', offsetMinutes: 420,
    ccNames: ['Chloe', 'Linh', 'Thy', 'Thư', 'Thảo', 'Macie'],
    names: ['Minh Nguyen', 'An Tran', 'Bao Le', 'Linh Pham', 'Mai Hoang', 'Nam Vu', 'Lan Do', 'Khanh Bui'],
    counts: [42, 30, 24, 24, 12, 12, 18, 12, 6], paidCount: 24, unassignedCount: 24,
    baseAmount: 1790000, amountStep: 600000, discount: 300000, legacy: true,
  })
}

type FixtureConfig = {
  prefix: string; studentPrefix: string; orderPrefix: string; businessLine: NonNullable<Student['businessLine']>; country: string
  dialCode: string; currency: string; timezone: string; offsetMinutes: number
  ccNames: string[]; names: string[]; counts: number[]; paidCount: number; unassignedCount: number
  baseAmount: number; amountStep: number; discount: number; legacy?: boolean
}

function createManagementFixtures(now: string, config: FixtureConfig): DemoState {
  const base = dayjs.utc(now).startOf('day')
  const fmt = (time: dayjs.Dayjs) => time.format('YYYY-MM-DD HH:mm:ss')
  const accounts: Account[] = config.ccNames.map((name, i) => ({
    id: `${config.prefix}-cc-${i + 1}`, name,
    email: config.legacy ? `cc${i + 1}@demo.example.invalid` : `${config.prefix}-cc${i + 1}@example.invalid`, roleId: 'role_support',
    businessLines: [config.businessLine], status: '启用', outboundSeatBound: true,
  }))
  const students: Student[] = []
  const callRecords: CallRecord[] = []
  const orders: Order[] = []
  const lessons: LessonRecord[] = []
  const counts = config.counts
  const stages: string[] = CONSULTATION_STAGES.flatMap((stage, index) => Array(counts[index]).fill(stage))
  stages.push(...Array(config.paidCount).fill('付费'))
  const names = config.names

  stages.forEach((stage, i) => {
    const sequence = String(i + 1).padStart(4, '0')
    const studentId = `${config.studentPrefix}${sequence}`
    const owner = accounts[(i + Math.floor(i / 7)) % accounts.length]
    const unassigned = i < config.unassignedCount
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
      userType: '正式用户', loginMethod: 'AppID', account: config.legacy ? `demo-user-${sequence}@example.invalid` : `${config.prefix}-${sequence}@example.invalid`,
      // Deliberately invalid contact numbers; AppID accounts use the explicit userType field.
      phone: `${config.dialCode}00000${sequence}`, countryCode: config.dialCode, businessLine: config.businessLine, country: config.country,
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
      student.salesLifecycleEvents!.push({ eventId: `${config.prefix}-event-${sequence}-${student.salesLifecycleEvents!.length}`,
        node, result, reason: demoReasons[result]?.[i % 3], description: '演示 / Demo', appointmentId,
        occurredAt: fmt(time), reportedAt: fmt(time), reportedBy: owner.email, source: 'CC手动' })
    }
    if (stage !== '待外呼') {
      const call: CallRecord = { id: `${config.prefix}-call-${sequence}`, studentId, customer: student.name,
        phone: student.phone!, businessLine: config.businessLine, result: connected ? '已接通' : '无人接听',
        duration: connected ? `0${2 + i % 6}:${String(i % 60).padStart(2, '0')}` : '—',
        note: '演示通话 / Demo call', agent: owner.email, time: fmt(called) }
      callRecords.push(call)
      event('outbound', call.result, called)
    } else if (!unassigned) {
      student.landingCallbackAt = fmt(base.add(1, 'day').add(i % 8, 'hour'))
    }
    if (hasAppointment) {
      const appointmentId = `${config.prefix}-appointment-${sequence}`
      const scheduled = stage === '已预约' ? base.add(1 + i % 3, 'day').add(3, 'hour') : consulted
      student.salesAppointments!.push({ appointmentId,
        scheduledStartAt: scheduled.utcOffset(config.offsetMinutes).format('YYYY-MM-DD HH:mm:ss'), timezone: config.timezone,
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
      const orderId = `${config.orderPrefix}-${sequence}`
      const amount = config.baseAmount + (i % 3) * config.amountStep
      const order: Order = { orderId, productName: 'Dino English · 12 weeks (Demo)', studentId,
        userStatus: student.status, orderStatus, originalPrice: amount + config.discount, paidAmount: orderStatus === '已支付' ? amount : 0,
        payMethod: 'Airwallex - Card', currency: config.currency,
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
        lessons.push({ id: `${config.prefix}-lesson-${sequence}`, studentId, courseLabel: `L${i % 3 + 1}-U1-L1`, courseName: 'Hello, Dino! (Demo)',
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
  return withRegionalManagementDemo(withDashboard5OutcomeDemo(withBaseManagementDemo(state, now), now), now)
}

function withBaseManagementDemo<T extends DemoState>(state: T, now?: string): T {
  if (state.demoDatasets?.includes(DATASET)) return withDashboard43Demo(withReasonDemo(state))
  const demo = createManagementDemo(now)
  const append = <R,>(existing: R[], additions: R[], id: (row: R) => string) => {
    const ids = new Set(existing.map(id))
    return [...existing, ...additions.filter(row => !ids.has(id(row)))]
  }
  return withDashboard43Demo(withReasonDemo({ ...state,
    students: append(state.students, demo.students, s => s.studentId),
    accounts: append(state.accounts, demo.accounts, a => a.email),
    callRecords: append(state.callRecords, demo.callRecords, c => c.id),
    orders: append(state.orders, demo.orders, o => o.orderId),
    lessons: append(state.lessons, demo.lessons, l => l.id),
    demoDatasets: [...(state.demoDatasets ?? []), DATASET],
  }))
}

/** Add explicit v5 outcomes once, including reasons and coherent call/appointment history. */
function withDashboard5OutcomeDemo<T extends DemoState>(state: T, now = dayjs.utc().toISOString()): T {
  const marker = 'management-vietnam-outcomes-v5-v1'
  if (state.demoDatasets?.includes(marker)) return state
  const base = dayjs.utc(now).startOf('day')
  const fmt = (date: dayjs.Dayjs) => date.format('YYYY-MM-DD HH:mm:ss')
  const owners = state.accounts.filter(a => /^management-demo-cc-\d+$/.test(a.id) && a.status === '启用')
  const reasons = {
    rejected: ['无需求', '无需求', '无需求', '家长拒绝接听电话', '家长拒绝接听电话', '家长拒绝接听电话', '号码错误', '号码错误', '稍后回电', '稍后回电', '低于4岁', '超过13岁／成人'],
    closed: ['费用高', '费用高', '费用高', '费用高', '课程不适合孩子', '课程不适合孩子', '课程不适合孩子', '设备问题', '设备问题', '支付方式问题', '孩子不喜欢', '其他：家庭安排调整（演示）'],
  }
  const students: Student[] = []
  const calls: CallRecord[] = []
  for (const stage of ['rejected', 'closed'] as const) reasons[stage].forEach((reason, i) => {
    const id = `management-v5-${stage}-${String(i + 1).padStart(2, '0')}`
    // Do not overwrite an existing fixture that has been edited or reactivated.
    if (state.students.some(s => s.studentId === id)) return
    const owner = owners.length ? owners[(i + (stage === 'closed' ? 2 : 0)) % owners.length] : undefined
    const reportedBy = owner?.email || '系统 / System'
    const result = stage === 'rejected' ? '已拒绝' : '已关闭'
    const ended = base.subtract(1 + i % 6, 'day').add(5 + i % 3, 'hour')
    const registered = ended.subtract(3, 'day')
    const called = registered.add(1, 'day')
    const booked = called.add(1, 'hour')
    const attended = ended.subtract(1, 'hour')
    const appointmentId = `${id}-appointment`
    const note = `五期演示：${stage === 'rejected' ? '已拒绝' : '已结束'} · ${reason} / Synthetic demo`
    const student: Student = {
      studentId: id, name: `演示 · ${stage === 'rejected' ? '已拒绝' : '已结束'} ${String(i + 1).padStart(2, '0')}`,
      userType: '正式用户', loginMethod: 'AppID', account: `${id}@example.invalid`,
      phone: `+840009${stage === 'rejected' ? '1' : '2'}${String(i + 1).padStart(3, '0')}`,
      countryCode: '+84', businessLine: '越南', country: '越南', registerChannel: '演示 / Demo', channelCode: '',
      registerTime: fmt(registered), status: '未付费-未体验', paymentStatusStr: '未付费', ageGroup: '6-8', courseLevel: 'L1',
      salesOwner: owner?.email, salesProgress: owner ? '跟进中' : '待领取', purchaseIntention: '无意向',
      salesLifecycleStatus: stage === 'closed' ? '已关闭' : '进行中', salesOutcome5: { stage, reason },
      salesUpdatedAt: fmt(ended), salesLatestNote: note, salesAppointments: [], salesLifecycleEvents: [],
      salesHistory: [{ progress: owner ? '跟进中' : '待领取', note, time: fmt(ended), owner: reportedBy }],
    }
    const call: CallRecord = { id: `${id}-call`, studentId: id, customer: student.name, phone: student.phone!, businessLine: '越南',
      result: reason === '号码错误' ? '无人接听' : '已接通', duration: reason === '号码错误' ? '—' : '02:15',
      note: '五期模拟通话 / Synthetic phase 5 call', agent: reportedBy, time: fmt(called) }
    const event = (node: SalesLifecycleEvent['node'], eventResult: string, at: dayjs.Dayjs, reason?: string, appointmentId?: string) => {
      student.salesLifecycleEvents!.unshift({ eventId: `${id}-event-${student.salesLifecycleEvents!.length}`, node, result: eventResult,
        occurredAt: fmt(at), reportedAt: fmt(at), reportedBy, source: 'CC手动', reason, appointmentId, description: '五期演示 / Synthetic phase 5 demo' })
    }
    event('outbound', call.result, called)
    if (stage === 'closed') {
      student.salesAppointments = [{ appointmentId, scheduledStartAt: attended.utcOffset(420).format('YYYY-MM-DD HH:mm:ss'),
        timezone: 'Asia/Ho_Chi_Minh', appointmentStatus: '已预约', attendanceStatus: '已出勤', consultationStatus: '已完成',
        createdAt: fmt(booked), createdBy: reportedBy, updatedAt: fmt(ended), updatedBy: reportedBy, note: '五期演示咨询 / Synthetic consultation' }]
      event('appointment', '已预约', booked, undefined, appointmentId)
      event('attendance', '已出勤', attended, undefined, appointmentId)
      event('consultation', '咨询完成', ended.subtract(15, 'minute'), undefined, appointmentId)
    }
    event('lead', result, ended, reason)
    students.push(student)
    if (!state.callRecords.some(c => c.id === call.id)) calls.push(call)
  })
  return { ...state, students: [...state.students, ...students], callRecords: [...state.callRecords, ...calls],
    demoDatasets: [...(state.demoDatasets || []), marker] }
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

/** Independent trial facts for the new cohort metric. Never derived from attendance. */
function withDashboard43Demo<T extends DemoState>(state: T): T {
  const marker = 'management-vietnam-43-v1'
  if (state.demoDatasets?.includes(marker)) return state
  const lessons = [...state.lessons]
  const students = state.students.map(student => {
    if (!/^990000000000000\d{4}$/.test(student.studentId)) return student
    const index = Number(student.studentId.slice(-4))
    if (index % 4 === 0) {
      const id = `management-demo-trial-${index}`
      if (!lessons.some(l => l.id === id)) lessons.push({id,studentId:student.studentId,courseLabel:'TRIAL-DEMO-01',courseName:'My first English class (Demo)',lessonType:'体验课',status:'已完课',startedAt:dayjs.utc(student.registerTime).add(1,'hour').format('YYYY-MM-DD HH:mm:ss'),completedAt:dayjs.utc(student.registerTime).add(90,'minute').format('YYYY-MM-DD HH:mm:ss')})
    }
    const events = [...(student.salesLifecycleEvents || [])]
    const consultation = events.find(e => e.eventId.startsWith('management-demo-event-') && e.result === '咨询完成')
    if (consultation && student.status !== '付费' && !events.some(e => e.result === '待支付')) events.push({ ...consultation,eventId:`management-demo-concern-${index}`,node:'sale',result:'待支付',reason:['预算原因','时间不足','其他'][index % 3],description:'演示支付顾虑 / Demo payment concern' })
    return { ...student, salesLifecycleEvents: events.map(event => event.eventId.startsWith('management-demo-event-') && event.result === '已关闭' && !('closureType' in event) ? { ...event, closureType:'phone' } : event) }
  })
  return { ...state,students,lessons,demoDatasets:[...(state.demoDatasets || []),marker] }
}

/** Add current Vietnam and Malaysia examples once without overwriting saved prototype work. */
function withRegionalManagementDemo<T extends DemoState>(state: T, now = dayjs.utc().toISOString()): T {
  const marker = 'management-vn-my-oct2026-v1'
  if (state.demoDatasets?.includes(marker)) return state
  const configs: FixtureConfig[] = [
    { prefix: 'management-vn-oct26', studentPrefix: '991000000000000', orderPrefix: 'VN-OCT26-DEMO',
      businessLine: '越南', country: '越南', dialCode: '+84', currency: 'VND', timezone: 'Asia/Ho_Chi_Minh', offsetMinutes: 420,
      ccNames: ['Hanh (Demo)', 'Duc (Demo)', 'Vy (Demo)'], names: ['An Nguyen (Demo)', 'Minh Tran (Demo)', 'Linh Le (Demo)', 'Bao Pham (Demo)'],
      counts: [12, 12, 12, 12, 6, 6, 6, 6, 6], paidCount: 18, unassignedCount: 6,
      baseAmount: 1590000, amountStep: 500000, discount: 200000 },
    { prefix: 'management-my-oct26', studentPrefix: '992000000000000', orderPrefix: 'MY-OCT26-DEMO',
      businessLine: '马来', country: '马来西亚', dialCode: '+60', currency: 'MYR', timezone: 'Asia/Kuala_Lumpur', offsetMinutes: 480,
      ccNames: ['Aina (Demo)', 'Amir (Demo)', 'Mei (Demo)', 'Sara (Demo)'], names: ['Adam Tan (Demo)', 'Alya Lim (Demo)', 'Ryan Lee (Demo)', 'Sofia Wong (Demo)'],
      counts: [18, 12, 10, 10, 6, 6, 8, 6, 4], paidCount: 20, unassignedCount: 8,
      baseAmount: 399, amountStep: 150, discount: 80 },
  ]
  const append = <R,>(existing: R[], additions: R[], id: (row: R) => string) => {
    const ids = new Set(existing.map(id))
    return [...existing, ...additions.filter(row => !ids.has(id(row)))]
  }
  let result = state
  for (const config of configs) {
    const demo = createManagementFixtures(now, config)
    demo.students.forEach((student, index) => {
      if (index % 4 === 0) demo.lessons.push({
        id: `${config.prefix}-trial-${index}`, studentId: student.studentId,
        courseLabel: 'TRIAL-DEMO-01', courseName: 'My first English class (Demo)',
        lessonType: '体验课', status: '已完课',
        startedAt: dayjs.utc(student.registerTime).add(1, 'day').format('YYYY-MM-DD HH:mm:ss'),
        completedAt: dayjs.utc(student.registerTime).add(1, 'day').add(30, 'minute').format('YYYY-MM-DD HH:mm:ss'),
      })
      if (student.salesLifecycleStatus === '已关闭') {
        const rejected = index % 2 === 0
        const reason = rejected ? '无需求' : '费用高'
        student.salesOutcome5 = { stage: rejected ? 'rejected' : 'closed', reason }
        student.salesLifecycleStatus = rejected ? '进行中' : '已关闭'
        const event = student.salesLifecycleEvents?.find(event => event.result === '已关闭')
        if (event) { event.result = rejected ? '已拒绝' : '已关闭'; event.reason = reason }
      }
    })
    result = { ...result,
      students: append(result.students, demo.students, s => s.studentId),
      accounts: append(result.accounts, demo.accounts, a => a.email),
      callRecords: append(result.callRecords, demo.callRecords, c => c.id),
      orders: append(result.orders, demo.orders, o => o.orderId),
      lessons: append(result.lessons, demo.lessons, l => l.id),
    }
  }
  return { ...result, demoDatasets: [...(result.demoDatasets || []), marker] }
}
