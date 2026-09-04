import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  Alert,
  Button,
  Card,
  DatePicker,
  Dropdown,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Statistic,
  Switch,
  Table,
  Tabs,
  Tag,
  Timeline,
  Typography,
  message,
} from 'antd'
import { CheckOutlined, DownOutlined, EditOutlined, PhoneOutlined, SearchOutlined, SettingOutlined, SwapOutlined, RollbackOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { genCallId, setState, uid, updateSalesSettings, useStore } from '../store'
import type { Account, CallRecord, CallResult, SalesFollowLog, SalesLifecycleNode, SalesSettings, Student, UserType, UserStatus } from '../types'
import { CALL_RESULTS } from '../types'
import { useI18n } from '../i18n'
import { useNavigate } from 'react-router-dom'
import { usePerm } from '../perm'
import { isClaimedLead, isPoolLead, isSalesLead } from '../funnel'
import { resolveUserType } from '../userType'
import { latestTrialReport, resolveUserStatus, TRIAL_REPORT_URL } from '../lessons'
import { useLineScope } from '../useLineScope'
import { businessLineOf, lineLabel, lpChannelSourceText, appChannelSourceText } from '../channel'
import LineFilter from '../components/LineFilter'
import LocalTime from '../components/LocalTime'
import { CONSULTATION_STAGE_COLOR, CONSULTATION_STAGES, consultationStage, currentAppointment } from '../salesLifecycle'

const { Text } = Typography

const CALL_RESULT_COLOR: Record<CallResult, string> = {
  已接通: 'green',
  无人接听: 'red',
}

function fmtDuration(sec: number) {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function durationToSeconds(duration: string) {
  const [minutes, seconds] = duration.split(':').map(Number)
  return Number.isFinite(minutes) && Number.isFinite(seconds) ? minutes * 60 + seconds : 0
}

const USER_TYPE_COLOR: Record<UserType, string> = {
  正式用户: 'green',
  测试用户: 'gold',
}

const STATUS_COLOR: Record<UserStatus, string> = {
  '未付费-未体验': 'default',
  '未付费-已体验': 'purple',
  '未付费-体验中': 'gold',
  付费: 'green',
  付费逾期: 'red',
}

// 跟进进度标签配色
const PROGRESS_COLOR: Record<string, string> = {
  待领取: 'orange',
  跟进中: 'blue',
  暂不跟进: 'default',
  已付费: 'green',
}

function isPaidStudent(student: Student) { return student.status === '付费' || student.paymentStatusStr === '已付费' }

export default function SalesCenter({ importAction, detailPath, phase3 = false }: { importAction?: ReactNode; detailPath?: string; phase3?: boolean }) {
  const { t } = useI18n()
  const navigate = useNavigate()
  const students = useStore((s) => s.students)
  const channels = useStore((s) => s.channels)
  const lessons = useStore((s) => s.lessons ?? [])
  const callRecords = useStore((s) => s.callRecords ?? [])
  const salesSettings = useStore((s) => s.salesSettings)
  const accounts = useStore((s) => s.accounts)
  const roles = useStore((s) => s.roles)
  const { can, allowedLines, actor, account } = usePerm()
  const canEdit = can(phase3 ? 'salesV3_update' : 'sales_update') === 'operate'
  const canClaim = can(phase3 ? 'salesV3_claim' : 'sales_claim') === 'operate'
  const canDial = can(phase3 ? 'salesV3_dial' : 'sales_dial') === 'operate'
  const canReassign = can(phase3 ? 'salesV3_reassign' : 'sales_reassign') === 'operate'
  const canViewReport = phase3 && can('salesV3_view_report') === 'operate'
  const canManageSettings = can(phase3 ? 'salesV3_config' : 'sales_config') === 'operate'
  // 全业务线（超管）或拥有重新分配权限的主管可见范围内全部领取记录
  const seeAllOwners = allowedLines() === null || canReassign
  // 当拥有分配与掉库设置权限时，视为 Leader 身份以显示横幅和设置入口
  const isLeader = canManageSettings
  const { selected: lineSel, setSelected: setLineSel, matchLine, disabled: lineDisabled, filterOptions } = useLineScope()

  // 可被分配的销售：启用状态、非系统管理员、且角色具备销售模块「操作」权限
  const salesAccounts = useMemo(
    () => accounts.filter((a) => a.status === '启用' && a.roleId !== 'role_admin' && roles.find((r) => r.id === a.roleId)?.perms.sales === 'operate'),
    [accounts, roles],
  )

  const [tab, setTab] = useState('follow')
  const [keyword, setKeyword] = useState('')
  const [purchaseIntentionFilter, setPurchaseIntentionFilter] = useState<string[]>([])
  const [ownerFilter, setOwnerFilter] = useState<string | undefined>()
  const [ageGroupFilter, setAgeGroupFilter] = useState<string[]>([])
  const [courseLevelFilter, setCourseLevelFilter] = useState<string[]>([])
  const [registerChannelFilter, setRegisterChannelFilter] = useState<string[]>([])
  const [userTypeFilter, setUserTypeFilter] = useState<string[]>([])
  const [registerDateRange, setRegisterDateRange] = useState<any>(null)
  const [followDateRange, setFollowDateRange] = useState<any>(null)
  const [callResultFilter, setCallResultFilter] = useState<string | undefined>()
  const [callAgentFilter, setCallAgentFilter] = useState<string | undefined>()
  const [callDateRange, setCallDateRange] = useState<any>(null)
  const [consultationStageFilter, setConsultationStageFilter] = useState<string[]>([])
  const [landingCallbackFilter, setLandingCallbackFilter] = useState<string | undefined>()

  const [editing, setEditing] = useState<Student | null>(null)
  const [dialing, setDialing] = useState<Student | null>(null)
  const [reassigning, setReassigning] = useState<Student | null>(null)
  const [dropping, setDropping] = useState<Student | null>(null)
  const [trialLevelStudent, setTrialLevelStudent] = useState<Student | null>(null)
  const [consulting, setConsulting] = useState<Student | null>(null)
  const [reassignTo, setReassignTo] = useState<string | undefined>()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [form] = Form.useForm()
  const [dropForm] = Form.useForm()
  const [trialLevelForm] = Form.useForm()

  // 无业务线（无渠道归因）的用户不参与业务线过滤（不再强制展示，需受筛选器控制）
  const lineHit = (s: Student) => {
    const bl = businessLineOf(channels, s)
    return matchLine(bl)
  }
  const poolAll = useMemo(
    () => students.filter((s) => isPoolLead(s, lessons)).filter(lineHit),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [students, channels, lessons, lineSel, matchLine],
  )
  const followAll = useMemo(
    () =>
      students
        .filter((s) => isClaimedLead(s, lessons))
        .filter(lineHit)
        .filter((s) => seeAllOwners || s.salesOwner === actor),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [students, channels, lessons, lineSel, matchLine, seeAllOwners, actor],
  )

  // 业务线筛选选项：渠道业务线 + 学员中出现的业务线（空业务线不入选项）
  const lineOptions = useMemo(
    () =>
      Array.from(
        new Set([...channels.map((c) => c.name), ...students.map((s) => businessLineOf(channels, s))].filter(Boolean)),
      ),
    [channels, students],
  )
  // 仅当当前国家筛选范围包含越南时展示越南销售咨询阶段；避免其他国家看到无关筛选。
  const showVietnamStageFilter = filterOptions(lineOptions).includes('越南') && (lineSel.length === 0 || lineSel.includes('越南'))

  useEffect(() => {
    if (!showVietnamStageFilter && consultationStageFilter.length) setConsultationStageFilter([])
  }, [showVietnamStageFilter, consultationStageFilter])

  const leadText = (s: Student) =>
    `${s.phone ?? ''} ${s.studentId} ${s.localName ?? s.name} ${s.country ?? ''}`.toLowerCase()

  const salesLeads = useMemo(() => [...poolAll, ...followAll], [poolAll, followAll])
  const filterOptionsFromLeads = (pick: (student: Student) => string | undefined) =>
    Array.from(new Set(salesLeads.map(pick).filter((value): value is string => Boolean(value)))).sort()
  const ageGroupOptions = useMemo(() => filterOptionsFromLeads((s) => s.ageGroup), [salesLeads])
  const courseLevelOptions = useMemo(() => filterOptionsFromLeads((s) => s.courseLevel), [salesLeads])
  const registerChannelOptions = useMemo(() => filterOptionsFromLeads((s) => s.registerChannel), [salesLeads])

  const matchesDateRange = (value: string | undefined, range: any) => {
    if (!range || range.length !== 2) return true
    if (!value) return false
    const [start, end] = range
    if (!start || !end) return true
    const time = dayjs.utc(value).valueOf()
    return time >= start.startOf('day').valueOf() && time <= end.endOf('day').valueOf()
  }

  const matchesLeadFilters = (s: Student) => {
    const kw = keyword.trim().toLowerCase()
    const owner = s.salesOwner || '__unassigned__'
    const callbackAt = s.landingCallbackAt ? dayjs.utc(s.landingCallbackAt) : undefined
    const now = dayjs.utc()
    const callbackMatches = !landingCallbackFilter
      || (landingCallbackFilter === 'filled' && !!callbackAt)
      || (landingCallbackFilter === 'due' && !!callbackAt && !callbackAt.isAfter(now))
      || (landingCallbackFilter === 'upcoming' && !!callbackAt && callbackAt.isAfter(now) && callbackAt.diff(now, 'hour', true) <= 24)
    return (
      (!kw || leadText(s).includes(kw)) &&
      (!purchaseIntentionFilter.length || purchaseIntentionFilter.includes(s.purchaseIntention || '未填写')) &&
      (!ownerFilter || ownerFilter === owner) &&
      (!ageGroupFilter.length || (!!s.ageGroup && ageGroupFilter.includes(s.ageGroup))) &&
      (!courseLevelFilter.length || (!!s.courseLevel && courseLevelFilter.includes(s.courseLevel))) &&
      (!registerChannelFilter.length || registerChannelFilter.includes(s.registerChannel)) &&
      (!userTypeFilter.length || userTypeFilter.includes(resolveUserType(s))) &&
      matchesDateRange(s.registerTime, registerDateRange) &&
      matchesDateRange(s.salesUpdatedAt, followDateRange) &&
      callbackMatches
    )
  }

  const poolData = useMemo(
    () => poolAll.filter(matchesLeadFilters),
    [poolAll, keyword, purchaseIntentionFilter, ownerFilter, ageGroupFilter, courseLevelFilter, registerChannelFilter, userTypeFilter, registerDateRange, followDateRange, landingCallbackFilter],
  )

  const followData = useMemo(
    () => followAll.filter(matchesLeadFilters).filter((s) => consultationStageFilter.length === 0 || (s.businessLine === '越南' && consultationStageFilter.includes(consultationStage(s, callRecords)))),
    [followAll, keyword, purchaseIntentionFilter, ownerFilter, ageGroupFilter, courseLevelFilter, registerChannelFilter, userTypeFilter, registerDateRange, followDateRange, consultationStageFilter, landingCallbackFilter, callRecords],
  )

  // 通话记录：按业务线默认勾选过滤，非超管仅看自己坐席的记录
  const callScoped = useMemo(() => {
    let list = callRecords.filter((c) => matchLine(c.businessLine))
    if (!seeAllOwners) list = list.filter((c) => c.agent === actor)
    return list
  }, [callRecords, lineSel, matchLine, seeAllOwners, actor])

  const matchesCallDate = (call: CallRecord) => {
    if (!callDateRange || callDateRange.length !== 2) return true
    const [start, end] = callDateRange
    if (!start || !end) return true
    const callTime = dayjs.utc(call.time)
    return !callTime.isBefore(start.startOf('day')) && !callTime.isAfter(end.endOf('day'))
  }

  const callData = useMemo(
    () =>
      callScoped.filter((c) => {
        const kw = keyword.trim().toLowerCase()
        const student = students.find((item) => item.studentId === c.studentId)
        const text = phase3
          ? `${c.studentId} ${c.customer} ${student?.account ?? ''}`.toLowerCase()
          : `${c.phone} ${c.studentId} ${c.customer}`.toLowerCase()
        const matchResult = !callResultFilter || c.result === callResultFilter
        const matchAgent = !callAgentFilter || c.agent === callAgentFilter
        return (!kw || text.includes(kw)) && matchResult && matchAgent && matchesCallDate(c)
      }),
    [callScoped, keyword, callResultFilter, callAgentFilter, callDateRange, students, phase3],
  )

  // 触达汇总不受关键词、单次通话结果筛选影响；只按国家、CC 和统计周期确定漏斗范围。
  const summaryCallData = useMemo(
    () => callScoped.filter((call) => (!callAgentFilter || call.agent === callAgentFilter) && matchesCallDate(call)),
    [callScoped, callAgentFilter, callDateRange],
  )

  // Lead 列表中的累计外呼次数：不受统计周期影响，只受当前数据权限和国家范围约束。
  const leadCallCounts = useMemo(() => {
    const counts = new Map<string, number>()
    callScoped.forEach((call) => counts.set(call.studentId, (counts.get(call.studentId) || 0) + 1))
    return counts
  }, [callScoped])
  const callSummary = useMemo(() => {
    const byAgentAndCountry = new Map<string, { agent: string; country: string; outboundLeads: Set<string>; connectedLeads: Set<string>; total: number; answered: number; seconds: number }>()
    const getItem = (agent: string, country: string) => {
      const key = `${agent}::${country}`
      const item = byAgentAndCountry.get(key) || { agent, country, outboundLeads: new Set<string>(), connectedLeads: new Set<string>(), total: 0, answered: 0, seconds: 0 }
      byAgentAndCountry.set(key, item)
      return item
    }
    summaryCallData.forEach((call) => {
      const country = call.businessLine || '未填写'
      const item = getItem(call.agent, country)
      item.total += 1
      item.answered += call.result === '已接通' ? 1 : 0
      item.seconds += durationToSeconds(call.duration)
      item.outboundLeads.add(call.studentId)
      if (call.result === '已接通') item.connectedLeads.add(call.studentId)
    })
    const rows = [...byAgentAndCountry.values()].map((item) => ({
      key: `${item.agent}::${item.country}`,
      agent: item.agent,
      country: item.country,
      outboundLeads: item.outboundLeads.size,
      connectedLeads: item.connectedLeads.size,
      total: item.total,
      answered: item.answered,
      seconds: item.seconds,
    })).sort((a, b) => b.total - a.total)
    const outboundLeadIds = new Set(summaryCallData.map((call) => call.studentId))
    const connectedLeadIds = new Set(summaryCallData.filter((call) => call.result === '已接通').map((call) => call.studentId))
    const totalSeconds = summaryCallData.reduce((sum, call) => sum + durationToSeconds(call.duration), 0)
    return {
      rows,
      outboundLeads: outboundLeadIds.size,
      connectedLeads: connectedLeadIds.size,
      total: summaryCallData.length,
      answered: summaryCallData.filter((call) => call.result === '已接通').length,
      totalSeconds,
    }
  }, [summaryCallData])

  const claim = (s: Student) => {
    const now = dayjs().format('YYYY-MM-DD HH:mm:ss')
    const note = t('sales.claimNote')
    setState((prev) => ({
      ...prev,
      students: prev.students.map((x) =>
        x.studentId === s.studentId
          ? {
              ...x,
              salesOwner: actor,
              salesProgress: '跟进中',
              salesLatestNote: note,
              salesUpdatedAt: now,
              salesHistory: [{ progress: '跟进中', note, time: now, owner: actor }, ...(x.salesHistory || [])],
            }
          : x,
      ),
    }))
    message.success(t('sales.claimed', { phone: s.phone ?? '' }))
    setTab('follow')
  }

  const openFollow = (s: Student) => {
    setEditing(s)
    form.setFieldsValue({
      note: '',
      purchaseIntention: s.purchaseIntention || '未填写',
      lifecycleAction: 'continue',
      occurredAt: dayjs(),
      scheduledStartAt: undefined,
      meetingLink: '',
      reason: '',
      reasonOther: '',
    })
  }

  const persistFollow = (v: any) => {
    if (!editing) return
    const now = dayjs().format('YYYY-MM-DD HH:mm:ss')
    const note = ((v.note as string) || '').trim()
    const reason = v.reason === '其他' ? `其他：${(v.reasonOther as string).trim()}` : v.reason
    const action = v.lifecycleAction as string | undefined
    const actionLabel: Record<string, string> = {
      continue: '继续跟进', pause: '暂不跟进', create: '新建预约', reschedule: '已改期', cancel: '已取消预约', attended: '已出勤',
      noShow: '未出勤', completed: '咨询完成', incomplete: '咨询未完成', close: '已关闭', reactivate: '已重新激活',
    }
    const occurredAt = v.occurredAt?.format?.('YYYY-MM-DD HH:mm:ss') || now
    setState((prev) => ({
      ...prev,
      students: prev.students.map((x) => {
        if (x.studentId === editing.studentId) {
          const currentProgress = action === 'pause' ? '暂不跟进' : ['continue', 'reactivate'].includes(action || '') ? '跟进中' : x.salesProgress || '跟进中'
          const current = currentAppointment(x)
          let appointments = [...(x.salesAppointments ?? [])]
          let event = undefined as any
          if (action && !['continue', 'pause'].includes(action)) {
            if (action === 'create' || action === 'reschedule') {
              if (action === 'reschedule' && current) {
                appointments = appointments.map((item) => item.appointmentId === current.appointmentId ? { ...item, appointmentStatus: '已改期' as const, reason, updatedBy: actor, updatedAt: now } : item)
              }
              const appointmentId = uid('sa_')
              appointments = [{ appointmentId, scheduledStartAt: v.scheduledStartAt.format('YYYY-MM-DD HH:mm:ss'), timezone: 'Asia/Ho_Chi_Minh', meetingLink: v.meetingLink, appointmentStatus: '已预约', attendanceStatus: '待标记', consultationStatus: '待标记', note, createdBy: actor, createdAt: now }, ...appointments]
              event = { eventId: uid('sle_'), node: 'appointment' as SalesLifecycleNode, result: action === 'reschedule' ? '已改期' : '已预约', reason, description: note, appointmentId, occurredAt, reportedAt: now, reportedBy: actor, source: 'CC手动' as const }
            } else if (action === 'close' || action === 'reactivate') {
              event = { eventId: uid('sle_'), node: 'lead' as SalesLifecycleNode, result: actionLabel[action], reason, description: note, occurredAt, reportedAt: now, reportedBy: actor, source: 'CC手动' as const }
            } else if (current) {
              appointments = appointments.map((item) => {
                if (item.appointmentId !== current.appointmentId) return item
                if (action === 'cancel') return { ...item, appointmentStatus: '已取消' as const, reason, note, updatedBy: actor, updatedAt: now }
                if (action === 'noShow') return { ...item, attendanceStatus: 'No Show' as const, reason, note, updatedBy: actor, updatedAt: now }
                return { ...item, attendanceStatus: '已出勤' as const, consultationStatus: action === 'completed' ? '已完成' as const : '未完成' as const, note, updatedBy: actor, updatedAt: now }
              })
              event = { eventId: uid('sle_'), node: (action === 'cancel' ? 'appointment' : action === 'noShow' ? 'attendance' : 'consultation') as SalesLifecycleNode, result: actionLabel[action], reason, description: note, appointmentId: current.appointmentId, occurredAt, reportedAt: now, reportedBy: actor, source: 'CC手动' as const }
            }
          }
          if (action === 'pause') event = { eventId: uid('sle_'), node: 'lead' as SalesLifecycleNode, result: actionLabel[action], reason, description: note, occurredAt, reportedAt: now, reportedBy: actor, source: 'CC手动' as const }
          const historyNote = action && action !== 'continue' ? `${note ? `${note}\n` : ''}【销售咨询】${actionLabel[action]}${reason ? `：${reason}` : ''}` : note
          return {
            ...x,
            purchaseIntention: v.purchaseIntention,
            salesProgress: currentProgress,
            salesLifecycleStatus: action === 'close' ? '已关闭' : action === 'reactivate' ? '进行中' : x.salesLifecycleStatus,
            salesAppointments: appointments,
            salesLifecycleEvents: event ? [event, ...(x.salesLifecycleEvents ?? [])] : x.salesLifecycleEvents,
            salesLatestNote: historyNote,
            salesUpdatedAt: now,
            salesHistory: [{ progress: currentProgress, note: historyNote, time: now, owner: actor }, ...(x.salesHistory || [])],
          }
        }
        return x
      }),
    }))
    setEditing(null)
    message.success(t('sales.saved'))
  }

  const saveFollow = async () => {
    const v = await form.validateFields()
    const action = v.lifecycleAction as string | undefined
    const activeAppointment = editing?.salesAppointments?.find((item) => item.appointmentStatus === '已预约' && item.attendanceStatus === '待标记' && item.consultationStatus === '待标记')
    const currentStage = editing ? consultationStage(editing, callRecords) : undefined
    if (editing?.businessLine === '越南' && editing.salesLifecycleStatus === '已关闭' && action !== 'reactivate') {
      message.warning(t('sales.consultation.guard.closed'))
      return
    }
    if (editing?.businessLine === '越南' && editing.salesProgress === '暂不跟进' && !['continue', 'close'].includes(action || '')) {
      message.warning(t('sales.consultation.guard.paused'))
      return
    }
    if (editing?.businessLine === '越南' && activeAppointment && ['pause', 'close'].includes(action || '')) {
      message.warning(t('sales.consultation.guard.activeAppointment'))
      return
    }
    if (editing?.businessLine === '越南' && currentStage === '咨询完成待支付' && action === 'create') {
      message.warning(t('sales.consultation.guard.paymentPending'))
      return
    }
    const immutableActions = ['reschedule', 'cancel', 'attended', 'noShow', 'completed', 'incomplete', 'close']
    if (!immutableActions.includes(action || '')) {
      persistFollow(v)
      return
    }
    const content = action === 'close'
      ? t('sales.consultation.confirm.close')
      : ['cancel', 'noShow', 'completed', 'incomplete'].includes(action || '')
        ? t('sales.consultation.confirm.endAppointment')
        : t('sales.consultation.confirm.immutable')
    Modal.confirm({
      title: t('sales.consultation.confirm.title', { action: t(`sales.consultation.action.${action}`) }),
      content,
      okText: t('common.confirm'),
      cancelText: t('common.cancel'),
      onOk: () => persistFollow(v),
    })
  }

  const openReassign = (s: Student) => {
    setReassigning(s)
    setReassignTo(undefined)
  }

  const openDrop = (s: Student) => {
    setDropping(s)
    dropForm.resetFields()
  }

  const openTrialLevel = (s: Student) => {
    setTrialLevelStudent(s)
    trialLevelForm.setFieldsValue({ courseLevel: s.courseLevel })
  }

  const saveTrialLevel = async () => {
    if (!trialLevelStudent) return
    const { courseLevel } = await trialLevelForm.validateFields()
    setState((prev) => ({
      ...prev,
      students: prev.students.map((student) =>
        student.studentId === trialLevelStudent.studentId
          ? { ...student, courseLevel, salesUpdatedAt: dayjs().format('YYYY-MM-DD HH:mm:ss') }
          : student,
      ),
    }))
    setTrialLevelStudent(null)
    message.success('试听课等级已修改')
  }

  const doDrop = async () => {
    if (!dropping) return
    const v = await dropForm.validateFields()
    const reason = v.reason?.trim()
    const now = dayjs().format('YYYY-MM-DD HH:mm:ss')
    const note = `${t('sales.manualDropNote')}${reason}`
    setState((prev) => ({
      ...prev,
      students: prev.students.map((x) =>
        x.studentId === dropping.studentId
          ? {
              ...x,
              salesOwner: undefined,
              salesProgress: '待领取',
              salesLatestNote: note,
              salesUpdatedAt: now,
              salesHistory: [{ progress: '待领取', note, time: now, owner: actor }, ...(x.salesHistory || [])],
            }
          : x,
      ),
    }))
    setDropping(null)
    message.success(t('sales.dropped'))
  }

  // 重新分配线索：改写归属销售 + 归档到跟进记录
  const doReassign = () => {
    if (!reassigning) return
    if (!reassignTo) {
      message.warning(t('sales.reassign.required'))
      return
    }
    const target = salesAccounts.find((a) => a.email === reassignTo)
    const name = target?.name ?? reassignTo
    const now = dayjs().format('YYYY-MM-DD HH:mm:ss')
    const note = t('sales.reassign.note', { name })
    setState((prev) => ({
      ...prev,
      students: prev.students.map((x) =>
        x.studentId === reassigning.studentId
          ? {
              ...x,
              salesOwner: reassignTo,
              salesLatestNote: note,
              salesUpdatedAt: now,
              salesHistory: [
                { progress: x.salesProgress || '跟进中', note, time: now, owner: actor },
                ...(x.salesHistory || []),
              ],
            }
          : x,
      ),
    }))
    setReassigning(null)
    message.success(t('sales.reassigned', { name }))
  }

  // 保存外呼通话小结：生成通话记录 + 归档到该线索的销售跟进记录
  const saveCall = (note: string, intention: string, appointment?: { booked: boolean; scheduledStartAt?: string; meetingLink?: string }) => {
    if (!dialing) return
    const now = dayjs().format('YYYY-MM-DD HH:mm:ss')
    // 模拟外呼录音链接
    const dummyAudio = 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3'
    // 模拟外呼结果里携带的 AI 总结
    const dummySummary = '【AI自动总结】用户对课程表达了兴趣，询问了试听课的时间安排，对师资情况较为关注，建议后续跟进体验课安排。'
    const record: CallRecord = {
      id: genCallId(),
      studentId: dialing.studentId,
      customer: dialing.localName || dialing.name,
      phone: dialing.phone ?? '',
      businessLine: dialing.businessLine,
      result: '已接通',
      duration: '01:30',
      note,
      audioUrl: dummyAudio,
      agent: actor,
      time: now,
    }
    setState((prev) => ({
      ...prev,
      callRecords: [record, ...prev.callRecords],
      students: prev.students.map((x) => {
        if (x.studentId !== dialing.studentId) return x
        const appointmentNote = appointment?.booked ? `【销售咨询预约】已预约：${appointment.scheduledStartAt}${appointment.meetingLink ? ` · ${appointment.meetingLink}` : ''}` : ''
        const followNote = appointmentNote ? `${note}\n${appointmentNote}` : note
        const appointmentEvent = appointment?.booked ? { eventId: uid('sle_'), node: 'appointment' as SalesLifecycleNode, result: '已预约', description: followNote, occurredAt: now, reportedAt: now, reportedBy: actor, source: 'CC手动' as const } : undefined
        const appointments = appointment?.booked ? [{ appointmentId: uid('sa_'), scheduledStartAt: appointment.scheduledStartAt!, timezone: 'Asia/Ho_Chi_Minh', meetingLink: appointment.meetingLink, appointmentStatus: '已预约' as const, attendanceStatus: '待标记' as const, consultationStatus: '待标记' as const, note, createdBy: actor, createdAt: now }, ...(x.salesAppointments ?? [])] : x.salesAppointments
        return {
              ...x,
              purchaseIntention: intention as any,
              salesAppointments: appointments,
              salesLifecycleEvents: appointmentEvent ? [appointmentEvent, ...(x.salesLifecycleEvents ?? [])] : x.salesLifecycleEvents,
              salesLatestNote: followNote,
              salesUpdatedAt: now,
              salesHistory: [
                { progress: x.salesProgress || '跟进中', note: followNote, time: now, owner: actor, audioUrl: dummyAudio, aiSummary: dummySummary },
                ...(x.salesHistory || []),
              ],
            }
      }),
    }))
    setDialing(null)
    message.success(t('sales.dialed'))
  }

  const saveConsultation = (action: 'create' | 'reschedule' | 'cancel' | 'attended' | 'noShow' | 'completed' | 'incomplete' | 'contact' | 'close' | 'reactivate', values: any) => {
    if (!consulting) return
    const now = dayjs().format('YYYY-MM-DD HH:mm:ss')
    const label: Record<string, string> = { create: '创建销售咨询预约', reschedule: '销售咨询已改期', cancel: '取消销售咨询预约', attended: '标记已出勤', noShow: '标记 No Show', completed: '标记咨询完成', incomplete: '标记咨询未完成', contact: '记录其他渠道联系', close: '关闭 Lead', reactivate: '重新激活 Lead' }
    setState((prev) => ({ ...prev, students: prev.students.map((student) => {
      if (student.studentId !== consulting.studentId) return student
      const current = currentAppointment(student)
      let appointments = [...(student.salesAppointments ?? [])]
      if (action === 'create' || action === 'reschedule') {
        if (action === 'reschedule' && current) appointments = appointments.map((item) => item.appointmentId === current.appointmentId ? { ...item, appointmentStatus: '已改期', reason: values.reason, updatedBy: actor, updatedAt: now } : item)
        appointments = [{ appointmentId: uid('sa_'), scheduledStartAt: values.scheduledStartAt!, timezone: values.timezone || 'Asia/Ho_Chi_Minh', meetingLink: values.meetingLink, appointmentStatus: '已预约', attendanceStatus: '待标记', consultationStatus: '待标记', note: values.note, createdBy: actor, createdAt: now }, ...appointments]
      } else if (current && ['cancel', 'attended', 'noShow', 'completed', 'incomplete'].includes(action)) {
        appointments = appointments.map((item) => {
          if (item.appointmentId !== current.appointmentId) return item
          if (action === 'cancel') return { ...item, appointmentStatus: '已取消', reason: values.reason, note: values.note, updatedBy: actor, updatedAt: now }
          if (action === 'attended') return { ...item, attendanceStatus: '已出勤', note: values.note, updatedBy: actor, updatedAt: now }
          if (action === 'noShow') return { ...item, attendanceStatus: 'No Show', reason: values.reason, note: values.note, updatedBy: actor, updatedAt: now }
          return { ...item, consultationStatus: action === 'completed' ? '已完成' : '未完成', note: values.note, updatedBy: actor, updatedAt: now }
        })
      }
      const result: Record<string, string> = { create: '已预约', reschedule: '已改期', cancel: '已取消', attended: '已出勤', noShow: 'No Show', completed: '咨询完成', incomplete: '咨询未完成', close: '已关闭', reactivate: '已再激活' }
      const event = { eventId: uid('sle_'), node: (action === 'contact' ? 'contact' : action === 'close' || action === 'reactivate' ? 'lead' : ['create', 'reschedule', 'cancel'].includes(action) ? 'appointment' : ['attended', 'noShow'].includes(action) ? 'attendance' : 'consultation') as SalesLifecycleNode, result: action === 'contact' ? values.contactResult : result[action], reason: values.reason, description: values.note, contactChannel: values.contactChannel, appointmentId: current?.appointmentId, occurredAt: values.occurredAt || now, reportedAt: now, reportedBy: actor, source: 'CC手动' as const }
      const note = `【销售咨询】${label[action]}${values.reason ? `：${values.reason}` : ''}`
      return { ...student, salesLifecycleStatus: action === 'close' ? '已关闭' : action === 'reactivate' ? '进行中' : student.salesLifecycleStatus, salesAppointments: appointments, salesLifecycleEvents: [event, ...(student.salesLifecycleEvents ?? [])], salesLatestNote: note, salesUpdatedAt: now, salesHistory: [{ progress: student.salesProgress || '跟进中', note, time: now, owner: actor }, ...(student.salesHistory || [])] }
    }) }))
    setConsulting(null)
    message.success(label[action])
  }

  const typeCol = {
    title: t('user.col.userType'),
    dataIndex: 'userType',
    width: 100,
    render: (_: UserType, r: Student) => {
      const tp = resolveUserType(r)
      return <Tag color={USER_TYPE_COLOR[tp]}>{t(`enum.userType.${tp}`)}</Tag>
    },
  }
  const consultationColumns: ColumnsType<Student> = [
    {
      title: t('sales.consultation.stage'),
      key: 'consultationStage',
      width: 210,
      render: (_: unknown, s) => {
        const stage = consultationStage(s, callRecords)
        if (s.businessLine !== '越南') return <Text type="secondary">—</Text>
        return <Space direction="vertical" size={2}>
          <Tag color={CONSULTATION_STAGE_COLOR[stage]}>{t(`sales.consultation.stage.${stage}`)}</Tag>
          {stage === '待外呼' && s.landingCallbackAt && <span style={{ whiteSpace: 'nowrap' }}>预约外呼：<LocalTime time={s.landingCallbackAt} country={s.country || s.businessLine} /></span>}
        </Space>
      },
    },
  ]
  // 基于「用户中心-二期」字段增加
  const userColumns: ColumnsType<Student> = [
    {
      title: t('user.col.id'),
      dataIndex: 'studentId',
      width: 190,
      fixed: 'left',
      render: (id: string) =>
        detailPath ? <Button type="link" style={{ padding: 0 }} onClick={() => navigate(detailPath + '/' + id)}>{id}</Button> : id,
    },
    { title: t('user.col.name'), dataIndex: 'localName', width: 140, render: (_, r) => r.localName || r.name },
    {
      title: t('user.col.purchaseIntention'),
      dataIndex: 'purchaseIntention',
      width: 100,
      render: (v: string | undefined) => {
        if (v === '有意向') return <Tag color="green">{t('sales.purchaseIntention.yes')}</Tag>
        if (v === '无意向') return <Tag color="red">{t('sales.purchaseIntention.no')}</Tag>
        return <Text type="secondary">{t('sales.purchaseIntention.none')}</Text>
      },
    },
    {
      title: t('user.col.status'),
      dataIndex: 'status',
      width: 130,
      render: (_: unknown, r: Student) => {
        const status = resolveUserStatus(r, lessons)
        return <Tag color={STATUS_COLOR[status]}>{t(`enum.status.${status}`)}</Tag>
      },
    },
    typeCol,
    {
      title: t('user.col.ageGroup'),
      dataIndex: 'ageGroup',
      width: 100,
      render: (v: string | undefined) => (v ? <Tag color="geekblue">{v}</Tag> : <Text type="secondary">—</Text>),
    },
    {
      title: t('user.col.courseLevel'),
      dataIndex: 'courseLevel',
      width: 100,
      render: (v: string | undefined) => (v ? <Tag color="purple">{v}</Tag> : <Text type="secondary">—</Text>),
    },
    { title: t('user.col.account'), dataIndex: 'account', width: 200, render: (v) => <Text>{v}</Text> },
    {
      title: t('user.col.channelSourceLp'),
      dataIndex: 'adChannelLp',
      width: 200,
      render: (_: unknown, r: Student) => {
        const txt = lpChannelSourceText(channels, r)
        return txt === '—' ? <Text type="secondary">—</Text> : <span>{txt}</span>
      },
    },
    {
      title: t('user.col.code'),
      dataIndex: 'channelCode',
      width: 160,
      render: (v: string | undefined) => (v ? <Text code>{v}</Text> : <Text type="secondary">—</Text>),
    },
    {
      title: t('user.col.channelSourceApp'),
      dataIndex: 'adChannelApp',
      width: 200,
      render: (_: unknown, r: Student) => {
        const txt = appChannelSourceText(r)
        return txt === '—' ? <Text type="secondary">—</Text> : <span>{txt}</span>
      },
    },
    { title: t('user.col.country'), dataIndex: 'country', width: 110, render: (_, r) => <Tag>{lineLabel(r)}</Tag> },
    {
      title: t('user.col.regTime'),
      dataIndex: 'registerTime',
      width: 200,
      render: (v: string | undefined, r: Student) => <LocalTime time={v} country={r.country || r.businessLine} />,
    },
    {
      title: t('user.col.cc'),
      dataIndex: 'salesOwner',
      width: 140,
      render: (v: string | undefined) => {
        if (!v) return <Text type="secondary">—</Text>
        const acc = accounts.find(a => a.email === v)
        return <span>{acc?.name || v}</span>
      },
    },
    ...(isLeader ? [{
      title: '外呼情况',
      key: 'callCount',
      width: 120,
      render: (_: unknown, row: Student) => {
        const count = leadCallCounts.get(row.studentId) || 0
        return count ? <Tag color="blue">{t('sales.outreach.called', { n: count })}</Tag> : <Text type="secondary">{t('sales.outreach.notCalled')}</Text>
      },
    }] : []),
  ]

  const poolColumns: ColumnsType<Student> = [
    ...userColumns,
    ...(canClaim
      ? [
          {
            title: t('common.action'),
            key: 'op',
            width: 120,
            fixed: 'right' as const,
            render: (_: unknown, r: Student) => (
              <Button type="link" icon={<CheckOutlined />} onClick={() => claim(r)}>
                {t('perm.sales_claim')}
              </Button>
            ),
          },
        ]
      : []),
  ]

  const followColumns: ColumnsType<Student> = [
    ...userColumns,
    ...consultationColumns,
    {
      title: t('sales.col.latestNote'),
      dataIndex: 'salesLatestNote',
      width: 220,
      ellipsis: true,
      render: (v: string | undefined) => v || <Text type="secondary">—</Text>,
    },
    { title: t('sales.col.updatedAt'), dataIndex: 'salesUpdatedAt', width: 170, render: (v) => v || <Text type="secondary">—</Text> },
    ...(canEdit || canDial || canReassign
      ? [
          {
            title: t('common.action'),
            key: 'op',
            width: phase3 ? 220 : canReassign ? 350 : 250,
            fixed: 'right' as const,
            render: (_: unknown, r: Student) => phase3 ? (
              <Space size={8}>
                {canDial && (
                  <Button type="link" icon={<PhoneOutlined />} disabled={!r.phone} onClick={() => setDialing(r)}>
                    外呼
                  </Button>
                )}
                <Dropdown
                  trigger={['click']}
                  menu={{
                    items: [
                      ...(canEdit ? [{ key: 'follow', icon: <EditOutlined />, label: '更新跟进', onClick: () => openFollow(r) }] : []),
                      ...(canReassign ? [{ key: 'reassign', icon: <SwapOutlined />, label: '重新分配线索', onClick: () => openReassign(r) }] : []),
                      ...(canViewReport && latestTrialReport(lessons, r.studentId)
                        ? [{ key: 'trialReport', label: '试听报告', onClick: () => window.open(TRIAL_REPORT_URL, '_blank', 'noopener,noreferrer') }]
                        : []),
                      ...(canEdit ? [
                        { key: 'drop', danger: true, icon: <RollbackOutlined />, label: '退回公海', onClick: () => openDrop(r) },
                        { key: 'trialLevel', label: '修改试听课等级', onClick: () => openTrialLevel(r) },
                      ] : []),
                    ],
                  }}
                >
                  <Button>更多 <DownOutlined /></Button>
                </Dropdown>
              </Space>
            ) : (
              <Space size={0}>
                {canDial && (
                  <Button type="link" icon={<PhoneOutlined />} disabled={!r.phone} onClick={() => setDialing(r)}>
                    {t('perm.sales_dial')}
                  </Button>
                )}
                {canEdit && (
                  <Button type="link" icon={<EditOutlined />} onClick={() => openFollow(r)}>
                    {t('perm.sales_update')}
                  </Button>
                )}
                {canReassign && (
                  <Button type="link" icon={<SwapOutlined />} onClick={() => openReassign(r)}>
                    {t('perm.sales_reassign')}
                  </Button>
                )}
                {canEdit && (
                  <Button type="link" danger icon={<RollbackOutlined />} onClick={() => openDrop(r)}>
                    {t('sales.dropToPool')}
                  </Button>
                )}
              </Space>
            ),
          },
        ]
      : []),
  ]

  const callColumns: ColumnsType<CallRecord> = [
    { title: t('sales.call.time'), dataIndex: 'time', width: 180 },
    { title: t('sales.call.customer'), dataIndex: 'customer', width: 140 },
    ...(phase3 ? [{ title: '用户ID', dataIndex: 'studentId', width: 190, render: (v: string) => <Text code>{v}</Text> }] : []),
    { title: t('user.col.phone'), dataIndex: 'phone', width: 160 },
    {
      title: t('sales.call.result'),
      dataIndex: 'result',
      width: 110,
      render: (v: CallResult) => <Tag color={CALL_RESULT_COLOR[v]}>{t(`sales.callResult.${v}`)}</Tag>,
    },
    { title: t('sales.call.duration'), dataIndex: 'duration', width: 90 },
    {
      title: '录音',
      dataIndex: 'audioUrl',
      width: 110,
      render: (url: string | undefined) =>
        url ? <Button type="link" style={{ padding: 0 }} onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}>播放</Button> : <Text type="secondary">—</Text>,
    },
    {
      title: t('sales.call.note'),
      dataIndex: 'note',
      width: 340,
      ellipsis: true,
      render: (v: string) => v || <Text type="secondary">—</Text>,
    },
    { title: t('sales.call.agent'), dataIndex: 'agent', width: 190 },
  ]

  const callSummaryColumns: ColumnsType<{ key: string; agent: string; country: string; outboundLeads: number; connectedLeads: number; total: number; answered: number; seconds: number }> = [
    { title: t('user.col.cc'), dataIndex: 'agent', width: 170, render: (email: string) => accounts.find((item) => item.email === email)?.name || email },
    { title: t('user.col.country'), dataIndex: 'country', width: 110, render: (country: string) => <Tag>{country}</Tag> },
    { title: t('sales.outreach.outboundLeads'), dataIndex: 'outboundLeads', width: 120 },
    { title: t('sales.outreach.connectedLeads'), dataIndex: 'connectedLeads', width: 130, render: (value: number) => <Tag color="green">{value}</Tag> },
    { title: t('sales.outreach.totalDials'), dataIndex: 'total', width: 100 },
    { title: t('sales.outreach.answeredCalls'), dataIndex: 'answered', width: 110, render: (value: number) => <Tag color="green">{value}</Tag> },
    { title: t('sales.outreach.totalTalkDuration'), dataIndex: 'seconds', width: 150, render: (value: number) => fmtDuration(value) },
  ]

  const [showIntro, setShowIntro] = useState(false)

  const totalLeads = students.filter((s) => isSalesLead(s, lessons)).length

  const resetLeadFilters = () => {
    setPurchaseIntentionFilter([])
    setOwnerFilter(undefined)
    setAgeGroupFilter([])
    setCourseLevelFilter([])
    setRegisterChannelFilter([])
    setUserTypeFilter([])
    setRegisterDateRange(null)
    setFollowDateRange(null)
    setConsultationStageFilter([])
    setLandingCallbackFilter(undefined)
  }

  const filterBar = (
    <div className="sales-filter-bar">
      {tab !== 'summary' && <Input
        className="sales-filter-search"
        allowClear
        prefix={<SearchOutlined />}
        placeholder={tab === 'calls' ? (phase3 ? '搜索用户ID / 姓名 / 登录账号' : t('sales.searchCalls')) : t('sales.searchFollow')}
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
      />}
      <div className="sales-filter-control">
        <LineFilter value={lineSel} onChange={setLineSel} options={filterOptions(lineOptions)} width={0} placeholder={t('user.col.country')} disabled={lineDisabled} />
      </div>
      {(tab === 'calls' || tab === 'summary') ? (
        <>
          {tab === 'calls' && <Select className="sales-filter-control" allowClear placeholder={t('sales.call.result')} value={callResultFilter} onChange={setCallResultFilter} options={CALL_RESULTS.map((r) => ({ label: t(`sales.callResult.${r}`), value: r }))} />}
          {seeAllOwners && <Select className="sales-filter-control" allowClear showSearch optionFilterProp="label" placeholder={t('sales.call.agent')} value={callAgentFilter} onChange={setCallAgentFilter} options={salesAccounts.map((item) => ({ label: `${item.name}（${item.email}）`, value: item.email }))} />}
          <DatePicker.RangePicker className="sales-filter-date" onChange={setCallDateRange} allowClear placeholder={[t('pkg.startTime'), t('pkg.endTime')]} />
        </>
      ) : <>
        {seeAllOwners && <Select className="sales-filter-control" allowClear showSearch optionFilterProp="label" placeholder={t('user.col.cc')} value={ownerFilter} onChange={setOwnerFilter} options={[{ label: t('sales.unassigned'), value: '__unassigned__' }, ...salesAccounts.map((item) => ({ label: `${item.name}（${item.email}）`, value: item.email }))]} />}
        {tab === 'follow' && showVietnamStageFilter && <Select className="sales-filter-control" mode="multiple" allowClear maxTagCount="responsive" placeholder={t('sales.consultation.filter')} value={consultationStageFilter} onChange={setConsultationStageFilter} options={CONSULTATION_STAGES.map((value) => ({ label: t(`sales.consultation.stage.${value}`), value }))} />}
        <Select className="sales-filter-control" allowClear placeholder="预约外呼" value={landingCallbackFilter} onChange={setLandingCallbackFilter} options={[{ label: '已填写预约外呼', value: 'filled' }, { label: '待外呼（已到时间）', value: 'due' }, { label: '即将外呼（24小时内）', value: 'upcoming' }]} />
        <Select className="sales-filter-control" mode="multiple" allowClear maxTagCount="responsive" placeholder="购买意向" value={purchaseIntentionFilter} onChange={setPurchaseIntentionFilter} options={['有意向', '无意向', '未填写'].map((value) => ({ label: value, value }))} />
        <Select className="sales-filter-control" mode="multiple" allowClear maxTagCount="responsive" placeholder="课程等级" value={courseLevelFilter} onChange={setCourseLevelFilter} options={courseLevelOptions.map((value) => ({ label: value, value }))} />
        <Select className="sales-filter-control" mode="multiple" allowClear maxTagCount="responsive" placeholder="用户类型" value={userTypeFilter} onChange={setUserTypeFilter} options={['正式用户', '测试用户'].map((value) => ({ label: value, value }))} />
        <Select className="sales-filter-control" mode="multiple" allowClear maxTagCount="responsive" placeholder="年龄段" value={ageGroupFilter} onChange={setAgeGroupFilter} options={ageGroupOptions.map((value) => ({ label: value, value }))} />
        <Select className="sales-filter-control" mode="multiple" allowClear maxTagCount="responsive" placeholder="注册来源" value={registerChannelFilter} onChange={setRegisterChannelFilter} options={registerChannelOptions.map((value) => ({ label: value, value }))} />
        <DatePicker.RangePicker className="sales-filter-date" value={registerDateRange} onChange={setRegisterDateRange} allowClear placeholder={['注册开始日期', '注册结束日期']} />
        <DatePicker.RangePicker className="sales-filter-date" value={followDateRange} onChange={setFollowDateRange} allowClear placeholder={['最后跟进开始日期', '最后跟进结束日期']} />
      </>}
      <div className="sales-filter-actions">
        {tab !== 'calls' && tab !== 'summary' && <Button type="link" onClick={resetLeadFilters}>重置筛选</Button>}
        {tab !== 'calls' && tab !== 'summary' && importAction}
      </div>
    </div>
  )

  return (
    <Card
      className="page-card"
      bordered={false}
      title={<span className="section-title">{t('sales.title')}</span>}
      extra={
        canManageSettings && (
          <Button icon={<SettingOutlined />} onClick={() => setSettingsOpen(true)}>
            {t('sales.settings')}
          </Button>
        )
      }
    >
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{t('sales.flow')}</span>
            <Button type="link" size="small" onClick={() => setShowIntro(!showIntro)} style={{ padding: 0 }}>
              {showIntro ? t('common.collapse') : t('common.viewDetails')}
            </Button>
          </div>
        }
        description={showIntro ? t('sales.intro') : undefined}
      />

      <Tabs
        activeKey={tab}
        onChange={setTab}
        items={[
          {
            key: 'pool',
            label: `${t('sales.tab.pool')} (${poolAll.length})`,
            children: (
              <>
                {filterBar}
                <Table
                  rowKey="studentId"
                  columns={poolColumns}
                  dataSource={poolData}
                  scroll={{ x: 2180 + 90 }}
                  locale={{ emptyText: t('sales.emptyPool') }}
                  pagination={{ showTotal: (n) => t('common.total', { n }), showSizeChanger: true }}
                />
              </>
            ),
          },
          {
            key: 'follow',
            label: `${t('sales.tab.follow')} (${followAll.length})`,
            children: (
              <>
                {filterBar}
                {isLeader && (
                  <Alert type="info" showIcon style={{ marginBottom: 16 }} message={t('sales.leaderTip')} />
                )}
                <Table
                  rowKey="studentId"
                  columns={followColumns}
                  dataSource={followData}
                  scroll={{ x: canReassign ? 2180 + 200 + 130 + 100 : 2180 + 200 + 130 }}
                  locale={{ emptyText: t('sales.emptyFollow') }}
                  pagination={{ showTotal: (n) => t('common.total', { n }), showSizeChanger: true }}
                />
              </>
            ),
          },
          {
            key: 'calls',
            label: `${t('sales.tab.calls')} (${callScoped.length})`,
            children: (
              <>
                {filterBar}
                <Alert type="info" showIcon style={{ marginBottom: 16 }} message={t('sales.callsBanner')} />
                <Table rowKey="id" columns={callColumns} dataSource={callData} scroll={{ x: 1210 }} locale={{ emptyText: t('sales.emptyCalls') }} pagination={{ showTotal: (n) => t('common.total', { n }), showSizeChanger: true }} />
              </>
            ),
          },
          {
            key: 'summary',
            label: t('sales.outreach.tab'),
            children: (
              <>
                {filterBar}
                <Alert type="info" showIcon style={{ marginBottom: 16 }} message={seeAllOwners ? t('sales.outreach.managerTip') : t('sales.outreach.personalTip')} />
                <section className="sales-call-summary" aria-label={t('sales.outreach.title')}>
                  <div className="sales-call-summary-head">
                    <div>
                      <Text strong>{t('sales.outreach.title')}</Text>
                      <Text type="secondary">{t('sales.outreach.flow')}</Text>
                    </div>
                  </div>
                  <div className="sales-call-metric-groups">
                    <section className="sales-call-metric-group">
                      <Text type="secondary" className="sales-call-metric-group-title">{t('sales.outreach.leadMetrics')}</Text>
                      <div className="sales-call-metrics">
                        <Card size="small"><Statistic title={t('sales.outreach.outboundLeads')} value={callSummary.outboundLeads} suffix={t('sales.outreach.people')} /></Card>
                        <Card size="small"><Statistic title={t('sales.outreach.connectedLeads')} value={callSummary.connectedLeads} suffix={t('sales.outreach.people')} valueStyle={{ color: '#389e0d' }} /></Card>
                      </div>
                    </section>
                    <section className="sales-call-metric-group">
                      <Text type="secondary" className="sales-call-metric-group-title">{t('sales.outreach.callMetrics')}</Text>
                      <div className="sales-call-metrics">
                        <Card size="small"><Statistic title={t('sales.outreach.totalDials')} value={callSummary.total} suffix={t('sales.outreach.calls')} /></Card>
                        <Card size="small"><Statistic title={t('sales.outreach.answeredCalls')} value={callSummary.answered} suffix={t('sales.outreach.calls')} valueStyle={{ color: '#389e0d' }} /></Card>
                        <Card size="small"><Statistic title={t('sales.outreach.totalTalkDuration')} value={fmtDuration(callSummary.totalSeconds)} /></Card>
                      </div>
                    </section>
                  </div>
                  <Table size="small" rowKey="key" columns={callSummaryColumns} dataSource={callSummary.rows} pagination={false} scroll={{ x: 940 }} locale={{ emptyText: t('sales.outreach.empty') }} />
                </section>
              </>
            ),
          },
        ]}
      />

      <div style={{ marginTop: 4 }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          {t('sales.totalTip', { n: totalLeads })}
        </Text>
      </div>

      <Modal_Follow
        t={t}
        editing={editing}
        form={form}
        hasConnectedCall={editing ? callRecords.some((item) => item.studentId === editing.studentId && item.result === '已接通') : false}
        currentStage={editing ? consultationStage(editing, callRecords) : undefined}
        onCancel={() => setEditing(null)}
        onOk={saveFollow}
      />

      <Modal_Dial t={t} dialing={dialing} onCancel={() => setDialing(null)} onSave={saveCall} />
      <Modal_Consultation student={consulting} paid={consulting ? isPaidStudent(consulting) : false} hasConnectedCall={consulting ? callRecords.some((item) => item.studentId === consulting.studentId && item.result === '已接通') : false} onCancel={() => setConsulting(null)} onSave={saveConsultation} />

      <Modal
        open={!!reassigning}
        title={t('sales.reassign.title')}
        onCancel={() => setReassigning(null)}
        onOk={doReassign}
        okText={t('sales.reassign')}
        cancelText={t('common.cancel')}
        width={480}
        destroyOnClose
      >
        <div style={{ marginBottom: 12 }}>
          <Text type="secondary">{t('sales.reassign.current')}：</Text>
          <Text strong>{reassigning?.salesOwner || '—'}</Text>
        </div>
        <div style={{ marginBottom: 6 }}>{t('sales.reassign.to')}</div>
        <Select
          style={{ width: '100%' }}
          showSearch
          optionFilterProp="label"
          placeholder={t('sales.reassign.toPlaceholder')}
          value={reassignTo}
          onChange={setReassignTo}
          options={salesAccounts
            .filter((a) => a.email !== reassigning?.salesOwner)
            .map((a) => ({ label: `${a.name}（${a.email}）`, value: a.email }))}
        />
      </Modal>

      <Modal
        open={!!dropping}
        title={t('sales.drop.title')}
        onCancel={() => setDropping(null)}
        onOk={doDrop}
        okText={t('common.confirm')}
        cancelText={t('common.cancel')}
        destroyOnClose
      >
        <Form form={dropForm} layout="vertical" preserve={false} style={{ marginTop: 16 }}>
          <Form.Item
            name="reason"
            label={t('sales.drop.reason')}
            rules={[{ required: true, message: t('sales.drop.reasonRequired') }]}
          >
            <Input.TextArea rows={3} placeholder={t('sales.drop.reasonPlaceholder')} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        open={!!trialLevelStudent}
        title={`修改试听课等级 · ${trialLevelStudent?.studentId ?? ''}`}
        onCancel={() => setTrialLevelStudent(null)}
        onOk={saveTrialLevel}
        okText={t('common.save')}
        cancelText={t('common.cancel')}
        destroyOnClose
      >
        <Form form={trialLevelForm} layout="vertical" preserve={false}>
          <Form.Item name="courseLevel" label="试听课等级" rules={[{ required: true, message: '请选择试听课等级' }]}>
            <Select options={['L1', 'L2', 'L3', 'L4', 'L5'].map((value) => ({ label: value, value }))} />
          </Form.Item>
        </Form>
      </Modal>

      {settingsOpen && (
        <Modal_Settings
          t={t}
          open={settingsOpen}
          initialSettingsMap={salesSettings || {}}
          salesAccounts={salesAccounts}
          configurableLines={allowedLines() === null ? lineOptions : allowedLines()!}
          onCancel={() => setSettingsOpen(false)}
          onOk={(newSettingsMap) => {
            updateSalesSettings(newSettingsMap)
            setSettingsOpen(false)
            message.success(t('sales.settings.saved'))
          }}
        />
      )}
    </Card>
  )
}

function Modal_Consultation({ student, paid, hasConnectedCall, onCancel, onSave }: { student: Student | null; paid: boolean; hasConnectedCall: boolean; onCancel: () => void; onSave: (action: any, values: any) => void }) {
  const [form] = Form.useForm()
  const [action, setAction] = useState<string | null>(null)
  const active = student ? currentAppointment(student) : undefined
  const appointments = student?.salesAppointments ?? []
  const closed = student?.salesLifecycleStatus === '已关闭'
  const start = (next: string) => { setAction(next); form.resetFields(); form.setFieldValue('occurredAt', dayjs()); if (next === 'create') form.setFieldValue('timezone', 'Asia/Ho_Chi_Minh') }
  const submit = async () => { const v = await form.validateFields(); onSave(action, { ...v, scheduledStartAt: v.scheduledStartAt?.format('YYYY-MM-DD HH:mm:ss'), occurredAt: v.occurredAt?.format('YYYY-MM-DD HH:mm:ss') }) }
  const title: Record<string, string> = { create: '创建销售咨询预约', reschedule: '改期销售咨询', cancel: '取消预约', attended: '标记已出勤', noShow: '标记 No Show', completed: '标记咨询完成', incomplete: '标记咨询未完成', contact: '记录其他渠道联系', close: '关闭 Lead', reactivate: '重新激活 Lead' }
  return <Modal open={!!student} title={`销售咨询链路标记 · ${student?.localName || student?.name || ''}`} width={720} destroyOnClose onCancel={onCancel} footer={action ? [<Button key="back" onClick={() => setAction(null)}>返回</Button>, <Button key="save" type="primary" onClick={submit}>确认</Button>] : [<Button key="close" onClick={onCancel}>关闭</Button>]}>
    {student && !action && <>
      <Alert type={paid ? 'success' : closed ? 'warning' : 'info'} showIcon style={{ marginBottom: 16 }} message={paid ? '已成交：支付状态来自订单中心' : closed ? '链路状态：已关闭' : `当前阶段：${consultationStage(student)}`} description="所有变更均会记录原因、说明、业务发生时间和操作人。" />
      {active ? <Card size="small" title="当前有效预约" style={{ marginBottom: 16 }}><Space direction="vertical"><span>预约时间：<LocalTime time={active.scheduledStartAt} country="越南" /></span><span>出勤：<Tag>{active.attendanceStatus}</Tag>　咨询完成：<Tag>{active.consultationStatus}</Tag></span></Space></Card> : <Alert type="warning" showIcon style={{ marginBottom: 16 }} message="当前无有效预约" />}
      {!paid && !closed && <Space wrap style={{ marginBottom: 16 }}>
        {!active && (hasConnectedCall || appointments.length > 0) && <Button type="primary" onClick={() => start('create')}>创建预约</Button>}
        <Button onClick={() => start('contact')}>记录其他渠道联系</Button>
        {active?.attendanceStatus === '待标记' && <><Button onClick={() => start('reschedule')}>改期</Button><Button danger onClick={() => start('cancel')}>取消预约</Button><Button type="primary" onClick={() => start('attended')}>标记已出勤</Button><Button danger onClick={() => start('noShow')}>标记 No Show</Button></>}
        {active?.attendanceStatus === '已出勤' && active.consultationStatus === '待标记' && <><Button type="primary" onClick={() => start('completed')}>标记咨询完成</Button><Button onClick={() => start('incomplete')}>标记咨询未完成</Button></>}
        {active && (active.attendanceStatus === 'No Show' || active.consultationStatus !== '待标记') && <Button type="primary" onClick={() => start('reschedule')}>再次预约</Button>}
        <Button danger onClick={() => start('close')}>关闭 Lead</Button>
      </Space>}
      {!paid && !closed && !active && !hasConnectedCall && !appointments.length && <Alert type="warning" showIcon message="请先完成电话外呼并获得已接听结果" description="Lead 的首次预约必须由电话已接听推进。" />}
      {!paid && closed && <Button type="primary" onClick={() => start('reactivate')}>重新激活 Lead</Button>}
      <Text strong style={{ display: 'block', marginTop: 12 }}>预约历史</Text><Timeline style={{ marginTop: 12 }} items={appointments.length ? appointments.map((item) => ({ children: `${item.appointmentStatus} · ${item.scheduledStartAt} · 出勤：${item.attendanceStatus} · 咨询：${item.consultationStatus}${item.reason ? ` · 原因：${item.reason}` : ''}` })) : [{ color: 'gray', children: '暂无销售咨询预约' }]} />
    </>}
    {student && action && <Form form={form} layout="vertical" preserve={false}><Alert type="info" showIcon style={{ marginBottom: 16 }} message={title[action]} />
      {['create', 'reschedule'].includes(action) && <><Form.Item name="scheduledStartAt" label="预约开始时间" rules={[{ required: true, message: '请选择预约开始时间' }]}><DatePicker showTime style={{ width: '100%' }} /></Form.Item><Form.Item name="timezone" label="时区" rules={[{ required: true }]}><Select options={[{ label: '越南（Asia/Ho_Chi_Minh）', value: 'Asia/Ho_Chi_Minh' }]} /></Form.Item><Form.Item name="meetingLink" label="Google Meet 链接"><Input /></Form.Item></>}
      {action === 'contact' && <><Form.Item name="contactChannel" label="联系渠道" rules={[{ required: true, message: '请选择联系渠道' }]}><Select options={['Zalo', 'WhatsApp', '用户主动联系', '其他'].map((value) => ({ label: value, value }))} /></Form.Item><Form.Item name="contactResult" label="联系结果" rules={[{ required: true, message: '请选择联系结果' }]}><Select options={['已联系成功', '未联系成功'].map((value) => ({ label: value, value }))} /></Form.Item></>}
      {['reschedule', 'cancel', 'noShow', 'incomplete', 'close'].includes(action) && <Form.Item name="reason" label="原因" rules={[{ required: true, message: '请填写原因' }]}><Input.TextArea rows={3} /></Form.Item>}
      <Form.Item name="occurredAt" label="业务发生时间" rules={[{ required: true, message: '请选择业务发生时间' }]}><DatePicker showTime style={{ width: '100%' }} /></Form.Item><Form.Item name="note" label="标记说明" rules={[{ required: true, message: '请填写本次标记说明' }]}><Input.TextArea rows={3} /></Form.Item>
    </Form>}
  </Modal>
}

// 外呼弹窗：模拟发起呼叫 → 挂断后填写通话小结
function Modal_Dial({
  t,
  dialing,
  onCancel,
  onSave,
}: {
  t: (k: string, v?: Record<string, string | number>) => string
  dialing: Student | null
  onCancel: () => void
  onSave: (note: string, intention: string, appointment?: { booked: boolean; scheduledStartAt?: string; meetingLink?: string }) => void
}) {
  const [phase, setPhase] = useState<'calling' | 'summary'>('calling')
  const [seconds, setSeconds] = useState(0)
  const [note, setNote] = useState('')
  const [purchaseIntention, setPurchaseIntention] = useState('未填写')
  const [appointmentAction, setAppointmentAction] = useState<'create' | 'continue'>('continue')
  const [appointmentTime, setAppointmentTime] = useState<any>(null)
  const [meetingLink, setMeetingLink] = useState('')

  // 打开弹窗时重置状态并开始计时
  useEffect(() => {
    if (dialing) {
      setPhase('calling')
      setSeconds(0)
      setNote('')
      setPurchaseIntention(dialing.purchaseIntention || '未填写')
      setAppointmentAction('continue')
      setAppointmentTime(null)
      setMeetingLink('')
    }
  }, [dialing])

  useEffect(() => {
    if (!dialing || phase !== 'calling') return
    const id = setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => clearInterval(id)
  }, [dialing, phase])

  const handleHangup = () => {
    setPhase('summary')
  }

  const submit = () => {
    if (!note.trim()) {
      message.warning(t('sales.dial.noteRequired'))
      return
    }
    if (dialing?.businessLine === '越南' && appointmentAction === 'create' && !appointmentTime) {
      message.warning('请选择销售咨询预约时间')
      return
    }
    onSave(note, purchaseIntention, dialing?.businessLine === '越南' ? { booked: appointmentAction === 'create', scheduledStartAt: appointmentTime?.format('YYYY-MM-DD HH:mm:ss'), meetingLink } : undefined)
  }

  return (
    <Modal
      open={!!dialing}
      title={t('sales.dial.title', { name: dialing?.localName || dialing?.name || '' })}
      onCancel={onCancel}
      width={520}
      destroyOnClose
      footer={
        phase === 'calling'
          ? [
              <Button key="hangup" danger type="primary" icon={<PhoneOutlined />} onClick={handleHangup}>
                {t('sales.dial.hangup')}
              </Button>,
            ]
          : [
              <Button key="cancel" onClick={onCancel}>
                {t('common.cancel')}
              </Button>,
              <Button key="save" type="primary" onClick={submit}>
                {t('sales.dial.save')}
              </Button>,
            ]
      }
    >
      <div style={{ padding: '4px 0 12px' }}>
        <div style={{ fontSize: 15 }}>
          <Text strong>{dialing?.localName || dialing?.name}</Text>
          <Tag style={{ marginInlineStart: 8 }}>{dialing?.businessLine}</Tag>
        </div>
        <div style={{ color: '#8c8c8c', marginTop: 4 }}>
          <PhoneOutlined /> {dialing?.phone}
        </div>
      </div>

      {phase === 'calling' ? (
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <div style={{ color: '#52c41a', marginBottom: 8 }}>{t('sales.dial.connected')}</div>
          <div style={{ fontSize: 34, fontWeight: 600, letterSpacing: 2 }}>{fmtDuration(seconds)}</div>
        </div>
      ) : (
        <Form layout="vertical" style={{ marginTop: 4 }}>
          <Alert type="info" showIcon style={{ marginBottom: 12 }} message={t('sales.dial.summaryTip')} />
          <Form.Item label={t('user.col.purchaseIntention')}>
            <Select value={purchaseIntention} onChange={setPurchaseIntention}>
              <Select.Option value="未填写">{t('sales.purchaseIntention.none')}</Select.Option>
              <Select.Option value="有意向">{t('sales.purchaseIntention.yes')}</Select.Option>
              <Select.Option value="无意向">{t('sales.purchaseIntention.no')}</Select.Option>
            </Select>
          </Form.Item>
          {dialing?.businessLine === '越南' && <>
            <div style={{ marginBottom: 12 }}>{t('sales.consultation.currentStage')}：<Tag color={CONSULTATION_STAGE_COLOR['待外呼']}>{t('sales.consultation.stage.待外呼')}</Tag></div>
            <Form.Item label={t('sales.consultation.nextAction')} required>
              <Select value={appointmentAction} onChange={setAppointmentAction} options={[
                { label: t('sales.consultation.action.continue'), value: 'continue' },
                { label: t('sales.consultation.action.create'), value: 'create' },
              ]} />
            </Form.Item>
            {appointmentAction === 'create' && <><Form.Item label={t('sales.consultation.appointmentTime')} required><DatePicker showTime value={appointmentTime} onChange={setAppointmentTime} style={{ width: '100%' }} /></Form.Item><Form.Item label="Google Meet"><Input value={meetingLink} onChange={(e) => setMeetingLink(e.target.value)} placeholder={t('sales.optional')} /></Form.Item></>}
          </>}
          <Form.Item label={t('sales.f.note')} required>
            <Input.TextArea
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t('sales.f.notePlaceholder')}
            />
          </Form.Item>
        </Form>
      )}
    </Modal>
  )
}

