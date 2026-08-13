import { useMemo, useState } from 'react'
import {
  Alert,
  Button,
  Card,
  Dropdown,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from 'antd'
import { DownloadOutlined, DownOutlined, EditOutlined, HistoryOutlined, PlusCircleOutlined, SearchOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { Link } from 'react-router-dom'
import dayjs from 'dayjs'
import { setState, useStore } from '../store'
import type { LoginMethod, Student, StudentEditLog, StudentFieldChange, UserStatus, UserType } from '../types'
import { AGE_GROUPS, USER_STATUSES, USER_TYPES } from '../types'
import { useI18n } from '../i18n'
import { usePerm } from '../perm'
import { hasPhoneLogin, resolveUserType } from '../userType'
import { resolveUserStatus } from '../lessons'
import { inUserCenter } from '../funnel'
import { useLineScope } from '../useLineScope'
import { appChannelSourceText, businessLineOf, lineLabel, lpChannelSourceText, registerChannelText } from '../channel'
import LineFilter from '../components/LineFilter'
import LocalTime from '../components/LocalTime'
import { downloadCsv, maskPhone } from '../export'

const { Text } = Typography

const STATUS_COLOR: Record<UserStatus, string> = {
  '未付费-未体验': 'default',
  '未付费-体验中': 'gold',
  '未付费-已体验': 'blue',
  付费: 'green',
  付费逾期: 'red',
}

const METHOD_COLOR: Record<LoginMethod, string> = {
  谷歌邮箱: 'red',
  Facebook: 'blue',
  kakao: 'gold',
  手机号: 'green',
  AppID: 'purple',
}

const USER_TYPE_COLOR: Record<UserType, string> = {
  正式用户: 'green',
  测试用户: 'gold',
}

export default function UserCenter({ phase3 = false }: { phase3?: boolean }) {
  const { t } = useI18n()
  const students = useStore((s) => s.students)
  const channels = useStore((s) => s.channels)
  const lessons = useStore((s) => s.lessons ?? [])
  const { can, actor } = usePerm()
  const canEdit = can(phase3 ? 'usersV2_edit' : 'users_edit') === 'operate'
  const canViewPhone = can(phase3 ? 'usersV2_phone_view' : 'users_phone_view') !== 'none'
  const canExport = can(phase3 ? 'usersV2_export' : 'users_export') !== 'none'
  const { selected: lineSel, setSelected: setLineSel, matchLine, disabled: lineDisabled, filterOptions } = useLineScope()
  const [keyword, setKeyword] = useState('')
  const [statusFilter, setStatusFilter] = useState<string | undefined>()
  const [typeFilter, setTypeFilter] = useState<string | undefined>()
  const [countryFilter, setCountryFilter] = useState<string | undefined>()
  const [editing, setEditing] = useState<Student | null>(null)
  const [historyOf, setHistoryOf] = useState<Student | null>(null)
  const [form] = Form.useForm()
  const [addingMembership, setAddingMembership] = useState<Student | null>(null)
  const [membershipForm] = Form.useForm()
  const [trialLevelStudent, setTrialLevelStudent] = useState<Student | null>(null)
  const [trialLevelForm] = Form.useForm()

  // 业务线筛选选项：渠道业务线 + 数据中出现的业务线（无渠道归因的空业务线不入选项）
  const lineOptions = useMemo(
    () =>
      Array.from(
        new Set([...channels.map((c) => c.name), ...students.map((s) => businessLineOf(channels, s))].filter(Boolean)),
      ),
    [channels, students],
  )

  // 国家筛选选项：数据中出现的注册国家
  const countryOptions = useMemo(
    () => Array.from(new Set(students.map((s) => lineLabel(s)).filter(Boolean))),
    [students],
  )

  const data = useMemo(
    () =>
      students.filter((s) => {
        // 分流规则：未付费-未体验且有手机号的用户进入「销售中心」，其余展示在此
        if (!inUserCenter(s, lessons)) return false
        const kw = keyword.trim().toLowerCase()
        const matchKw =
          !kw ||
          s.studentId.toLowerCase().includes(kw) ||
          (s.localName ?? s.name).toLowerCase().includes(kw) ||
          s.account.toLowerCase().includes(kw)
        const matchStatus = !statusFilter || resolveUserStatus(s, lessons) === statusFilter
        const matchType = !typeFilter || resolveUserType(s) === typeFilter
        const matchCountry = !countryFilter || lineLabel(s) === countryFilter
        // 无业务线（无渠道归因）的用户不参与业务线过滤（受筛选器控制）
        const bl = businessLineOf(channels, s)
        return matchKw && matchLine(bl) && matchStatus && matchType && matchCountry
      }),
    [students, channels, lessons, keyword, lineSel, statusFilter, typeFilter, countryFilter, matchLine],
  )

  const phoneLocked = editing ? hasPhoneLogin(editing) : false

  const exportUsers = () => {
    downloadCsv(
      `用户中心_${dayjs().format('YYYYMMDD_HHmmss')}.csv`,
      ['用户ID', '学生姓名', '用户状态', '用户类型', '年龄段', '注册方式', '登录账号', '手机号', '国家', '注册渠道', '渠道code', 'campaign', 'campaign_id', '优惠码', 'CC', '注册时间', '到期时间', '最近修改人'],
      data.map((s) => [
        s.studentId, s.localName || s.name, resolveUserStatus(s, lessons), resolveUserType(s), s.ageGroup, s.loginMethod,
        s.account, maskPhone(s.phone), lineLabel(s), registerChannelText(channels, s), s.channelCode, s.campaign, s.campaignId,
        s.couponCode, s.ccName, s.registerTime, s.expireTime, s.lastModifier,
      ]),
    )
    message.success(`已导出 ${data.length} 条用户数据（手机号已加密）`)
  }

  const openEdit = (s: Student) => {
    setEditing(s)
    form.setFieldsValue({
      localName: s.localName,
      ageGroup: s.ageGroup,
      userType: resolveUserType(s),
    })
  }

  const openAddMembership = (s: Student) => {
    setAddingMembership(s)
    membershipForm.resetFields()
  }

  const openTrialLevel = (s: Student) => {
    setTrialLevelStudent(s)
    trialLevelForm.setFieldsValue({ courseLevel: s.courseLevel })
  }

  const saveTrialLevel = async () => {
    if (!trialLevelStudent) return
    const { courseLevel } = await trialLevelForm.validateFields()
    const before = trialLevelStudent.courseLevel || ''
    const changes: StudentFieldChange[] = before === courseLevel
      ? []
      : [{ field: '试听课等级', before, after: courseLevel }]
    const entry: StudentEditLog = {
      time: dayjs().format('YYYY-MM-DD HH:mm:ss'),
      action: 'user.hist.edit',
      changes,
      modifier: actor,
    }
    setState((prev) => ({
      ...prev,
      students: prev.students.map((student) =>
        student.studentId === trialLevelStudent.studentId
          ? {
              ...student,
              courseLevel,
              lastModifier: changes.length ? actor : student.lastModifier,
              editHistory: changes.length ? [entry, ...(student.editHistory || [])] : student.editHistory,
            }
          : student,
      ),
    }))
    setTrialLevelStudent(null)
    message.success('试听课等级已修改')
  }

  const addMembership = async () => {
    if (!addingMembership) return
    const { days } = await membershipForm.validateFields()
    if (typeof days !== 'number' || days <= 0) return
    setState((prev) => ({
      ...prev,
      students: prev.students.map((student) => {
        if (student.studentId !== addingMembership.studentId) return student
        const now = dayjs()
        const current = student.expireTime ? dayjs(student.expireTime) : now
        const base = current.isAfter(now) ? current : now
        return { ...student, expireTime: base.add(days, 'day').format('YYYY-MM-DD HH:mm:ss'), lastModifier: actor }
      }),
    }))
    message.success(t('user.addMembership'))
    setAddingMembership(null)
  }

  const submitEdit = async () => {
    const v = await form.validateFields()
    if (!editing) return
    const locked = hasPhoneLogin(editing)
    const changes: StudentFieldChange[] = []
    if ((v.localName || '') !== (editing.localName || ''))
      changes.push({ field: t('user.label.localName'), before: editing.localName || '', after: v.localName || '' })
    if ((v.ageGroup || '') !== (editing.ageGroup || ''))
      changes.push({ field: t('user.label.ageGroup'), before: editing.ageGroup || '', after: v.ageGroup || '' })
    if (!locked && v.userType !== resolveUserType(editing))
      changes.push({ field: t('user.col.userType'), before: t(`enum.userType.${resolveUserType(editing)}`), after: t(`enum.userType.${v.userType}`) })
    const entry: StudentEditLog = { time: dayjs().format('YYYY-MM-DD HH:mm:ss'), action: 'user.hist.edit', changes, modifier: actor }
    setState((prev) => ({
      ...prev,
      students: prev.students.map((s) =>
        s.studentId === editing.studentId
          ? {
              ...s,
              localName: v.localName,
              ageGroup: v.ageGroup,
              // 手机号/kakao 由规则自动判定，不接受手动修改
              userType: locked ? s.userType : v.userType,
              lastModifier: changes.length ? actor : s.lastModifier,
              editHistory: changes.length ? [entry, ...(s.editHistory || [])] : s.editHistory,
            }
          : s,
      ),
    }))
    setEditing(null)
  }

  const columns: ColumnsType<Student> = [
    {
      title: t('user.col.id'),
      dataIndex: 'studentId',
      width: 190,
      fixed: 'left',
      render: (v: string) => <Link to={`/users-v2/${v}`}>{v}</Link>,
    },
    {
      title: t('user.col.name'),
      dataIndex: 'localName',
      width: 140,
      render: (_, r) => <span>{r.localName || r.name}</span>,
    },
    {
      title: t('user.col.status'),
      dataIndex: 'status',
      width: 130,
      render: (_: UserStatus, r: Student) => {
        const st = resolveUserStatus(r, lessons)
        return <Tag color={STATUS_COLOR[st]}>{t(`enum.status.${st}`)}</Tag>
      },
    },
    {
      title: t('user.col.userType'),
      dataIndex: 'userType',
      width: 110,
      render: (_: UserType, r: Student) => {
        const tp = resolveUserType(r)
        return <Tag color={USER_TYPE_COLOR[tp]}>{t(`enum.userType.${tp}`)}</Tag>
      },
    },
    {
      title: t('user.col.ageGroup'),
      dataIndex: 'ageGroup',
      width: 100,
      render: (v: string | undefined) => (v ? <Tag color="geekblue">{v}</Tag> : <Text type="secondary">-</Text>),
    },
    {
      title: t('user.col.courseLevel'),
      dataIndex: 'courseLevel',
      width: 110,
      render: (v: string | undefined) => (v ? <Text>{v}</Text> : <Text type="secondary">-</Text>),
    },
    {
      title: t('user.col.method'),
      dataIndex: 'loginMethod',
      width: 120,
      render: (v: LoginMethod) => <Tag color={METHOD_COLOR[v]}>{t(`enum.method.${v}`)}</Tag>,
    },
    {
      title: t('user.col.account'),
      dataIndex: 'account',
      width: 200,
      render: (v) => <Text>{v}</Text>,
    },
    {
      title: t('user.col.phone'),
      dataIndex: 'phone',
      width: 180,
      render: (v: string | undefined) => <Text>{canViewPhone ? v || '—' : maskPhone(v)}</Text>,
    },
    { title: t('user.col.country'), dataIndex: 'country', width: 110, render: (_, r) => <Tag>{lineLabel(r)}</Tag> },
    {
      title: t('user.col.channelSource'),
      dataIndex: 'registerChannel',
      width: 260,
      render: (_: string, r) => registerChannelText(channels, r),
    },
    {
      title: t('user.col.code'),
      dataIndex: 'channelCode',
      width: 200,
      render: (v: string) => (v ? <Text code>{v}</Text> : <Text type="secondary">-</Text>),
    },
    {
      title: t('user.col.campaign'),
      dataIndex: 'campaign',
      width: 150,
      render: (v: string | undefined) => v || <Text type="secondary">-</Text>,
    },
    {
      title: t('user.col.campaignId'),
      dataIndex: 'campaignId',
      width: 180,
      render: (v: string | undefined) => v || <Text type="secondary">-</Text>,
    },
    {
      title: t('user.col.couponCode'),
      dataIndex: 'couponCode',
      width: 140,
      render: (v: string | undefined) => v ? <Tag color="blue">{v}</Tag> : <Text type="secondary">-</Text>,
    },
    {
      title: t('user.col.cc'),
      dataIndex: 'ccName',
      width: 120,
      render: (v: string | undefined) => v || <Text type="secondary">-</Text>,
    },
    {
      title: t('user.col.trialStatus'),
      dataIndex: 'trialStatusStr',
      width: 130,
      render: (v: string | undefined) => v || <Text type="secondary">-</Text>,
    },
    {
      title: t('user.col.paymentStatus'),
      dataIndex: 'paymentStatusStr',
      width: 130,
      render: (v: string | undefined) => v || <Text type="secondary">-</Text>,
    },
    {
      title: t('user.col.paymentPlatform'),
      dataIndex: 'paymentPlatform',
      width: 130,
      render: (v: string | undefined) => v || <Text type="secondary">-</Text>,
    },
    {
      title: t('user.col.regTime'),
      dataIndex: 'registerTime',
      width: 200,
      render: (v: string | undefined, r: Student) => <LocalTime time={v} country={r.country || r.businessLine} />,
    },
    {
      title: t('user.col.expireTime'),
      dataIndex: 'expireTime',
      width: 200,
      render: (v: string | undefined, r: Student) => <LocalTime time={v} country={r.country || r.businessLine} />,
    },
    {
      title: t('user.col.modifier'),
      dataIndex: 'lastModifier',
      width: 180,
      render: (v: string | undefined, r: Student) =>
        v ? (
          <Button type="link" style={{ padding: 0, height: 'auto' }} onClick={() => setHistoryOf(r)}>
            {v}
            <HistoryOutlined style={{ marginInlineStart: 6 }} />
          </Button>
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
    {
      title: t('common.action'),
      key: 'action',
      width: 140,
      fixed: 'right' as const,
      render: (_: unknown, r: Student) =>
        canEdit ? (
          <Button type="link" icon={<EditOutlined />} onClick={() => openEdit(r)}>
            {t('user.editInfo')}
          </Button>
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
  ]

  const phase3Columns: ColumnsType<Student> = [
    {
      title: t('user.col.id'), dataIndex: 'studentId', width: 190, fixed: 'left',
      render: (v: string) => <Link to={`/users-v2/${v}`}>{v}</Link>,
    },
    { title: t('user.col.name'), dataIndex: 'localName', width: 140, render: (_: unknown, r) => r.localName || r.name },
    {
      title: t('user.col.status'), dataIndex: 'status', width: 130,
      render: (_: UserStatus, r) => {
        const status = resolveUserStatus(r, lessons)
        return <Tag color={STATUS_COLOR[status]}>{t(`enum.status.${status}`)}</Tag>
      },
    },
    {
      title: t('user.col.userType'), dataIndex: 'userType', width: 110,
      render: (_: UserType, r) => {
        const userType = resolveUserType(r)
        return <Tag color={USER_TYPE_COLOR[userType]}>{t(`enum.userType.${userType}`)}</Tag>
      },
    },
    { title: t('user.col.ageGroup'), dataIndex: 'ageGroup', width: 100, render: (v) => v ? <Tag color="geekblue">{v}</Tag> : <Text type="secondary">—</Text> },
    { title: t('user.col.courseLevel'), dataIndex: 'courseLevel', width: 110, render: (v) => v || <Text type="secondary">—</Text> },
    { title: t('user.col.method'), dataIndex: 'loginMethod', width: 120, render: (v: LoginMethod) => <Tag color={METHOD_COLOR[v]}>{t(`enum.method.${v}`)}</Tag> },
    { title: t('user.col.account'), dataIndex: 'account', width: 200, render: (v) => <Text>{v || '—'}</Text> },
    {
      title: t('user.col.channelSourceLp'), key: 'landingSource', width: 220,
      render: (_: unknown, r) => {
        const value = lpChannelSourceText(channels, r)
        return value === '—' ? <Text type="secondary">—</Text> : value
      },
    },
    { title: t('user.col.code'), dataIndex: 'channelCode', width: 160, render: (v) => v ? <Text code>{v}</Text> : <Text type="secondary">—</Text> },
    {
      title: t('user.col.channelSourceApp'), key: 'appSource', width: 220,
      render: (_: unknown, r) => {
        const value = appChannelSourceText(r)
        return value === '—' ? <Text type="secondary">—</Text> : value
      },
    },
    { title: t('user.col.country'), dataIndex: 'country', width: 120, render: (v) => v ? <Tag>{v}</Tag> : <Text type="secondary">—</Text> },
    { title: t('user.col.regTime'), dataIndex: 'registerTime', width: 200, render: (v, r) => <LocalTime time={v} country={r.country || r.businessLine} /> },
    { title: t('user.col.expireTime'), dataIndex: 'expireTime', width: 200, render: (v, r) => <LocalTime time={v} country={r.country || r.businessLine} /> },
    { title: t('user.col.couponCode'), dataIndex: 'couponCode', width: 140, render: (v) => v ? <Tag color="blue">{v}</Tag> : <Text type="secondary">—</Text> },
    { title: t('user.col.cc'), dataIndex: 'ccName', width: 150, render: (v) => v || <Text type="secondary">—</Text> },
    {
      title: '最新修改人',
      dataIndex: 'lastModifier',
      width: 160,
      render: (v: string | undefined, r) => v ? (
        <Button type="link" style={{ padding: 0, height: 'auto' }} onClick={() => setHistoryOf(r)}>
          {v}
          <HistoryOutlined style={{ marginInlineStart: 6 }} />
        </Button>
      ) : <Text type="secondary">—</Text>,
    },
    {
      title: t('common.action'), key: 'action', width: 120, fixed: 'right',
      render: (_: unknown, r) => canEdit ? (
        <Dropdown
          trigger={['click']}
          menu={{
            items: [
              { key: 'edit', icon: <EditOutlined />, label: t('user.editInfo'), onClick: () => openEdit(r) },
              { key: 'membership', icon: <PlusCircleOutlined />, label: t('user.addMembership'), onClick: () => openAddMembership(r) },
              ...(resolveUserStatus(r, lessons).startsWith('未付费')
                ? [{ key: 'trialLevel', label: '修改试听课等级', onClick: () => openTrialLevel(r) }]
                : []),
            ],
          }}
        >
          <Button>操作 <DownOutlined /></Button>
        </Dropdown>
      ) : <Text type="secondary">—</Text>,
    },
  ]

  return (
    <Card className="page-card" bordered={false} title={<span className="section-title">{t('user.titleV2')}</span>}>
      <Alert type="info" showIcon style={{ marginBottom: 16 }} message={t('user.funnelTip')} />
      <Space wrap style={{ marginBottom: 16 }}>
        <Input
          allowClear
          prefix={<SearchOutlined />}
          placeholder={t('user.searchPlaceholder')}
          style={{ width: 280 }}
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
        />
        <LineFilter value={lineSel} onChange={setLineSel} options={filterOptions(lineOptions)} disabled={lineDisabled} />
        <Select
          allowClear
          placeholder={t('user.col.country')}
          style={{ width: 140 }}
          value={countryFilter}
          onChange={setCountryFilter}
          options={countryOptions.map((c) => ({ label: c, value: c }))}
        />
        <Select
          allowClear
          placeholder={t('user.col.userType')}
          style={{ width: 140 }}
          value={typeFilter}
          onChange={setTypeFilter}
          options={USER_TYPES.map((tp) => ({ label: t(`enum.userType.${tp}`), value: tp }))}
        />
        <Select
          allowClear
          placeholder={t('user.filterStatus')}
          style={{ width: 150 }}
          value={statusFilter}
          onChange={setStatusFilter}
          options={USER_STATUSES.map((l) => ({ label: t(`enum.status.${l}`), value: l }))}
        />
        {canExport && <Button icon={<DownloadOutlined />} onClick={exportUsers}>导出列表</Button>}
      </Space>

        <Table
          rowKey="studentId"
          columns={phase3 ? phase3Columns : columns}
          dataSource={data}
          scroll={{ x: phase3 ? 3050 : 3250 }}
          pagination={{ showTotal: (n) => t('common.total', { n }), showSizeChanger: true }}
      />

      <Modal
        open={!!editing}
        title={t('user.modalTitle', { id: editing?.studentId ?? '' })}
        onCancel={() => setEditing(null)}
        onOk={submitEdit}
        okText={t('common.save')}
        cancelText={t('common.cancel')}
        destroyOnClose
      >
        <Form form={form} layout="vertical" preserve={false} style={{ marginTop: 12 }}>
          <Form.Item name="localName" label={t('user.label.localName')}>
            <Input placeholder={t('user.localNamePlaceholder')} />
          </Form.Item>
          <Form.Item name="ageGroup" label={t('user.label.ageGroup')}>
            <Select
              allowClear
              placeholder={t('common.pleaseSelect')}
              options={AGE_GROUPS.map((ageGroup) => ({ label: ageGroup, value: ageGroup }))}
            />
          </Form.Item>
          <Form.Item
            name="userType"
            label={t('user.col.userType')}
            tooltip={phoneLocked ? t('user.userTypeAutoTip') : undefined}
          >
            <Select
              disabled={phoneLocked}
              options={USER_TYPES.map((tp) => ({ label: t(`enum.userType.${tp}`), value: tp }))}
            />
          </Form.Item>
          <Form.Item label={t('user.col.country')}>
            <Input value={editing?.country} disabled />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        open={!!historyOf}
        title={t('user.hist.title')}
        onCancel={() => setHistoryOf(null)}
        footer={null}
        width={640}
        destroyOnClose
      >
        <Table<StudentEditLog>
          rowKey={(r) => `${r.time}-${r.modifier}`}
          size="small"
          pagination={false}
          dataSource={historyOf?.editHistory ?? []}
          locale={{ emptyText: t('user.hist.empty') }}
          columns={[
            { title: t('user.hist.col.time'), dataIndex: 'time', width: 170 },
            {
              title: t('user.hist.col.detail'),
              dataIndex: 'changes',
              render: (changes: StudentFieldChange[] | undefined, r: StudentEditLog) => {
                if (changes && changes.length)
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {changes.map((c, i) => (
                        <div key={i}>
                          <Text type="secondary">{c.field}：</Text>
                          <Text delete type="secondary">{c.before || t('user.hist.blank')}</Text>
                          <Text type="secondary"> → </Text>
                          <Text strong>{c.after || t('user.hist.blank')}</Text>
                        </div>
                      ))}
                    </div>
                  )
                return r.detail ? <span>{r.detail}</span> : <Text type="secondary">—</Text>
              },
            },
            { title: t('user.hist.col.modifier'), dataIndex: 'modifier', width: 190 },
          ]}
        />
      </Modal>

      <Modal
        open={!!addingMembership}
        title={t('user.addMembership.title')}
        onCancel={() => setAddingMembership(null)}
        onOk={addMembership}
        okText={t('common.save')}
        cancelText={t('common.cancel')}
        destroyOnClose
      >
        <Form form={membershipForm} layout="vertical" preserve={false}>
          <Form.Item name="days" label={t('user.addMembership.days')} rules={[{ required: true, message: '请输入增加天数' }]}>
            <InputNumber min={1} max={365} addonAfter="天" style={{ width: '100%' }} />
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
    </Card>
  )
}
