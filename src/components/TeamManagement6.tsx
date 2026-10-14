import { useState } from 'react'
import { Button, Form, Input, Modal, Select, Switch, Table, Tag, Typography, message } from 'antd'
import { EditOutlined, PlusOutlined } from '@ant-design/icons'
import { addLog6, setState6, usePhase6, type Team6 } from '../phase6'
import { BUSINESS_LINES } from '../types'

export default function TeamManagement6({ editable, actor }: { editable: boolean; actor: string }) {
  const s = usePhase6(), [editing, setEditing] = useState<Team6 | null>(), [form] = Form.useForm()
  const [filter, setFilter] = useState<string>()
  const line = Form.useWatch('line', form)
  const save = async () => {
    if (!editable) return
    const v = await form.validateFields()
    if (s.teams.some(t => t.id !== editing?.id && t.name === v.name.trim() && t.line === v.line)) { message.error('该业务线已存在同名分组'); return }
    if (v.ownerId && !s.accounts.some(a => a.id === v.ownerId && a.dataGrants.some(g => g.line === v.line))) { message.error('负责人必须已获得该业务线的数据授权'); return }
    const row: Team6 = { id: editing?.id || crypto.randomUUID(), name: v.name.trim(), line: v.line, enabled: v.enabled, ownerId: v.ownerId, memberIds: editing ? s.teams.find(t => t.id === editing.id)?.memberIds || [] : [] }
    setState6(prev => ({ ...prev, teams: editing ? prev.teams.map(t => t.id === editing.id ? row : t) : [...prev.teams, row] }))
    addLog6({ actor, module: 'system', action: editing ? '编辑数据分组' : '新增数据分组', target: row.name }); setEditing(undefined); message.success('已保存')
  }
  return <>
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}><Select placeholder="全部业务线" allowClear style={{ width: 200 }} value={filter} onChange={setFilter} options={BUSINESS_LINES.map(l => ({ value: l, label: l }))} />{editable && <Button type="primary" icon={<PlusOutlined />} onClick={() => setEditing(null)}>新增分组</Button>}</div>
    <Table rowKey="id" dataSource={s.teams.filter(t => !filter || t.line === filter)} pagination={{ pageSize: 10 }} columns={[
      { title: '分组名称', dataIndex: 'name' }, { title: '业务线', dataIndex: 'line' },
      { title: '负责人', render: (_, t: Team6) => t.ownerId ? s.accounts.find(a => a.id === t.ownerId)?.name || '已移除成员' : '—' },
      { title: '成员数', render: (_, t: Team6) => t.memberIds.length },
      { title: '状态', dataIndex: 'enabled', render: (v: boolean) => <Tag color={v ? 'green' : 'default'}>{v ? '启用' : '停用'}</Tag> },
      { title: '操作', render: (_, t: Team6) => <Button type="link" size="small" icon={<EditOutlined />} disabled={!editable} onClick={() => setEditing(t)}>编辑</Button> },
    ]} />
    <Typography.Text type="secondary">成员在「成员账号」中设置所属组。负责人及成员的数据权限在成员账号中单独配置。</Typography.Text>
    <Modal open={editing !== undefined} title={editing ? '编辑数据分组' : '新增数据分组'} width={560} onCancel={() => setEditing(undefined)} onOk={save} okText="保存" cancelText="取消" destroyOnClose afterOpenChange={open => { if (open) { form.resetFields(); form.setFieldsValue(editing || { line: '越南', enabled: true, memberIds: [] }) } }}>
      <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
        <Form.Item name="name" label="分组名称" rules={[{ required: true, whitespace: true, message: '请输入分组名称' }, { max: 40 }]}><Input /></Form.Item>
        <Form.Item name="line" label="业务线" rules={[{ required: true }]}><Select disabled={!!editing} options={BUSINESS_LINES.map(l => ({ value: l, label: l }))} onChange={() => form.setFieldValue('ownerId', undefined)} /></Form.Item>
        <Form.Item name="ownerId" label="负责人"><Select allowClear placeholder="选择负责人" options={s.accounts.filter(a => a.dataGrants.some(g => g.line === line)).map(a => ({ value: a.id, label: `${a.name}${a.status === '停用' ? '（停用）' : ''}`, disabled: a.status === '停用' && a.id !== editing?.ownerId }))} /></Form.Item>
        <Form.Item name="enabled" label="状态" valuePropName="checked" extra="停用后不再通过本组参与新分配，已有客户及数据授权保留。"><Switch checkedChildren="启用" unCheckedChildren="停用" /></Form.Item>
      </Form>
    </Modal>
  </>
}