// 更新跟进弹窗
function Modal_Follow({
  t,
  editing,
  form,
  hasConnectedCall,
  currentStage,
  onCancel,
  onOk,
}: {
  t: (k: string, v?: Record<string, string | number>) => string
  editing: Student | null
  form: ReturnType<typeof Form.useForm>[0]
  hasConnectedCall: boolean
  currentStage?: string
  onCancel: () => void
  onOk: () => void
}) {
  const history: SalesFollowLog[] = editing?.salesHistory ?? []
  // No Show、已完课等属于上一场预约的结束结果，后续应新建一场预约，不能继续推进旧预约。
  const activeAppointment = editing?.salesAppointments?.find((item) => item.appointmentStatus === '已预约' && item.attendanceStatus === '待标记' && item.consultationStatus === '待标记')
  const lifecycleAction = Form.useWatch('lifecycleAction', form)
  const reasonValue = Form.useWatch('reason', form)
  const isVietnamLead = editing?.businessLine === '越南'
  const isClosed = editing?.salesLifecycleStatus === '已关闭'
  const isPaused = editing?.salesProgress === '暂不跟进'
  const appointmentHistory = editing?.salesAppointments ?? []
  const reasonOptions: Record<string, string[]> = {
    pause: ['暂无需求', '暂不方便', '预算原因', '其他'],
    reschedule: ['客户要求改期', '时间冲突', '其他'],
    cancel: ['客户主动取消', '时间冲突', '重复预约', '其他'],
    noShow: ['客户未到会', '无法联系', '会议技术问题', '其他'],
    incomplete: ['中途离开', '时间不足', '会议异常', '其他'],
    close: ['明确拒绝', '号码无效', '重复 Lead', '要求不联系', '其他'],
  }
  const lifecycleOptions = isClosed
    ? [{ label: t('sales.consultation.action.reactivate'), value: 'reactivate' }]
    : isPaused
      ? [
          { label: t('sales.consultation.action.resume'), value: 'continue' },
          { label: t('sales.consultation.action.close'), value: 'close' },
        ]
      : [
          { label: t('sales.consultation.action.continue'), value: 'continue' },
          ...(!activeAppointment ? [{ label: t('sales.consultation.action.pause'), value: 'pause' }] : []),
          ...(!activeAppointment && currentStage !== '咨询完成待支付' && (currentStage === '待外呼' || appointmentHistory.length > 0 || hasConnectedCall) ? [{ label: t('sales.consultation.action.create'), value: 'create' }] : []),
          ...(activeAppointment ? [
        { label: t('sales.consultation.action.reschedule'), value: 'reschedule' },
        { label: t('sales.consultation.action.cancel'), value: 'cancel' },
        { label: t('sales.consultation.action.noShow'), value: 'noShow' },
        { label: t('sales.consultation.action.completed'), value: 'completed' },
        { label: t('sales.consultation.action.incomplete'), value: 'incomplete' },
          ] : []),
          ...(!activeAppointment ? [{ label: t('sales.consultation.action.close'), value: 'close' }] : []),
        ]
  const requiresReason = ['pause', 'reschedule', 'cancel', 'noShow', 'incomplete', 'close'].includes(lifecycleAction)
  return (
    <ModalWrapper open={!!editing} title={t('sales.modal.title')} onCancel={onCancel} onOk={onOk} okText={t('sales.saveFollow')} cancelText={t('common.cancel')}>
      <Form form={form} layout="vertical" preserve={false} style={{ marginTop: 8 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Form.Item label={t('user.col.phone')}>
            <Input value={editing?.phone} disabled />
          </Form.Item>
          <Form.Item label={t('sales.f.owner')}>
            <Input value={editing?.salesOwner} disabled />
          </Form.Item>
        </div>
        <Form.Item name="purchaseIntention" label={t('user.col.purchaseIntention')}>
          <Select>
            <Select.Option value="未填写">{t('sales.purchaseIntention.none')}</Select.Option>
            <Select.Option value="有意向">{t('sales.purchaseIntention.yes')}</Select.Option>
            <Select.Option value="无意向">{t('sales.purchaseIntention.no')}</Select.Option>
          </Select>
        </Form.Item>
        {isVietnamLead && <>
          {currentStage && <div style={{ marginBottom: 12 }}>{t('sales.consultation.currentStage')}：<Tag color={CONSULTATION_STAGE_COLOR[currentStage]}>{t(`sales.consultation.stage.${currentStage}`)}</Tag></div>}
          {activeAppointment && <div style={{ marginBottom: 12 }}><Tag color="blue">{t('sales.consultation.currentAppointment')}：{activeAppointment.scheduledStartAt}</Tag></div>}
          {!activeAppointment && currentStage !== '待外呼' && appointmentHistory.length === 0 && !hasConnectedCall && <Alert type="info" showIcon style={{ marginBottom: 12 }} message={t('sales.consultation.noAppointment')} description={t('sales.consultation.noAppointmentHint')} />}
          <Form.Item name="lifecycleAction" label={t('sales.consultation.nextAction')}>
            <Select options={lifecycleOptions} onChange={() => form.setFieldsValue({ reason: undefined, reasonOther: '' })} />
          </Form.Item>
          {['create', 'reschedule'].includes(lifecycleAction) && <>
            <Form.Item name="scheduledStartAt" label={t('sales.consultation.appointmentTime')} rules={[{ required: true, message: t('sales.consultation.appointmentTimeRequired') }]}><DatePicker showTime style={{ width: '100%' }} /></Form.Item>
            <Form.Item name="meetingLink" label="Google Meet"><Input placeholder={t('sales.optional')} /></Form.Item>
          </>}
          {requiresReason && <Form.Item name="reason" label={t('sales.consultation.reason')} rules={[{ required: true, message: t('sales.consultation.reasonRequired') }]}><Select options={(reasonOptions[lifecycleAction] || []).map((value) => ({ label: t(`sales.consultation.reasonOption.${value}`), value }))} /></Form.Item>}
          {requiresReason && reasonValue === '其他' && <Form.Item name="reasonOther" label={t('sales.consultation.reasonOther')} rules={[{ required: true, message: t('sales.consultation.reasonOtherRequired') }]}><Input.TextArea rows={2} /></Form.Item>}
          {lifecycleAction && lifecycleAction !== 'continue' && <Form.Item name="occurredAt" label={t('sales.consultation.occurredAt')} rules={[{ required: true, message: t('sales.consultation.occurredAtRequired') }]}><DatePicker showTime style={{ width: '100%' }} /></Form.Item>}
        </>}
        <Form.Item name="note" label={requiresReason ? t('sales.consultation.noteOptional') : t('sales.f.note')} rules={[{ required: !requiresReason, message: t('sales.f.noteRequired') }]}>
          <Input.TextArea rows={requiresReason ? 2 : 3} placeholder={requiresReason ? t('sales.consultation.noteOptionalPlaceholder') : t('sales.f.notePlaceholder')} />
        </Form.Item>
      </Form>
      <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 12 }}>
        <Text strong>{t('sales.history')}</Text>
        <div style={{ marginTop: 12 }}>
          {history.length ? (
            <Timeline
              items={history.map((h) => ({
                color: PROGRESS_COLOR[h.progress] === 'default' ? 'gray' : PROGRESS_COLOR[h.progress],
                children: (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div>
                      <Text strong>{t(`sales.progress.${h.progress}`)}</Text> · {h.note}
                    </div>
                    {h.audioUrl && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <audio controls src={h.audioUrl} style={{ height: 32, flex: 1, maxWidth: 300 }} />
                        <Button
                          size="small"
                          onClick={() => {
                            if (h.aiSummary) {
                              Modal.info({
                                title: 'AI自动总结',
                                content: h.aiSummary,
                                maskClosable: true,
                              })
                            } else {
                              message.info('AI正在总结中，稍后再试')
                            }
                          }}
                        >
                          AI自动总结
                        </Button>
                      </div>
                    )}
                    <div style={{ color: '#8c8c8c', fontSize: 12 }}>
                      {h.time} · {h.owner}
                    </div>
                  </div>
                ),
              }))}
            />
          ) : (
            <Text type="secondary">{t('sales.history.empty')}</Text>
          )}
        </div>
      </div>
    </ModalWrapper>
  )
}

