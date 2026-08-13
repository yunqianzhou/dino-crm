import { useMemo, useState } from 'react'
import {
  Button,
  Card,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
  Cascader,
} from 'antd'
import { DownloadOutlined, EditOutlined, FileTextOutlined, HistoryOutlined, SearchOutlined, ReloadOutlined, PlusCircleOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { InputNumber } from 'antd'
import utc from 'dayjs/plugin/utc'
dayjs.extend(utc)
import { setState, useStore } from '../store'
import type { LoginMethod, Student, StudentEditLog, StudentFieldChange, UserStatus, UserType } from '../types'
import { AGE_GROUPS, LOGIN_METHODS, USER_STATUSES, USER_TYPES } from '../types'
import { useI18n } from '../i18n'
import { useCurrentAccount, usePerm } from '../perm'
import { hasPhoneLogin, resolveUserType } from '../userType'
import { latestTrialReport, resolveUserStatus, TRIAL_REPORT_URL } from '../lessons'
import { appChannelSourceText, lpChannelSourceText } from '../channel'
import LocalTime from '../components/LocalTime'
import { useLineScope } from '../useLineScope'
import LineFilter from '../components/LineFilter'
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

export default function UserCenterP1() {
  const { t } = useI18n()
  const students = useStore((s) => s.students)
  const channels = useStore((s) => s.channels)
  const lessons = useStore((s) => s.lessons ?? [])
  const { can, allowedLines, actor } = usePerm()
  const { account } = useCurrentAccount()
  const canEdit = can('users_edit') === 'operate'
  const canViewPhone = can('users_phone_view') !== 'none'
  const canExport = can('users_export') !== 'none'
  const scope = allowedLines()
  const { selected: lineSel, setSelected: setLineSel, matchLine, disabled: lineDisabled, filterOptions } = useLineScope()
  
  const [keyword, setKeyword] = useState('')
  const [sourceLpFilter, setSourceLpFilter] = useState<string | undefined>()
  const [sourceAppFilter, setSourceAppFilter] = useState<string[] | undefined>()
  const [methodFilter, setMethodFilter] = useState<string | undefined>()
  const [statusFilter, setStatusFilter] = useState<string | undefined>()
  const [typeFilter, setTypeFilter] = useState<string | undefined>()
  const [editing, setEditing] = useState<Student | null>(null)
  const [historyOf, setHistoryOf] = useState<Student | null>(null)
  const [addingMembership, setAddingMembership] = useState<Student | null>(null)
  const [membershipForm] = Form.useForm()
  const [verifyCodes, setVerifyCodes] = useState<Record<string, string>>({})
  const [form] = Form.useForm()

  const handleRefreshCode = (studentId: string) => {
    const code = String(Math.floor(100000 + Math.random() * 900000))
    setVerifyCodes((prev) => ({ ...prev, [studentId]: code }))
    message.success('验证码已获取')
  }

  // 数据权限：底层仍按业务线隔离（一期不展示业务线，仅展示国家）
  const scoped = useMemo(
    () => (scope ? students.filter((s) => scope.includes(s.businessLine)) : students),
    [students, scope],
  )

  const lineOptions = useMemo(
    () => Array.from(new Set(scoped.map((s) => s.businessLine).filter(Boolean))) as string[],
    [scoped]
  )

  const sourceLpOptions = useMemo(
    () => Array.from(new Set(scoped.map((s) => lpChannelSourceText(channels, s)).filter((v) => v && v !== '—'))),
    [scoped, channels],
  )

  const sourceAppOptions = useMemo(() => {
    const map = new Map<string, Set<string>>()
    for (const s of scoped) {
      if (s.channelCode) continue
      const l1 = s.adChannel || s.channelSource || s.registerChannel
      if (!l1) continue
      if (!map.has(l1)) map.set(l1, new Set())
      if (s.adChannel && s.subChannel) {
        map.get(l1)!.add(s.subChannel)
      }
    }
    return Array.from(map.entries()).map(([k, set]) => {
      const opt: any = { value: k, label: k }
      if (set.size > 0) {
        opt.children = Array.from(set).map((c) => ({ value: c, label: c }))
      }
      return opt
    })
  }, [scoped])

  const data = useMemo(
    () =>
      scoped.filter((s) => {
        const kw = keyword.trim().toLowerCase()
        const matchKw =
          !kw ||
          s.studentId.toLowerCase().includes(kw) ||
          (s.localName ?? s.name).toLowerCase().includes(kw) ||
          s.account.toLowerCase().includes(kw)
        const matchCountry = matchLine(s.businessLine)
        const matchSourceLp = !sourceLpFilter || lpChannelSourceText(channels, s) === sourceLpFilter
        let matchSourceApp = true
        if (sourceAppFilter && sourceAppFilter.length > 0) {
          if (s.channelCode) {
            matchSourceApp = false
          } else {
            const l1 = s.adChannel || s.channelSource || s.registerChannel || ''
            const l2 = s.subChannel || ''
            if (sourceAppFilter.length === 1) {
              matchSourceApp = l1 === sourceAppFilter[0]
            } else if (sourceAppFilter.length === 2) {
              matchSourceApp = l1 === sourceAppFilter[0] && l2 === sourceAppFilter[1]
            }
          }
        }
        const matchMethod = !methodFilter || s.loginMethod === methodFilter
        const matchStatus = !statusFilter || resolveUserStatus(s, lessons) === statusFilter
        const matchType = !typeFilter || resolveUserType(s) === typeFilter
        return matchKw && matchCountry && matchSourceLp && matchSourceApp && matchMethod && matchStatus && matchType
      }),
    [scoped, channels, lessons, keyword, lineSel, matchLine, sourceLpFilter, sourceAppFilter, methodFilter, statusFilter, typeFilter],
  )

  const phoneLocked = editing ? hasPhoneLogin(editing) : false

  const exportUsers = () => {
    downloadCsv(
      `用户中心_${dayjs().format('YYYYMMDD_HHmmss')}.csv`,
      ['用户ID', '学生姓名', '用户状态', '用户类型', '年龄段', '课程等级', '注册方式', '登录账号', '手机号', '落地页渠道来源', 'App渠道来源', '渠道code', '国家', '注册时间', '到期时间', '优惠码', 'CC'],
      data.map((s) => [
        s.studentId, s.localName || s.name, resolveUserStatus(s, lessons), resolveUserType(s), s.ageGroup, s.courseLevel,
        s.loginMethod, s.account, maskPhone(s.phone), lpChannelSourceText(channels, s), appChannelSourceText(s), s.channelCode,
        s.country, s.registerTime, s.expireTime, s.couponCode, s.salesOwner || s.ccName,
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

  const doAddMembership = async () => {
    if (!addingMembership) return
    try {
      const values = await membershipForm.validateFields()
      const days = values.days
      if (typeof days === 'number' && days > 0) {
        setState((prev) => ({
          ...prev,
          students: prev.students.map((x) => {
            if (x.studentId === addingMembership.studentId) {
              const now = dayjs.utc()
              const currentExpire = x.expireTime ? dayjs.utc(x.expireTime) : now
              const baseTime = currentExpire.isAfter(now) ? currentExpire : now
              const expireTime = baseTime.add(days, 'day').format('YYYY-MM-DD HH:mm:ss')
              return { ...x, expireTime, lastModifier: actor }
            }
            return x
          }),
        }))
        message.success(t('user.addMembership'))
        setAddingMembership(null)
      }
    } catch (e) {
      // 校验失败
    }
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
      changes.push({
        field: t('user.col.userType'),
        before: t(`enum.userType.${resolveUserType(editing)}`),
        after: t(`enum.userType.${v.userType}`),
      })
    const entry: StudentEditLog = {
      time: dayjs().format('YYYY-MM-DD HH:mm:ss'),
      action: 'user.hist.edit',
      changes,
      modifier: actor,
    }
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
    { title: t('user.col.id'), dataIndex: 'studentId', width: 190, fixed: 'left' },
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
      render: (v: string | undefined) => (v ? <Tag color="geekblue">{v}</Tag> : <Text type="secondary">—</Text>),
    },
    {
      title: t('user.col.courseLevel'),
      dataIndex: 'courseLevel',
      width: 120,
      render: (v: string | undefined) => (v ? <Tag color="purple">{v}</Tag> : <Text type="secondary">—</Text>),
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
      width: 220,
      render: (v) => <Text>{v}</Text>,
    },
    {
      title: t('user.col.phone'),
      dataIndex: 'phone',
      width: 180,
      render: (v: string | undefined) => <Text>{canViewPhone ? v || '—' : maskPhone(v)}</Text>,
    },
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
      title: t('user.col.channelSourceApp'),
      dataIndex: 'adChannelApp',
      width: 200,
      render: (_: unknown, r: Student) => {
        const txt = appChannelSourceText(r)
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
      title: t('user.col.country'),
      dataIndex: 'country',
      width: 120,
      render: (v: string | undefined) => (v ? <Tag>{v}</Tag> : <Text type="secondary">—</Text>),
    },
    {
      title: '验证码', // t('user.col.verifyCode') if I were to add it to i18n
      key: 'verifyCode',
      width: 140,
      render: (_: unknown, r: Student) => (
        <Space size={4}>
          <Text code>{verifyCodes[r.studentId] || '------'}</Text>
          <Button type="text" size="small" icon={<ReloadOutlined />} onClick={() => handleRefreshCode(r.studentId)} />
        </Space>
      ),
    },
    {
      title: t('user.col.regTime'),
      dataIndex: 'registerTime',
      width: 200,
      render: (v: string | undefined, r: Student) => <LocalTime time={v} country={r.country} />,
    },
    {
      title: t('user.col.expireTime'),
      dataIndex: 'expireTime',
      width: 200,
      render: (v: string | undefined, r: Student) => <LocalTime time={v} country={r.country} />,
    },
    {
      title: t('user.col.couponCode'),
      dataIndex: 'couponCode',
      width: 140,
      render: (v: string | undefined) => (v ? <Tag color="blue">{v}</Tag> : <Text type="secondary">—</Text>),
    },
    {
      title: t('user.col.cc'),
      dataIndex: 'ccName',
      width: 120,
      render: (_: unknown, r: Student) => r.salesOwner || r.ccName || <Text type="secondary">—</Text>,
    },
    {
      title: t('user.col.modifier'),
      dataIndex: 'lastModifier',
      width: 200,
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
      width: 200,
      fixed: 'right' as const,
      render: (_: unknown, r: Student) => {
        const trial = latestTrialReport(lessons, r.studentId)
        return (
          <Space size={0}>
            {trial && (
              <Button
                type="link"
                icon={<FileTextOutlined />}
                onClick={() => window.open(TRIAL_REPORT_URL, '_blank', 'noopener,noreferrer')}
              >
                {t('user.trialReport')}
              </Button>
            )}
            {canEdit && (
              <Button type="link" icon={<EditOutlined />} onClick={() => openEdit(r)}>
                {t('user.editInfo')}
              </Button>
            )}
            {canEdit && (
              <Button type="link" icon={<PlusCircleOutlined />} onClick={() => openAddMembership(r)}>
                {t('user.addMembership')}
              </Button>
            )}
          </Space>
        )
      },
    },
  ]

  return (
    <Card className="page-card" bordered={false} title={<span className="section-title">{t('user.title')}</span>}>
      <Space wrap style={{ marginBottom: 16 }}>
        <Input
          allowClear
          prefix={<SearchOutlined />}
          placeholder={t('user.searchPlaceholder')}
          style={{ width: 280 }}
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
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
          placeholder={t('user.col.method')}
          style={{ width: 130 }}
          value={methodFilter}
          onChange={setMethodFilter}
          options={LOGIN_METHODS.map((m) => ({ label: t(`enum.method.${m}`), value: m }))}
        />
        <Select
          allowClear
          showSearch
          placeholder={t('user.col.channelSourceLp')}
          style={{ width: 180 }}
          value={sourceLpFilter}
          onChange={setSourceLpFilter}
          options={sourceLpOptions.map((c) => ({ label: c, value: c }))}
        />
        <Cascader
          allowClear
          changeOnSelect
          placeholder={t('user.col.channelSourceApp')}
          style={{ width: 180 }}
          value={sourceAppFilter}
          onChange={(v) => setSourceAppFilter(v as string[] | undefined)}
          options={sourceAppOptions}
        />
        <LineFilter value={lineSel} onChange={setLineSel} options={filterOptions(lineOptions)} placeholder={t('user.col.country')} disabled={lineDisabled} />
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
          columns={columns}
          dataSource={data}
          scroll={{ x: 2430 }}
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
              options={AGE_GROUPS.map((g) => ({ label: g, value: g }))}
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
        onOk={doAddMembership}
        destroyOnClose
      >
        <Form form={membershipForm} layout="vertical" preserve={false}>
          <Form.Item
            name="days"
            label={t('user.addMembership.days')}
            rules={[{ required: true, message: '请输入增加天数' }]}
          >
            <InputNumber min={1} max={365} addonAfter="天" style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  )
}
