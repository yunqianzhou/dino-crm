import { Empty, Progress, Table } from 'antd'
import dayjs from 'dayjs'
import type { Student } from '../types'
import { outcomeReasonGroups, uniquePeople } from '../dashboard43'
import { followReason5 } from '../salesLifecycle'
import { useI18n } from '../i18n'
import { Export43, rateText, useDashboard43 } from './Dashboard43Shared'

export default function DashboardOutcomeReasons43({ users, metric }: { users: Student[]; metric: '已拒绝' | '已关闭' }) {
 const { text, label, count, reason: legacyReason, ownerName } = useDashboard43()
 const { t } = useI18n()
 const title = metric === '已拒绝' ? text('已拒绝原因分布', 'Rejection reasons') : text('已结束原因分布', 'Closure reasons')
 const people = uniquePeople(users)
 const rows = outcomeReasonGroups(people)
 const reasonLabel = (reason: string) => {
  if (reason === '__unknown__') return text('未记录原因', 'Reason not recorded')
  const key = `sales.outcome.reason.${reason}`
  return t(key) === key ? legacyReason(reason) : t(key)
 }
 return <section className="dashboard-reasons-inline" aria-label={title}>
  <div className="dashboard-block-heading"><strong>{title}</strong><Export43 name={metric === '已拒绝' ? 'rejection-reasons' : 'closure-reasons'} disabled={!people.length} sheets={() => [
   { name: text('原因分布', 'Reason distribution'), headers: [text('原因', 'Reason'), text('人数', 'Users'), text('占比', 'Share')], rows: rows.map(row => [reasonLabel(row.reason), row.users.length, rateText(row.share)]) },
   { name: text('用户明细', 'User details'), headers: ['CRM ID', text('姓名', 'Name'), text('当前 CC', 'Current CC'), text('原因', 'Reason'), text('原始原因', 'Original reason')], rows: rows.flatMap(row => row.users.map(s => [s.studentId, s.name, ownerName(s.salesOwner || '__unassigned__'), reasonLabel(row.reason), followReason5(s) || ''])) },
   { name: text('统计范围', 'Scope'), headers: ['Scope', 'Value'], rows: [['Status', label(metric)], ['Time', 'Current snapshot; activity dates do not apply'], ['Population', 'Same filtered users as the current status count; current CC and account permissions apply'], ['Deduplication', 'One reason per CRM user ID; missing reasons included'], ['Exported UTC', dayjs.utc().toISOString()]] },
  ]} /></div>
  <p className="dashboard-help">{text('按上方当前状态人数拆分，沿用当前 CC 筛选，不受活动日期影响；每人计入一个原因，未记录原因单独列出。', 'Breakdown of the current status count, using the current CC filter regardless of activity dates. Each user has one reason; missing reasons are listed separately.')}</p>
  <Table rowKey="reason" size="small" pagination={false} dataSource={rows} scroll={{ x: 480 }} locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={text('当前范围暂无对应用户', 'No matching users in this scope')} /> }} columns={[
   { title: text('原因', 'Reason'), dataIndex: 'reason', width: '45%', render: reasonLabel },
   { title: text('人数', 'Users'), key: 'users', width: 100, sorter: (a, b) => a.users.length - b.users.length, render: (_, row) => count(row.users, `${title} · ${reasonLabel(row.reason)}`, metric) },
   { title: text('占比', 'Share'), key: 'share', render: (_, row) => <div className="dashboard-reason-share"><Progress percent={row.share} showInfo={false} size="small" strokeColor={metric === '已拒绝' ? '#d99545' : '#8091a8'} /><span>{rateText(row.share)}</span></div> },
  ]} summary={() => <Table.Summary.Row><Table.Summary.Cell index={0}>{text('合计（去重）', 'Total (unique users)')}</Table.Summary.Cell><Table.Summary.Cell index={1}>{count(people, title, metric)}</Table.Summary.Cell><Table.Summary.Cell index={2}>{people.length ? '100%' : '—'}</Table.Summary.Cell></Table.Summary.Row>} />
 </section>
}
