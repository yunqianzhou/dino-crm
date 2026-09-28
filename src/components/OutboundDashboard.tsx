import { usePerm } from '../perm'
import { useState } from 'react'
import { Button, Collapse, Modal, Space, Table, Typography } from 'antd'
import type { CallRecord } from '../types'
import { callDurationSeconds, outboundSummary, providerName, structuredCallHeaders, structuredCallRow, uniqueCalls, isCompletedCall } from '../outbound'
import { downloadXlsx } from '../export'
import { useI18n } from '../i18n'
import { reportTime } from '../salesReporting'

export default function OutboundDashboard({ calls }: { calls: CallRecord[] }) {
  const { can } = usePerm()
  const { lang } = useI18n(); const en = lang === 'en'; const text = (a: string, b: string) => en ? b : a
  const [detail, setDetail] = useState<{ name: string; calls: CallRecord[] } | null>(null)
  const valid = uniqueCalls(calls).filter(isCompletedCall)
  const keys = [...new Set(valid.map(c => `${c.provider || 'historical'}:${c.routeId || 'unknown'}`))]
  const rows = keys.map(key => { const selected = valid.filter(c => `${c.provider || 'historical'}:${c.routeId || 'unknown'}` === key); return { key, name: providerName(selected[0].provider, en), route: selected[0].routeName || text('未记录', 'Not recorded'), calls: selected, ...outboundSummary(selected) } })
  const total = outboundSummary(valid)
  return <div data-prototype-anchor="outbound-dashboard" style={{ marginTop: 16 }}><Collapse items={[{ key: 'outbound', label: text('外呼系统与线路明细', 'Calling systems and routes'), children: <>
    <Space wrap style={{ marginBottom: 12 }}><Typography.Text strong>{text('合计', 'Total')}：{total.total} {text('次通话', 'calls')} · {total.people} {text('位用户', 'users')} · {total.connected} {text('次接通', 'connected calls')} · {total.seconds} {text('秒', 'seconds')}</Typography.Text>{can('managementDashboard_export') === 'operate' && <Button onClick={() => downloadXlsx('外呼系统与线路明细.xlsx', structuredCallHeaders, valid.map(structuredCallRow))}>{text('下载通话明细', 'Download call details')}</Button>}</Space>
    <Table size="small" rowKey="key" dataSource={rows} pagination={false} scroll={{ x: 810 }} columns={[
      { title: text('外呼系统', 'Calling system'), dataIndex: 'name' }, { title: text('线路', 'Route'), dataIndex: 'route' },
      { title: text('通话次数', 'Calls'), dataIndex: 'total', render: (n, row) => can('salesV3') === 'none' ? n : <Button type="link" onClick={() => setDetail({ name: `${row.name} · ${row.route}`, calls: row.calls })}>{n}</Button> },
      { title: text('外呼人数', 'Called users'), dataIndex: 'people' }, { title: text('接通次数', 'Connected calls'), dataIndex: 'connected' }, { title: text('接通人数', 'Connected users'), dataIndex: 'connectedPeople' }, { title: text('接通时长（秒）', 'Talk time (seconds)'), dataIndex: 'seconds' },
    ]} />
    <Typography.Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0 }}>{text('沿用上方日期、当前 CC 与数据权限范围。两套系统统一统计；同一用户跨系统外呼，合计人数只计一次。进行中和发起失败不计入有效完结通话；历史缺失字段显示未记录。', 'Uses the date, current CC and permission scope above. Users are deduplicated across systems in the total. Ongoing and failed starts are excluded. Missing historical fields remain unrecorded.')}</Typography.Paragraph>
  </> }]} />
    <Modal width={980} open={!!detail} title={detail?.name} onCancel={() => setDetail(null)} footer={null}><Table rowKey="id" size="small" dataSource={detail?.calls || []} scroll={{ x: 820 }} columns={[{ title: text('用户 ID', 'User ID'), dataIndex: 'studentId' }, { title: text('客户', 'Customer'), dataIndex: 'customer' }, { title: text('起呼时间', 'Started at'), render: (_, c) => reportTime(c.time, c.businessLine) }, { title: text('操作人', 'Agent'), dataIndex: 'agent' }, { title: text('结果', 'Result'), dataIndex: 'result' }, { title: text('接通秒数', 'Talk seconds'), render: (_, c) => callDurationSeconds(c) }]} /></Modal>
  </div>
}
