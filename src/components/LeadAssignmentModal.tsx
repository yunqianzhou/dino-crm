import { useState } from 'react'
import { Alert, Button, Descriptions, Input, Modal, Select, Space, Table, Tag, Typography, message } from 'antd'
import { setState, useStore } from '../store'
import { usePerm } from '../perm'
import { businessLineOf } from '../channel'
import { assignLeads, canReceiveLead } from '../phase5'
import type { AssignmentResult } from '../phase5'
import type { Student } from '../types'

export default function LeadAssignmentModal({ records, batch = false, seeAllOwners = false, onClose, onDone }: {
  records: Student[]; batch?: boolean; seeAllOwners?: boolean; onClose: () => void; onDone?: () => void
}) {
  const state = useStore(state => state)
  const { can, actor, account, allowedLines } = usePerm()
  const [target, setTarget] = useState<string>()
  const [reason, setReason] = useState('')
  const [results, setResults] = useState<AssignmentResult[]>()
  const permitted = account?.status !== '停用' && (batch
    ? can('salesV3') === 'operate' && can('salesV5_batch_assign') === 'operate'
    : can('usersV2') !== 'none' && can('salesV3_config') === 'operate')
  const lines = [...new Set(records.map(record => businessLineOf(state.channels, record)))]
  const candidates = state.accounts.filter(account => lines.every(line => canReceiveLead(account, state.roles, line)))
  const nameOf = (email?: string) => state.accounts.find(account => account.email === email)?.name || email || '未分配'
  const submit = () => {
    if (!permitted) { message.error('当前账号无分配权限'); return }
    if (!target) { message.warning('请选择目标销售'); return }
    let outcomes: AssignmentResult[] = []
    setState(current => {
      const result = assignLeads(current, { records, target, actor, source: batch ? '销售中心五期' : '用户中心五期', scope: allowedLines(), permitted, seeAllOwners, reason })
      outcomes = result.results
      return result.state
    })
    setResults(outcomes)
    onDone?.()
  }
  const success = results?.filter(result => result.status === '成功').length || 0
  const skipped = results?.filter(result => result.status === '跳过').length || 0
  const failures = results?.filter(result => result.status === '失败').length || 0
  return <Modal open title={results ? '分配结果' : batch ? '批量分配线索' : '重新分配线索'} width={batch ? 680 : 560} onCancel={onClose}
    footer={results ? <Button type="primary" onClick={onClose}>完成</Button> : <Space><Button onClick={onClose}>取消</Button><Button type="primary" disabled={!target || !permitted} onClick={submit}>{batch ? `确认分配 ${records.length} 条` : '确认分配'}</Button></Space>}>
    {results ? <><Alert showIcon type={failures ? 'warning' : 'success'} message={`成功 ${success} 条 · 跳过 ${skipped} 条 · 失败 ${failures} 条`} style={{ margin: '16px 0' }} />
      <Table size="small" rowKey="id" dataSource={results} pagination={results.length > 5 ? { pageSize: 5 } : false} columns={[
        { title: '用户', dataIndex: 'name' }, { title: '结果', dataIndex: 'status', render: value => <Tag color={value === '成功' ? 'green' : value === '失败' ? 'red' : 'default'}>{value}</Tag> }, { title: '说明', dataIndex: 'reason' },
      ]} />
      {!!failures && <Typography.Paragraph type="secondary" style={{ marginTop: 12 }}>失败记录未修改。关闭后刷新列表，再选择需要处理的线索。</Typography.Paragraph>}
    </> : <>
      <Alert type="info" showIcon message={batch ? `已选择 ${records.length} 条线索，将统一分配给一位销售` : '修改 CC 后，用户中心与销售中心同步更新'} style={{ margin: '16px 0' }} />
      <Descriptions size="small" column={1} items={[
        { key: 'user', label: batch ? '已选用户' : '用户', children: records.slice(0, 3).map(record => `${record.localName || record.name}（${record.studentId}）`).join('、') + (records.length > 3 ? ` 等 ${records.length} 位` : '') },
        { key: 'owner', label: '当前 CC', children: [...new Set(records.map(record => nameOf(record.salesOwner)))].join('、') },
        { key: 'lines', label: '业务线', children: lines.join('、') || '未明确业务线' },
      ]} />
      <div style={{ margin: '20px 0 8px', fontWeight: 500 }}>目标销售 <span style={{ color: '#ff4d4f' }}>*</span></div>
      <Select aria-label="目标销售" style={{ width: '100%' }} showSearch optionFilterProp="label" value={target} onChange={setTarget} placeholder="搜索销售姓名 / 邮箱"
        options={candidates.map(account => ({ value: account.email, label: `${account.name} · ${account.email}`, disabled: !batch && account.email === records[0]?.salesOwner }))}
        notFoundContent="暂无可承接全部所选业务线的在职销售，请按业务线分别分配" />
      <div style={{ margin: '16px 0 8px', fontWeight: 500 }}>分配原因 <Typography.Text type="secondary">（选填）</Typography.Text></div>
      <Input.TextArea aria-label="分配原因" value={reason} onChange={event => setReason(event.target.value)} rows={2} maxLength={200} showCount placeholder="例如：团队调整、负责人休假、线索交接" />
      <Typography.Paragraph type="secondary" style={{ marginTop: 22, marginBottom: 4, fontSize: 12 }}>保留跟进阶段、备注及预约历史；分配记录可追溯。掉库计时从本次分配重新开始。</Typography.Paragraph>
      {batch && <Typography.Text type="secondary" style={{ fontSize: 12 }}>已归属目标销售的线索会跳过；状态或负责人变化的线索会单独显示失败原因。</Typography.Text>}
    </>}
  </Modal>
}
