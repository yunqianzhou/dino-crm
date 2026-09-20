import { useState } from 'react'
import { Alert, Button, Descriptions, Drawer, Empty, Modal, Table, Tabs, Typography } from 'antd'
import ABPlanEditor from './ABPlanEditor'
import { countrySummary, platformSummary, versionSummary, formatDate, experimentState } from '../abTestConfig'
import type { ABHistoryEntry, ABStore, Experiment, OnlineConfig } from '../abTestConfig'

export default function ABHistoryDrawer({ store, subject, onClose }: { store: ABStore; subject: { kind: 'online' | 'experiment'; id: string; name: string } | null; onClose: () => void }) {
  const [selected, setSelected] = useState<ABHistoryEntry | null>(null)
  const records = (store.history ?? []).filter(h => h.kind === subject?.kind && h.entityId === subject.id).slice().reverse()
  const snapshot = selected?.snapshot
  const exp = selected?.kind === 'experiment' ? snapshot as Experiment : null
  const online = selected?.kind === 'online' ? snapshot as OnlineConfig : null
  return <>
    <Drawer title={`编辑历史 · ${subject?.name || '未命名配置'}`} open={Boolean(subject)} width={860} onClose={() => { setSelected(null); onClose() }}>
      <Alert type="info" showIcon style={{ marginBottom: 16 }} message="保存配置变更或变更状态时保留配置快照；未保存的修改不计入历史。原型记录仅保存在当前浏览器中。" />
      <Table rowKey="id" dataSource={records} pagination={{ pageSize: 8 }} locale={{ emptyText: <Empty description="暂无编辑历史，后续保存和状态变更会自动记录。" /> }} columns={[
        { title: '操作时间（UTC+8）', dataIndex: 'at', width: 175, render: at => formatDate(at) },
        { title: '操作人', dataIndex: 'actor', width: 160 },
        { title: '操作', dataIndex: 'action', width: 110 },
        { title: '变更内容', dataIndex: 'changes', render: (changes: string[]) => changes.join('；') },
        { title: '操作', key: 'view', width: 100, render: (_, record) => <Button type="link" onClick={() => setSelected(record)}>查看快照</Button> },
      ]} />
    </Drawer>
    <Modal title={`历史快照 · ${snapshot?.name || '未命名配置'}`} open={Boolean(selected)} onCancel={() => setSelected(null)} footer={<Button onClick={() => setSelected(null)}>关闭</Button>} width="94vw" styles={{ body: { maxHeight: '76vh', overflowY: 'auto' } }}>
      {snapshot && <>
        <Alert type="info" showIcon style={{ marginBottom: 16 }} message="当前查看的是只读历史快照，不影响现有配置。" />
        <Typography.Paragraph type="secondary">{selected?.action} · {formatDate(selected?.at ?? '')} · {selected?.actor}</Typography.Paragraph>
        <Descriptions bordered size="small" column={2} items={[
          { key: 'country', label: '国家', children: countrySummary(snapshot.target) },
          { key: 'platform', label: '终端', children: platformSummary(snapshot.target) },
          { key: 'version', label: '版本范围', children: versionSummary(snapshot.target) },
          { key: 'status', label: '当时状态', children: exp ? experimentState(exp, Date.parse(selected!.at)) : online?.status === 'published' ? '已发布' : online?.status === 'retired' ? '历史版本' : '草稿' },
          ...(exp ? [
            { key: 'base', label: '线上基准', children: `${exp.base.name} · V${exp.base.revision}` },
            { key: 'traffic', label: '实验流量', children: `${exp.traffic}%` },
            { key: 'start', label: '开始时间', children: exp.startMode === 'now' && !exp.startAt ? '开启后立即开始' : formatDate(exp.startAt) },
            { key: 'end', label: '结束时间', children: formatDate(exp.endAt) },
          ] : [
            { key: 'revision', label: '发布版本', children: online?.revision ? `V${online.revision}` : '待发布' },
            { key: 'replacement', label: '替换配置', children: store.online.find(x => x.id === online?.replacesId)?.name ?? '不替换' },
          ]),
        ]} />
        {online ? <ABPlanEditor key={selected?.id} plan={online.plan} target={online.target} readOnly onChange={() => {}} /> : exp && <Tabs key={selected?.id} items={exp.variants.map(v => ({ key: v.id, label: `${v.name} · ${v.weight}%${v.control ? ' · 对照组' : ''}`, children: <ABPlanEditor plan={v.plan} target={exp.target} readOnly onChange={() => {}} /> }))} />}
      </>}
    </Modal>
  </>
}
