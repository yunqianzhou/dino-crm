import { Form, InputNumber, Modal, Typography, message } from 'antd'
import type { Student } from '../types'
import { usePerm } from '../perm'
import { useI18n } from '../i18n'
import { setState } from '../store'
import { addMembership5, membershipLimit5 } from '../review5'

export default function MembershipModal5({ student, source, permitted, onClose }: {
  student: Student; source: 'users' | 'sales'; permitted: boolean; onClose: () => void
}) {
  const [form] = Form.useForm()
  const { account, actor, allowedLines } = usePerm()
  const { lang, t } = useI18n()
  const en = lang === 'en'
  const limit = membershipLimit5(account)
  const save = async () => {
    const { days } = await form.validateFields()
    try {
      setState(state => addMembership5(state, { studentId: student.studentId, days, actor, permitted, scope: allowedLines(), source }))
      message.success(en ? 'Membership extended' : '会员时长已增加')
      onClose()
    } catch {
      message.error(en ? 'Unable to save. Check permissions, business-line scope and the day limit.' : '保存失败，请核对权限、业务线范围及天数上限。')
    }
  }
  return <Modal open title={en ? 'Add membership days' : '添加会员时长'} onOk={save} onCancel={onClose}
    okText={t('common.save')} cancelText={t('common.cancel')} okButtonProps={{ disabled: !permitted }} destroyOnClose>
    <Typography.Paragraph>{student.localName || student.name} · {student.studentId}</Typography.Paragraph>
    <Form form={form} layout="vertical" initialValues={{ days: 1 }}>
      <Form.Item name="days" label={t('user.addMembership.days')} extra={limit === 3 ? (en ? 'CCs may add up to 3 days per operation.' : 'CC 每次最多可添加 3 天。') : undefined}
        rules={[{ required: true, type: 'integer', min: 1, max: limit, message: en ? `Enter a whole number from 1 to ${limit}` : `请输入 1～${limit} 的整数` }]}>
        <InputNumber min={1} max={limit} precision={0} addonAfter={en ? 'days' : '天'} style={{ width: '100%' }} />
      </Form.Item>
    </Form>
  </Modal>
}
