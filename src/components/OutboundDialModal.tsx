import { useEffect, useRef, useState } from 'react'
import { Alert, Button, DatePicker, Descriptions, Form, Input, Modal, Radio, Select, Space, Tag, Typography, message } from 'antd'
import dayjs from 'dayjs'
import type { Account, CallRecord, OutboundProvider, Student } from '../types'
import { availableBindings, outboundRoutes, providerName, upsertCall } from '../outbound'
import { genCallId, setState } from '../store'
import { useI18n } from '../i18n'

type Appointment = { booked: boolean; scheduledStartAt?: string; meetingLink?: string }
export default function OutboundDialModal({ student, account, actor, canDial, onCancel, onSave }: { student: Student | null; account: Account | null; actor: string; canDial: boolean; onCancel: () => void; onSave: (record: CallRecord, note: string, intention: string, appointment?: Appointment) => void }) {
  const { lang } = useI18n(); const en = lang === 'en'; const text = (zh: string, english: string) => en ? english : zh
  const [provider, setProvider] = useState<OutboundProvider>()
  const [record, setRecord] = useState<CallRecord | null>(null)
  const [phase, setPhase] = useState<'select' | 'ringing' | 'connected' | 'summary'>('select')
  const [note, setNote] = useState(''); const [intention, setIntention] = useState('未填写')
  const [booked, setBooked] = useState(false); const [appointmentTime, setAppointmentTime] = useState<dayjs.Dayjs | null>(null)
  const [meetingLink, setMeetingLink] = useState(''); const [elapsed, setElapsed] = useState(0)
  const active = useRef(false)
  const bindings = availableBindings(account, student?.businessLine || '')
  useEffect(() => {
    if (!student) return
    const options = availableBindings(account, student.businessLine)
    setProvider(options.length === 1 ? options[0].provider : undefined)
    setPhase('select'); setRecord(null); setNote(''); setIntention(student.purchaseIntention || '未填写'); setBooked(false); setAppointmentTime(null); setMeetingLink(''); setElapsed(0); active.current = false
  }, [student])
  useEffect(() => {
    if (phase !== 'connected' || !record?.answeredAt) return
    const interval = window.setInterval(() => setElapsed(Math.max(0, Math.floor((Date.now() - Date.parse(record.answeredAt!)) / 1000))), 250)
    return () => window.clearInterval(interval)
  }, [phase, record?.answeredAt])
  const selected = bindings.find(b => b.provider === provider)
  const route = outboundRoutes.find(r => r.id === selected?.routeId)
  const persist = (next: CallRecord) => { setRecord(next); setState(prev => ({ ...prev, callRecords: upsertCall(prev.callRecords || [], next) })) }
  const start = () => {
    if (active.current || !student || !canDial || !selected || !route || !student.phone) return
    active.current = true
    const id = genCallId(); const now = new Date().toISOString()
    persist({ id, studentId: student.studentId, customer: student.localName || student.name, phone: student.phone, businessLine: student.businessLine, result: '待确认', duration: '—', note: '', agent: actor, time: now, provider, providerCallId: `demo-${provider}-${id}`, correlationId: id, routeId: route.id, routeName: route.name, callerNumber: route.callerNumber, seat: selected.seat, callStatus: 'DIALING', recordingStatus: 'unavailable' })
    setPhase('ringing')
  }
  const finish = (result: CallRecord['result']) => {
    if (!record || phase === 'summary') return
    const now = new Date().toISOString()
    const seconds = result === '已接通' && record.answeredAt ? Math.max(0, Math.floor((Date.parse(now) - Date.parse(record.answeredAt)) / 1000)) : 0
    persist({ ...record, result, duration: result === '已接通' ? `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}` : '—', durationSeconds: seconds, callStatus: result === '发起失败' ? 'START_FAILED' : 'COMPLETED', endedAt: now, endReason: result === '已接通' ? 'NORMAL_CLEARING' : result === '发起失败' ? 'ROUTE_UNAVAILABLE' : 'NO_ANSWER', recordingStatus: result === '已接通' ? 'pending' : 'unavailable', syncedAt: now })
    setPhase('summary')
  }
  const save = () => {
    if (!record || !note.trim()) return message.warning(text('请填写本次跟进备注', 'Enter a follow-up note'))
    if (booked && (!appointmentTime || dayjs.tz(appointmentTime.format('YYYY-MM-DD HH:mm:ss'), 'Asia/Ho_Chi_Minh').valueOf() <= Date.now())) return message.warning(text('请选择未来的预约时间', 'Select a future appointment time'))
    onSave(record, note.trim(), intention, booked ? { booked: true, scheduledStartAt: appointmentTime!.format('YYYY-MM-DD HH:mm:ss'), meetingLink } : undefined)
  }
  return <Modal open={!!student} title={text('外呼', 'Outbound call')} width={590} maskClosable={false} closable={phase === 'select' || phase === 'summary'} keyboard={phase === 'select' || phase === 'summary'} onCancel={onCancel} footer={phase === 'select' ? <Space><Button onClick={onCancel}>{text('取消', 'Cancel')}</Button><Button type="primary" disabled={!selected || !canDial || !student?.phone} onClick={start}>{text('发起外呼', 'Start call')}</Button></Space> : phase === 'summary' ? <Space wrap><Button onClick={onCancel}>{text('稍后填写', 'Write later')}</Button><Button type="primary" onClick={save}>{text('保存跟进', 'Save follow-up')}</Button></Space> : phase === 'connected' ? <Button danger type="primary" onClick={() => finish('已接通')}>{text('挂断', 'Hang up')}</Button> : <Button danger onClick={() => finish('无人接听')}>{text('结束呼叫', 'End call')}</Button>}>
    <Alert type="info" showIcon message={text('原型演示 · 不会拨打真实电话', 'Prototype demo · no real calls')} style={{ marginBottom: 16 }} />
    <Typography.Title level={5}>{student?.localName || student?.name}</Typography.Title><Typography.Paragraph type="secondary">{student?.studentId} · {student?.phone}</Typography.Paragraph>
    {phase === 'select' ? <>
      {!canDial || !bindings.length ? <Alert type="warning" showIcon message={text('当前账号暂无可用外呼能力', 'No calling capability available')} description={text('请在系统管理中为当前账号绑定坐席及可用于该客户国家的线路，并确认外呼权限。', 'Bind a seat and a route for this country in System Settings, and check calling permissions.')} /> : <>
        <Typography.Paragraph strong>{text(bindings.length > 1 ? '请选择本次使用的外呼系统' : '本次外呼系统', bindings.length > 1 ? 'Choose a system for this call' : 'Calling system')}</Typography.Paragraph>
        <Radio.Group value={provider} onChange={e => setProvider(e.target.value)} style={{ width: '100%' }}><Space direction="vertical" style={{ width: '100%' }}>{bindings.map(b => { const r = outboundRoutes.find(item => item.id === b.routeId)!; return <div key={b.provider} style={{ border: `1px solid ${provider === b.provider ? '#1677ff' : '#d9d9d9'}`, borderRadius: 8, padding: 14 }}><Radio value={b.provider}>{providerName(b.provider, en)}</Radio><div style={{ margin: '8px 0 0 24px', color: '#666', fontSize: 13 }}>{text('坐席', 'Seat')}：{b.seat} · {en ? r.nameEn : r.name}</div></div> })}</Space></Radio.Group>
        {bindings.length > 1 && <Typography.Paragraph type="secondary" style={{ marginTop: 12 }}>{text('每次起呼前单独选择；线路沿用该系统已绑定的配置。', 'Choose before each call. The route follows the selected system binding.')}</Typography.Paragraph>}
      </>}
    </> : <>
      <Descriptions size="small" column={1} items={[{ key: 'provider', label: text('外呼系统', 'System'), children: providerName(record?.provider, en) }, { key: 'route', label: text('线路 / 坐席', 'Route / seat'), children: `${record?.routeName} / ${record?.seat}` }]} />
      {phase === 'ringing' && <><Typography.Title level={4}>{text('正在呼叫…', 'Calling…')}</Typography.Title><Space wrap><Button onClick={() => { if (!record) return; persist({ ...record, answeredAt: new Date().toISOString() }); setPhase('connected') }}>{text('演示客户接通', 'Simulate answer')}</Button><Button onClick={() => finish('无人接听')}>{text('演示无人接听', 'Simulate no answer')}</Button><Button onClick={() => finish('发起失败')}>{text('演示线路失败', 'Simulate route failure')}</Button></Space></>}
      {phase === 'connected' && <div style={{ textAlign: 'center', padding: 24 }}><Tag color="green">{text('通话中', 'Connected')}</Tag><Typography.Title level={2}>{Math.floor(elapsed / 60).toString().padStart(2, '0')}:{(elapsed % 60).toString().padStart(2, '0')}</Typography.Title></div>}
      {phase === 'summary' && <><Alert type={record?.result === '发起失败' ? 'warning' : 'success'} showIcon style={{ margin: '16px 0' }} message={text('通话事实已保存', 'Call facts saved')} description={text('系统、线路、结果和时长已归档；有效完结通话已同步到 Dashboard。未填写备注也会保留。', 'System, route, result and duration are saved. Completed calls feed the Dashboard, even without a note.')} /><Space><Tag>{record?.result}</Tag><span>{text('接通时长', 'Talk time')}：{record?.duration}</span><Tag>{record?.recordingStatus === 'pending' ? text('录音待同步', 'Recording pending') : text('无录音', 'No recording')}</Tag></Space>
        <Form layout="vertical" style={{ marginTop: 16 }}><Form.Item label={text('购买意向', 'Purchase intent')}><Select value={intention} onChange={setIntention} options={['未填写', '有意向', '无意向'].map(value => ({ value, label: value }))} /></Form.Item>
          {student?.businessLine === '越南' && record?.result === '已接通' && <><Form.Item label={text('下一步', 'Next step')}><Select value={booked} onChange={setBooked} options={[{ value: false, label: text('继续跟进', 'Continue follow-up') }, { value: true, label: text('预约销售咨询', 'Book consultation') }]} /></Form.Item>{booked && <><Form.Item label={text('预约时间（越南当地时间 UTC+7）', 'Appointment time (Vietnam UTC+7)')} required><DatePicker showTime value={appointmentTime} onChange={setAppointmentTime} style={{ width: '100%' }} /></Form.Item><Form.Item label="Google Meet"><Input value={meetingLink} onChange={e => setMeetingLink(e.target.value)} /></Form.Item></>}</>}
          <Form.Item label={text('本次跟进备注', 'Follow-up note')} required><Input.TextArea value={note} onChange={e => setNote(e.target.value)} rows={3} maxLength={1000} /></Form.Item>
        </Form>
      </>}
    </>}
  </Modal>
}
