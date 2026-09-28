import { useEffect, useState } from 'react'
import { Button, Descriptions, Input, Modal, Tag, Typography, message } from 'antd'
import type { CallRecord } from '../types'
import { callDurationSeconds, callResultName, providerName } from '../outbound'
import { reportTime } from '../salesReporting'
import { useI18n } from '../i18n'
export default function OutboundCallDetails({ call, onClose, onSaveNote }: { call: CallRecord | null; onClose: () => void; onSaveNote?: (note: string) => void }) {
  const { lang } = useI18n(); const en = lang === 'en'; const text = (a: string, b: string) => en ? b : a
  const [note, setNote] = useState('')
  useEffect(() => { setNote(call?.note || '') }, [call])
  return <Modal centered styles={{ body: { maxHeight: '65vh', overflowY: 'auto' } }} open={!!call} title={text('通话结构化详情', 'Structured call details')} onCancel={onClose} footer={onSaveNote ? <Button type="primary" onClick={() => note.trim() ? onSaveNote(note.trim()) : message.warning(text('请填写跟进备注', 'Enter a note'))}>{text('保存备注', 'Save note')}</Button> : null} width={660}>{call && <><Descriptions bordered size="small" column={1} items={[
    ['通话 ID', 'Call ID', call.id], ['用户 ID', 'User ID', call.studentId], ['外呼系统', 'System', providerName(call.provider, en)], ['第三方通话 ID', 'Provider call ID', call.providerCallId || '—'], ['线路 ID', 'Route ID', call.routeId || '—'], ['线路', 'Route', call.routeName || '—'], ['外显号码', 'Caller number', call.callerNumber || '—'], ['坐席 / 分机', 'Seat / extension', call.seat || '—'], ['操作人', 'Agent', call.agent], ['通话结果', 'Result', callResultName(call.result, en)], ['结束原因', 'End reason', call.endReason || '—'], ['接通时长（秒）', 'Talk time (seconds)', callDurationSeconds(call)], ['起呼时间', 'Started at', reportTime(call.time, call.businessLine)], ['接通时间', 'Answered at', reportTime(call.answeredAt, call.businessLine)], ['结束时间', 'Ended at', reportTime(call.endedAt, call.businessLine)], ['录音状态', 'Recording', <Tag>{call.recordingStatus === 'pending' ? text('待同步', 'Pending') : call.audioUrl ? text('可播放', 'Available') : text('无录音', 'Unavailable')}</Tag>], ['数据同步时间', 'Synced at', reportTime(call.syncedAt, call.businessLine)], ['跟进备注', 'Note', call.note || text('未填写', 'Not entered')],
  ].map(([zh, english, value], i) => ({ key: i, label: text(String(zh), String(english)), children: value }))} />{onSaveNote && <div style={{ marginTop: 16 }}><Typography.Paragraph>{text('补充 / 修改跟进备注', 'Add / edit follow-up note')}</Typography.Paragraph><Input.TextArea aria-label={text('跟进备注', 'Follow-up note')} rows={3} maxLength={1000} value={note} onChange={e => setNote(e.target.value)} /></div>}</>}</Modal>
}