function Modal_Settings({
  t,
  open,
  initialSettingsMap,
  salesAccounts,
  configurableLines,
  onCancel,
  onOk,
}: {
  t: (k: string, v?: Record<string, string | number>) => string
  open: boolean
  initialSettingsMap: Record<string, SalesSettings>
  salesAccounts: Account[]
  configurableLines: string[]
  onCancel: () => void
  onOk: (settings: Record<string, SalesSettings>) => void
}) {
  const [form] = Form.useForm()
  const enabled = Form.useWatch('autoDropEnabled', form)
  
  const [currentLine, setCurrentLine] = useState(configurableLines[0] || '')
  const [settingsMap, setSettingsMap] = useState<Record<string, SalesSettings>>(initialSettingsMap || {})

  // 根据当前选择的业务线，筛选出能接该线索的销售人员
  const lineAccounts = useMemo(() => {
    return salesAccounts.filter(
      (a) => !a.businessLines || a.businessLines.length === 0 || a.businessLines.includes(currentLine)
    )
  }, [salesAccounts, currentLine])

  // 切换业务线时，先保存当前表单，再回显新业务线的表单
  const handleLineChange = async (newLine: string) => {
    try {
      const currentValues = await form.validateFields()
      setSettingsMap((prev) => ({ ...prev, [currentLine]: currentValues as SalesSettings }))
    } catch {
      // 校验失败时不切换
      return
    }

    const nextValues = settingsMap[newLine] || {
      autoDropEnabled: false,
      autoDropMinutes: 1440,
      allocations: salesAccounts
        .filter((a) => !a.businessLines || a.businessLines.length === 0 || a.businessLines.includes(newLine))
        .map((a) => ({ email: a.email, weight: 1 })),
    }
    // 补齐可能新增的成员
    const currentAllocations = nextValues.allocations || []
    const fullAllocations = salesAccounts
      .filter((a) => !a.businessLines || a.businessLines.length === 0 || a.businessLines.includes(newLine))
      .map((a) => {
        const existing = currentAllocations.find((x) => x.email === a.email)
        return { email: a.email, weight: existing ? existing.weight : 1 }
      })

    form.setFieldsValue({ ...nextValues, allocations: fullAllocations })
    setCurrentLine(newLine)
  }

  // 初始化首次挂载的表单
  useEffect(() => {
    if (open && currentLine) {
      const initial = settingsMap[currentLine] || { autoDropEnabled: false, autoDropMinutes: 1440 }
      const initialAllocations = initial.allocations || []
      const fullAllocations = lineAccounts.map((a) => {
        const existing = initialAllocations.find((x) => x.email === a.email)
        return { email: a.email, weight: existing ? existing.weight : 1 }
      })
      form.setFieldsValue({ ...initial, allocations: fullAllocations })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  return (
    <Modal
      open={open}
      title={t('sales.settings.title')}
      onCancel={onCancel}
      onOk={async () => {
        const v = await form.validateFields()
        onOk({ ...settingsMap, [currentLine]: v as SalesSettings })
      }}
      width={640}
      destroyOnClose
      okText={t('common.save')}
      cancelText={t('common.cancel')}
    >
      <div style={{ marginBottom: 16 }}>
        <Text strong style={{ marginRight: 12 }}>所属业务线</Text>
        <Select 
          value={currentLine} 
          onChange={handleLineChange} 
          style={{ width: 200 }}
          options={configurableLines.map(l => ({ label: l, value: l }))}
        />
      </div>

      <Form form={form} layout="vertical">
        <div style={{ marginBottom: 24 }}>
          <Text strong style={{ fontSize: 16 }}>
            {t('sales.settings.dropRule')}
          </Text>
          <div style={{ marginTop: 12, padding: '16px', background: '#f5f5f5', borderRadius: 6 }}>
            <Form.Item name="autoDropEnabled" valuePropName="checked" style={{ marginBottom: 12 }}>
              <Switch checkedChildren={t('common.enable')} unCheckedChildren={t('common.disable')} />
            </Form.Item>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: enabled ? 'inherit' : '#bfbfbf' }}>
              <span>{t('sales.settings.dropDesc1')}</span>
              <Form.Item name="autoDropMinutes" noStyle rules={[{ required: true }]}>
                <InputNumber min={1} max={43200} disabled={!enabled} />
              </Form.Item>
              <span>{t('sales.settings.dropDesc2')}</span>
            </div>
          </div>
        </div>

        <div>
          <Text strong style={{ fontSize: 16 }}>
            {t('sales.settings.ratio')}
          </Text>
          <div style={{ marginTop: 12 }}>
            <Table
              size="small"
              pagination={false}
              dataSource={lineAccounts}
              rowKey="email"
              columns={[
                { title: t('sales.col.owner'), dataIndex: 'name', width: 220, render: (v, r) => `${v} (${r.email})` },
                {
                  title: t('sales.settings.weight'),
                  key: 'weight',
                  render: (_, r, i) => (
                    <Form.Item name={['allocations', i, 'weight']} noStyle rules={[{ required: true }]}>
                      <InputNumber min={0} max={100} />
                    </Form.Item>
                  ),
                },
                {
                  title: 'Email',
                  key: 'email',
                  width: 0,
                  render: (_, r, i) => (
                    <Form.Item name={['allocations', i, 'email']} hidden>
                      <Input />
                    </Form.Item>
                  ),
                },
              ]}
            />
            <div style={{ marginTop: 8 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {t('sales.settings.ratioTip')}
              </Text>
            </div>
          </div>
        </div>
      </Form>
    </Modal>
  )
}

// 轻量 Modal 包装
function ModalWrapper(props: {
  open: boolean
  title: string
  onCancel: () => void
  onOk: () => void
  okText: string
  cancelText: string
  children: ReactNode
}) {
  return (
    <Modal
      open={props.open}
      title={props.title}
      onCancel={props.onCancel}
      onOk={props.onOk}
      okText={props.okText}
      cancelText={props.cancelText}
      width={640}
      destroyOnClose
    >
      {props.children}
    </Modal>
  )
}
