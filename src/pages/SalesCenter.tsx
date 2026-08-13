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
import { genCallId, setState, updateSalesSettings, useStore } from '../store'
import type { Account, CallRecord, CallResult, SalesFollowLog, SalesSettings, Student, UserType, UserStatus } from '../types'
import { CALL_RESULTS } from '../types'
import { useI18n } from '../i18n'
import { useNavigate } from 'react-router-dom'
import { usePerm } from '../perm'
import { isClaimedLead, isPoolLead, isSalesLead } from '../funnel'
import { resolveUserType } from '../userType'
import { resolveUserStatus } from '../lessons'
import { useLineScope } from '../useLineScope'
import { businessLineOf, lineLabel, lpChannelSourceText, appChannelSourceText } from '../channel'
import LineFilter from '../components/LineFilter'
import LocalTime from '../components/LocalTime'

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

// 更新跟进弹窗里可选的进度
const FOLLOW_PROGRESS = ['跟进中', '已付费', '暂不跟进'] as const

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
  const [callResultFilter, setCallResultFilter] = useState<string | undefined>()
  const [callDateRange, setCallDateRange] = useState<any>(null)

  const [editing, setEditing] = useState<Student | null>(null)
  const [dialing, setDialing] = useState<Student | null>(null)
  const [reassigning, setReassigning] = useState<Student | null>(null)
  const [dropping, setDropping] = useState<Student | null>(null)
  const [trialLevelStudent, setTrialLevelStudent] = useState<Student | null>(null)
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

  const leadText = (s: Student) =>
    `${s.phone ?? ''} ${s.studentId} ${s.localName ?? s.name} ${s.country ?? ''}`.toLowerCase()

  const poolData = useMemo(
    () =>
      poolAll.filter((s) => {
        const kw = keyword.trim().toLowerCase()
        return !kw || leadText(s).includes(kw)
      }),
    [poolAll, keyword],
  )

  const followData = useMemo(
    () =>
      followAll.filter((s) => {
        const kw = keyword.trim().toLowerCase()
        return !kw || leadText(s).includes(kw)
      }),
    [followAll, keyword],
  )

  // 通话记录：按业务线默认勾选过滤，非超管仅看自己坐席的记录
  const callScoped = useMemo(() => {
    let list = callRecords.filter((c) => matchLine(c.businessLine))
    if (!seeAllOwners) list = list.filter((c) => c.agent === actor)
    return list
  }, [callRecords, lineSel, matchLine, seeAllOwners, actor])

  const callData = useMemo(
    () =>
      callScoped.filter((c) => {
        const kw = keyword.trim().toLowerCase()
        const student = students.find((item) => item.studentId === c.studentId)
        const text = phase3
          ? `${c.studentId} ${c.customer} ${student?.account ?? ''}`.toLowerCase()
          : `${c.phone} ${c.studentId} ${c.customer}`.toLowerCase()
        const matchResult = !callResultFilter || c.result === callResultFilter
        let matchDate = true
        if (callDateRange && callDateRange.length === 2) {
          const [start, end] = callDateRange
          const callTime = dayjs.utc(c.time)
          // 比较时统一转成本地时间或都在 UTC 比较。由于选择器选的是当地日期的开头和结尾，这里我们用 isAfter / isBefore。
          // 这里简化处理，直接判断时间戳是否在范围内
          if (start && end) {
            matchDate = callTime.isAfter(start.startOf('day')) && callTime.isBefore(end.endOf('day'))
          }
        }
        return (!kw || text.includes(kw)) && matchResult && matchDate
      }),
    [callScoped, keyword, callResultFilter, callDateRange, students, phase3],
  )

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
    })
  }

  const saveFollow = async () => {
    const v = await form.validateFields()
    if (!editing) return
    const now = dayjs().format('YYYY-MM-DD HH:mm:ss')
    const note = (v.note as string).trim()
    const owner = editing.salesOwner ?? actor
    setState((prev) => ({
      ...prev,
      students: prev.students.map((x) => {
        if (x.studentId === editing.studentId) {
          const currentProgress = x.salesProgress || '跟进中'
          return {
            ...x,
            purchaseIntention: v.purchaseIntention,
            salesLatestNote: note,
            salesUpdatedAt: now,
            salesHistory: [{ progress: currentProgress, note, time: now, owner }, ...(x.salesHistory || [])],
          }
        }
        return x
      }),
    }))
    setEditing(null)
    message.success(t('sales.saved'))
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
  const saveCall = (note: string, intention: string) => {
    if (!dialing) return
    const now = dayjs().format('YYYY-MM-DD HH:mm:ss')
    const owner = dialing.salesOwner ?? actor
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
      agent: actor,
      time: now,
    }
    setState((prev) => ({
      ...prev,
      callRecords: [record, ...prev.callRecords],
      students: prev.students.map((x) =>
        x.studentId === dialing.studentId
          ? {
              ...x,
              purchaseIntention: intention as any,
              salesLatestNote: note,
              salesUpdatedAt: now,
              salesHistory: [
                { progress: x.salesProgress || '跟进中', note, time: now, owner, audioUrl: dummyAudio, aiSummary: dummySummary },
                ...(x.salesHistory || []),
              ],
            }
          : x,
      ),
    }))
    setDialing(null)
    message.success(t('sales.dialed'))
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
    ...(!phase3 ? [{
      title: t('sales.call.result'),
      dataIndex: 'result',
      width: 110,
      render: (v: CallResult) => <Tag color={CALL_RESULT_COLOR[v]}>{t(`sales.callResult.${v}`)}</Tag>,
    }] : []),
    { title: t('sales.call.duration'), dataIndex: 'duration', width: 90 },
    {
      title: t('sales.call.note'),
      dataIndex: 'note',
      width: 340,
      ellipsis: true,
      render: (v: string) => v || <Text type="secondary">—</Text>,
    },
    { title: t('sales.call.agent'), dataIndex: 'agent', width: 190 },
  ]

  const [showIntro, setShowIntro] = useState(false)

  const totalLeads = students.filter((s) => isSalesLead(s, lessons)).length

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

      <Space wrap style={{ marginBottom: 16 }}>
        <LineFilter value={lineSel} onChange={setLineSel} options={filterOptions(lineOptions)} placeholder={t('user.col.country')} disabled={lineDisabled} />
        {tab === 'calls' && (
          <>
            {!phase3 && <Select
              allowClear
              placeholder={t('sales.call.result')}
              style={{ width: 150 }}
              value={callResultFilter}
              onChange={setCallResultFilter}
              options={CALL_RESULTS.map((r) => ({ label: t(`sales.callResult.${r}`), value: r }))}
            />}
            <DatePicker.RangePicker 
              onChange={setCallDateRange} 
              allowClear 
              placeholder={['开始时间', '结束时间']}
            />
          </>
        )}
        <Input
          allowClear
          prefix={<SearchOutlined />}
          placeholder={tab === 'calls' ? (phase3 ? '搜索用户ID / 姓名 / 登录账号' : t('sales.searchCalls')) : t('sales.searchFollow')}
          style={{ width: 340 }}
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
        />
        {importAction}
      </Space>

      <Tabs
        activeKey={tab}
        onChange={setTab}
        items={[
          {
            key: 'pool',
            label: `${t('sales.tab.pool')} (${poolAll.length})`,
            children: (
              <Table
                rowKey="studentId"
                columns={poolColumns}
                dataSource={poolData}
                scroll={{ x: 2180 + 90 }}
                locale={{ emptyText: t('sales.emptyPool') }}
                pagination={{ showTotal: (n) => t('common.total', { n }), showSizeChanger: true }}
              />
            ),
          },
          {
            key: 'follow',
            label: `${t('sales.tab.follow')} (${followAll.length})`,
            children: (
              <>
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
                <Alert type="info" showIcon style={{ marginBottom: 16 }} message={t('sales.callsBanner')} />
                <Table
                  rowKey="id"
                  columns={callColumns}
                  dataSource={callData}
                  scroll={{ x: 1210 }}
                  locale={{ emptyText: t('sales.emptyCalls') }}
                  pagination={{ showTotal: (n) => t('common.total', { n }), showSizeChanger: true }}
                />
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
        onCancel={() => setEditing(null)}
        onOk={saveFollow}
      />

      <Modal_Dial t={t} dialing={dialing} onCancel={() => setDialing(null)} onSave={saveCall} />

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
  onSave: (note: string, intention: string) => void
}) {
  const [phase, setPhase] = useState<'calling' | 'summary'>('calling')
  const [seconds, setSeconds] = useState(0)
  const [note, setNote] = useState('')
  const [purchaseIntention, setPurchaseIntention] = useState('未填写')

  // 打开弹窗时重置状态并开始计时
  useEffect(() => {
    if (dialing) {
      setPhase('calling')
      setSeconds(0)
      setNote('')
      setPurchaseIntention(dialing.purchaseIntention || '未填写')
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
    onSave(note, purchaseIntention)
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
          <Form.Item label={t('sales.call.note')} required>
            <Input.TextArea
              rows={4}
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
  onCancel,
  onOk,
}: {
  t: (k: string, v?: Record<string, string | number>) => string
  editing: Student | null
  form: ReturnType<typeof Form.useForm>[0]
  onCancel: () => void
  onOk: () => void
}) {
  const history: SalesFollowLog[] = editing?.salesHistory ?? []
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
        <Form.Item name="note" label={t('sales.f.note')} rules={[{ required: true, message: t('sales.f.noteRequired') }]}>
          <Input.TextArea rows={3} placeholder={t('sales.f.notePlaceholder')} />
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
