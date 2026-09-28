import { useEffect, useState } from 'react'
import { Alert, Card, Checkbox, Form, Input, Modal, Select, Space, message } from 'antd'
import type { Account, OutboundBinding } from '../types'
import { bindingsOf, outboundProviders, outboundRoutes, providerName } from '../outbound'
import { useI18n } from '../i18n'

export default function OutboundBindingModal({ account, onCancel, onSave }: { account: Account | null; onCancel: () => void; onSave: (bindings: OutboundBinding[]) => void }) {
  const { lang } = useI18n(); const en = lang === 'en'; const text = (zh: string, english: string) => en ? english : zh
  const [draft, setDraft] = useState<OutboundBinding[]>([])
  useEffect(() => { if (account) setDraft(bindingsOf(account).map(b => ({ ...b }))) }, [account])
  const submit = () => {
    if (draft.some(b => !b.seat.trim() || !outboundRoutes.some(r => r.provider === b.provider && r.id === b.routeId))) return message.warning(text('请为每套已选系统填写坐席并选择线路', 'Enter a seat and select a route for every selected system'))
    onSave(draft.map(b => ({ ...b, seat: b.seat.trim() })))
  }
  return <Modal centered styles={{ body: { maxHeight: '65vh', overflowY: 'auto' } }} open={!!account} title={`${text('绑定外呼', 'Bind calling')} · ${account?.name || ''}`} onCancel={onCancel} onOk={submit} okText={text('保存绑定', 'Save bindings')} cancelText={text('取消', 'Cancel')} width={620}>
    <Alert type="info" showIcon message={text('可同时绑定两套外呼能力；每套系统分别选择坐席和线路。', 'Bind one or both calling systems, each with its own seat and route.')} description={text('同时绑定时，销售在每次拨号前选择使用哪一套。取消全部勾选可解绑外呼。线路为原型演示配置。', 'When both are bound, choose a system before each call. Clear both to unbind. Routes are prototype fixtures.')} />
    <Space direction="vertical" style={{ width: '100%', marginTop: 16 }}>
      {outboundProviders.map(provider => {
        const binding = draft.find(b => b.provider === provider)
        const update = (values: Partial<OutboundBinding>) => setDraft(all => all.map(b => b.provider === provider ? { ...b, ...values } : b))
        return <Card size="small" key={provider} title={<Checkbox checked={!!binding} onChange={e => setDraft(all => e.target.checked ? [...all, { provider, seat: '', routeId: '' }] : all.filter(b => b.provider !== provider))}>{providerName(provider, en)}</Checkbox>}>
          {binding ? <Form layout="vertical"><Form.Item label={text('坐席 / 分机号', 'Seat / extension')} required><Input aria-label={`${providerName(provider, en)} ${text('坐席', 'seat')}`} value={binding.seat} maxLength={64} onChange={e => update({ seat: e.target.value })} /></Form.Item><Form.Item label={text('外呼线路', 'Calling route')} required style={{ marginBottom: 0 }}><Select aria-label={`${providerName(provider, en)} ${text('线路', 'route')}`} style={{ width: '100%' }} placeholder={text('请选择线路', 'Select a route')} value={binding.routeId || undefined} onChange={routeId => update({ routeId })} options={outboundRoutes.filter(r => r.provider === provider).map(r => ({ value: r.id, label: en ? r.nameEn : r.name }))} /></Form.Item></Form> : <span style={{ color: '#8c8c8c' }}>{text('未绑定', 'Not bound')}</span>}
        </Card>
      })}
    </Space>
  </Modal>
}
