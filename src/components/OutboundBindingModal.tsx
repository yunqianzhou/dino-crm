import { useEffect, useState } from 'react'
import { Alert, Checkbox, Modal, Space } from 'antd'
import type { Account, OutboundBinding } from '../types'
import { bindingsOf, outboundProviders, providerName } from '../outbound'
import { useI18n } from '../i18n'

export default function OutboundBindingModal({ account, onCancel, onSave }: { account: Account | null; onCancel: () => void; onSave: (bindings: OutboundBinding[]) => void }) {
  const { lang } = useI18n(); const en = lang === 'en'; const text = (zh: string, english: string) => en ? english : zh
  const [draft, setDraft] = useState<OutboundBinding[]>([])
  useEffect(() => { if (account) setDraft(bindingsOf(account).map(({ provider }) => ({ provider }))) }, [account])
  return <Modal centered open={!!account} title={`${text('绑定外呼', 'Bind calling')} · ${account?.name || ''}`} onCancel={onCancel} onOk={() => onSave(draft)} okText={text('保存绑定', 'Save bindings')} cancelText={text('取消', 'Cancel')} width={520}>
    <Alert type="info" showIcon message={text('选择需要绑定的外呼系统，可同时绑定 Sobot 和 Omicall。', 'Choose the calling systems to bind. Both Sobot and Omicall can be enabled.')} description={text('同时绑定时，每次拨号前选择使用哪一套。取消全部勾选可解绑外呼。', 'When both are bound, choose a system before each call. Clear both to unbind.')} />
    <Space direction="vertical" style={{ width: '100%', margin: '20px 0 8px' }} size={12}>
      {outboundProviders.map(provider => <div key={provider} style={{ border: '1px solid #d9d9d9', borderRadius: 8, padding: 16 }}>
        <Checkbox checked={draft.some(b => b.provider === provider)} onChange={e => setDraft(all => e.target.checked ? [...all, { provider }] : all.filter(b => b.provider !== provider))}>{providerName(provider, en)}</Checkbox>
      </div>)}
    </Space>
  </Modal>
}
