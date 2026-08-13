import { useMemo } from 'react'
import { Button, Card, Descriptions, Space, Table, Tag, Typography } from 'antd'
import { ArrowLeftOutlined, FileTextOutlined, PlayCircleOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { useNavigate, useParams } from 'react-router-dom'
import { useStore } from '../store'
import type { LessonRecord, LoginMethod, UserStatus, UserType } from '../types'
import { useI18n } from '../i18n'
import { usePerm } from '../perm'
import { resolveUserType } from '../userType'
import { openReplayVideo, reportKind, resolveUserStatus, studentLessons, TRIAL_REPORT_URL } from '../lessons'
import { appChannelSourceText, lineLabel, lpChannelSourceText } from '../channel'
import LocalTime from '../components/LocalTime'

const { Text } = Typography

const STATUS_COLOR: Record<UserStatus, string> = {
  '未付费-未体验': 'default',
  '未付费-体验中': 'gold',
  '未付费-已体验': 'blue',
  付费: 'green',
  付费逾期: 'red',
}
const USER_TYPE_COLOR: Record<UserType, string> = { 正式用户: 'green', 测试用户: 'gold' }

export default function UserDetail({ backPath = '/users-v2', backText, variant = 'user' }: { backPath?: string; backText?: string; variant?: 'user' | 'sales' }) {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { studentId = '' } = useParams()
  const students = useStore((s) => s.students)
  const channels = useStore((s) => s.channels)
  const lessons = useStore((s) => s.lessons ?? [])
  const { allowedLines, can } = usePerm()
  const scope = allowedLines()

  const student = useMemo(() => students.find((s) => s.studentId === studentId), [students, studentId])
  const inScope = student && (!scope || scope.includes(student.businessLine))
  const canViewReport = can(variant === 'sales' ? 'salesV3_view_report' : 'usersV2_view_report') === 'operate'
  const canViewReplay = can(variant === 'sales' ? 'salesV3_view_replay' : 'usersV2_view_replay') === 'operate'
  const courseData = useMemo(
    () => studentLessons(lessons, studentId)
      .filter((lesson) => lesson.status === '进行中' || lesson.status === '已完课')
      .sort((a, b) => {
        if (a.status !== b.status) return a.status === '进行中' ? -1 : 1
        const aTime = a.status === '进行中' ? a.startedAt : a.completedAt
        const bTime = b.status === '进行中' ? b.startedAt : b.completedAt
        return (bTime ?? '').localeCompare(aTime ?? '')
      }),
    [lessons, studentId],
  )

  const back = (
    <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(backPath)}>
      {backText ?? t('user.back')}
    </Button>
  )

  if (!student || !inScope) {
    return (
      <Card className="page-card" bordered={false} title={<span className="section-title">{t('user.detail')}</span>} extra={back}>
        <Text type="secondary">{t('user.detailNotFound')}</Text>
      </Card>
    )
  }

  const courseColumns: ColumnsType<LessonRecord> = [
    { title: '课标', dataIndex: 'courseLabel', width: 190, render: (v) => <Text code>{v}</Text> },
    {
      title: '课程状态',
      dataIndex: 'status',
      width: 110,
      render: (v: LessonRecord['status']) => <Tag color={v === '已完课' ? 'green' : 'processing'}>{v === '已完课' ? '已完成' : '进行中'}</Tag>,
    },
    { title: '课程名称', dataIndex: 'courseName', width: 180, render: (v: string | undefined, r) => v || `Dino English${r.lessonType}` },
    { title: t('lesson.col.teacher'), dataIndex: 'teacher', width: 130, render: (v) => v || <Text type="secondary">—</Text> },
    {
      title: '上课时间',
      key: 'startedAt',
      width: 200,
      render: (_: unknown, r: LessonRecord) => <LocalTime time={r.startedAt ?? r.completedAt} country={student.country || student.businessLine} />,
    },
    {
      title: t('lesson.col.completedAt'),
      dataIndex: 'completedAt',
      width: 200,
      render: (v: string | undefined, r: LessonRecord) =>
        r.status === '进行中' ? <Text type="secondary">—</Text> : <LocalTime time={v} country={student.country || student.businessLine} />,
    },
    {
      title: t('lesson.col.report'),
      key: 'report',
      width: 150,
      render: (_: unknown, r: LessonRecord) =>
        canViewReport && r.status === '已完课' && r.report ? (
          <Button
            type="link"
            style={{ padding: 0 }}
            icon={<FileTextOutlined />}
            onClick={() => window.open(TRIAL_REPORT_URL, '_blank', 'noopener,noreferrer')}
          >
            {reportKind(r)}
          </Button>
        ) : <Text type="secondary">—</Text>,
    },
    {
      title: t('lesson.col.replay'),
      key: 'replay',
      width: 110,
      render: (_: unknown, r: LessonRecord) =>
        canViewReplay && r.status === '已完课' && r.replayUrl ? (
          <Button type="link" style={{ padding: 0 }} icon={<PlayCircleOutlined />} onClick={() => openReplayVideo(r.replayUrl)}>
            {t('lesson.viewReplay')}
          </Button>
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
  ]

  return (
    <Space direction="vertical" size={16} style={{ display: 'flex' }}>
      <Card
        className="page-card"
        bordered={false}
        title={<span className="section-title">{t('user.detail')}</span>}
        extra={back}
      >
        <Descriptions column={2} bordered size="small">
          <Descriptions.Item label="用户ID">{student.studentId}</Descriptions.Item>
          <Descriptions.Item label="学生姓名">{student.localName || student.name}</Descriptions.Item>
          {variant === 'sales' && <Descriptions.Item label="购买意向">{student.purchaseIntention || <Text type="secondary">—</Text>}</Descriptions.Item>}
          <Descriptions.Item label={t('user.col.status')}>
            {(() => {
              const status = resolveUserStatus(student, lessons)
              return <Tag color={STATUS_COLOR[status]}>{t(`enum.status.${status}`)}</Tag>
            })()}
          </Descriptions.Item>
          <Descriptions.Item label={t('user.col.userType')}><Tag color={USER_TYPE_COLOR[resolveUserType(student)]}>{t(`enum.userType.${resolveUserType(student)}`)}</Tag></Descriptions.Item>
          <Descriptions.Item label={t('user.col.ageGroup')}>{student.ageGroup ? <Tag color="geekblue">{student.ageGroup}</Tag> : <Text type="secondary">—</Text>}</Descriptions.Item>
          <Descriptions.Item label="课程等级">{student.courseLevel || <Text type="secondary">—</Text>}</Descriptions.Item>
          {variant === 'user' && <Descriptions.Item label={t('user.col.method')}>{t(`enum.method.${student.loginMethod as LoginMethod}`)}</Descriptions.Item>}
          <Descriptions.Item label={t('user.col.account')}>{student.account || <Text type="secondary">—</Text>}</Descriptions.Item>
          <Descriptions.Item label={t('user.col.channelSourceLp')}>{lpChannelSourceText(channels, student) === '—' ? <Text type="secondary">—</Text> : lpChannelSourceText(channels, student)}</Descriptions.Item>
          <Descriptions.Item label={t('user.col.code')}>{student.channelCode ? <Text code>{student.channelCode}</Text> : <Text type="secondary">—</Text>}</Descriptions.Item>
          <Descriptions.Item label={t('user.col.channelSourceApp')}>{appChannelSourceText(student) === '—' ? <Text type="secondary">—</Text> : appChannelSourceText(student)}</Descriptions.Item>
          <Descriptions.Item label={t('user.col.country')}><Tag>{lineLabel(student)}</Tag></Descriptions.Item>
          <Descriptions.Item label={t('user.col.regTime')}><LocalTime time={student.registerTime} country={student.country || student.businessLine} /></Descriptions.Item>
          {variant === 'user' ? <>
            <Descriptions.Item label={t('user.col.expireTime')}><LocalTime time={student.expireTime} country={student.country || student.businessLine} /></Descriptions.Item>
            <Descriptions.Item label="优惠码">{student.couponCode ? <Tag color="blue">{student.couponCode}</Tag> : <Text type="secondary">—</Text>}</Descriptions.Item>
          </> : <>
            <Descriptions.Item label="最新备注">{student.salesLatestNote || <Text type="secondary">—</Text>}</Descriptions.Item>
            <Descriptions.Item label="最后更新"><LocalTime time={student.salesUpdatedAt} country={student.country || student.businessLine} /></Descriptions.Item>
            <Descriptions.Item label="领取人">{student.salesOwner || <Text type="secondary">—</Text>}</Descriptions.Item>
          </>}
          <Descriptions.Item label="CC">{student.ccName || <Text type="secondary">—</Text>}</Descriptions.Item>
        </Descriptions>
      </Card>

      <Card className="page-card" bordered={false} title={<span className="section-title">{t('user.courseInfo')}</span>}>
        <Table
          rowKey="id"
          columns={courseColumns}
          dataSource={courseData}
          scroll={{ x: 900 }}
          locale={{ emptyText: t('lesson.empty') }}
          pagination={{ showTotal: (n) => t('common.total', { n }), showSizeChanger: true }}
        />
      </Card>
    </Space>
  )
}
