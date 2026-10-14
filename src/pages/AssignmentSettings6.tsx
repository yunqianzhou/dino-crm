import { useState } from 'react'
import { Button, Collapse, Input, InputNumber, Modal, Select, Space, Switch, Table, Tabs, Tag, Typography, message } from 'antd'
import { addLog6, assignmentAccess6, applyRulesDraft6, defaultRules6, memberTeams6, hasActiveTeam6, restDays6, setState6, simulate6, usePhase6, type Account6, type Rules6 } from '../phase6'
import { usePerm6 } from '../perm6'
import { tzLabel } from '../time'

const { Text } = Typography
const weekDays = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'].map((label, i) => ({ label, value: (i + 1) % 7 }))
export default function AssignmentSettings6({ open, onCancel, configurableLines }: { open: boolean; onCancel: () => void; configurableLines: string[] }) {
  const s = usePhase6(), { actor, can, account, isDefaultAdmin } = usePerm6()
  const permittedLines = isDefaultAdmin ? configurableLines : account?.dataGrants.map(g => g.line) || []
  const [line, setLine] = useState(permittedLines.includes('越南') ? '越南' : permittedLines[0] || '')
  const [drafts, setDrafts] = useState(() => structuredClone(s.rules6)), [selectedKind, setKind] = useState<'CC' | 'TMK'>(s.rules6[line]?.mode === 'tmk' ? 'TMK' : 'CC'), [teamFilter, setTeamFilter] = useState<string>()
  const [settingsTab, setSettingsTab] = useState('assignment')
  const [trialDate, setTrialDate] = useState(new Date().toLocaleDateString('sv-SE'))
  const [scenario, setScenario] = useState('new'), [result, setResult] = useState('')
  const access = assignmentAccess6(s, account, line)
  const lineEditable = (isDefaultAdmin || !!account) && access.lineRules
  const editable = lineEditable || (can('salesV6_config_members') === 'operate' && access.memberIds.length > 0)
  const rules = drafts[line] || defaultRules6(line)
  const kind = rules.mode === 'direct' ? 'CC' : rules.mode === 'tmk' ? 'TMK' : selectedKind
  const change = (patch: Partial<Rules6>) => { setDrafts(prev => ({ ...prev, [line]: { ...(prev[line] || defaultRules6(line)), ...patch } })); setResult('') }
  const rows = s.accounts.filter(a => a.staffKind === kind && a.dataGrants.some(g => g.line === line) && (isDefaultAdmin || access.lineRules || access.memberIds.includes(a.id)) && (!teamFilter || memberTeams6(s, a, line).some(t => t.id === teamFilter)))
  const unavailable = (a: Account6) => a.status !== '启用' ? '已停用' : !hasActiveTeam6(s, a, line) ? '无可用团队' : s.roles.find(r => r.id === a.roleId)?.perms.salesV3_update !== 'operate' || s.roles.find(r => r.id === a.roleId)?.perms.salesV3 !== 'operate' ? '无跟进权限' : ''
  const save = () => {
    if (!editable) return
    for (const [businessLine, r] of Object.entries(drafts)) {
      if (!permittedLines.includes(businessLine) || !assignmentAccess6(s, account, businessLine).lineRules) continue
      if (r.mode === 'scheduled' && (!/^([01]\d|2[0-3]):[0-5]\d$/.test(r.workStart) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(r.workEnd) || r.workStart >= r.workEnd || !Number.isInteger(r.tmkPercent) || r.tmkPercent < 0 || r.tmkPercent > 100)) { setLine(businessLine); setSettingsTab('assignment'); message.error(`${businessLine}：请填写有效的当天工作时段及 TMK 比例`); return }
      if (r.dropEnabled && (!r.dropMinutes || r.dropMinutes < 1 || r.dropMinutes > 43200)) { setLine(businessLine); setSettingsTab('recycle'); message.error(`${businessLine}：请填写有效的掉库时间`); return }
    }
    setState6(prev => ({ ...prev, rules6: { ...prev.rules6, ...Object.fromEntries(Object.entries(drafts).filter(([l]) => permittedLines.includes(l)).map(([l, draft]) => [l, applyRulesDraft6(prev, account, l, draft)])) } }))
    addLog6({ actor, module: 'system', action: '保存六期分配与掉库设置', target: line }); message.success('已保存'); onCancel()
  }
  const modes = [ { value: 'direct', label: '只分配给 CC' }, { value: 'tmk', label: '只分配给 TMK' }, { value: 'scheduled', label: '按 CC 工作时间分配（含 TMK）' } ]
  return <Modal open={open} title={<Space>分配与掉库设置<Tag color="purple">六期</Tag></Space>} width={760} onCancel={onCancel} onOk={save} okText="保存" cancelText="取消" okButtonProps={{ disabled: !editable || !line }} destroyOnClose styles={{ body: { maxHeight: '72vh', overflowY: 'auto', paddingRight: 8 } }}>
    <div style={{ margin: '8px 0 18px' }}><Text strong style={{ marginRight: 12 }}>所属业务线</Text><Select aria-label="所属业务线" value={line} style={{ width: 200 }} onChange={value => { setLine(value); setKind(drafts[value]?.mode === 'tmk' ? 'TMK' : 'CC'); setTeamFilter(undefined); setScenario('new'); setResult('') }} options={permittedLines.map(l => ({ value: l, label: l }))} /></div>
    {!lineEditable && <div style={{ marginBottom: 12 }}><Text type="secondary">业务线规则只读；仅可修改数据授权范围内的成员权重和休息日。</Text></div>}
    <Tabs activeKey={settingsTab} onChange={setSettingsTab} items={[
      { key: 'assignment', label: '分配设置', children: <>
    <div style={{ marginBottom: 22 }}><Text strong style={{ marginRight: 12 }}>分配方式</Text><Select aria-label="分配方式" disabled={!lineEditable} value={rules.mode} onChange={mode => { change({ mode }); setKind(mode === 'tmk' ? 'TMK' : 'CC'); setTeamFilter(undefined); setScenario('new') }} style={{ width: 330, maxWidth: '100%' }} options={modes} />
      {rules.mode === 'scheduled' ? <div style={{ marginTop: 12, padding: 16, background: '#f5f5f5', borderRadius: 6 }}>
        <Space wrap><Text strong>CC 工作时间</Text><Text type="secondary">{line}当地时间（{tzLabel(line)}）</Text></Space>

        <Space wrap style={{ marginTop: 12 }}><Input aria-label="上班时间" type="time" disabled={!lineEditable} value={rules.workStart} onChange={e => change({ workStart: e.target.value })} style={{ width: 130 }} /><span>至</span><Input aria-label="下班时间" type="time" disabled={!lineEditable} value={rules.workEnd} onChange={e => change({ workEnd: e.target.value })} style={{ width: 130 }} /><Text type="secondary" style={{ fontSize: 12 }}>每天使用同一时段；休息日按成员设置</Text></Space>
        <div style={{ margin: '16px 0 10px' }}><Space wrap><Text strong>上班时间</Text><span>TMK</span><InputNumber aria-label="上班时间 TMK 分配比例" disabled={!lineEditable} min={0} max={100} precision={0} value={rules.tmkPercent} onChange={v => change({ tmkPercent: v ?? 0 })} style={{ width: 80 }} /><span>%</span><span>／ CC {100 - rules.tmkPercent}%</span></Space></div>
        <div><Text strong>非上班时间 / 当天 CC 全部休息</Text><span style={{ marginLeft: 12 }}>TMK 100%</span></div>
        <div style={{ marginTop: 10 }}><Text type="secondary" style={{ fontSize: 12 }}>按新线索进入时的业务线当地时间判断；CC 和 TMK 均排除当天休息成员，再按各自权重分配。应接收的一方无人可接收时保留待分配。时间与比例为示例，可调整。</Text></div>
      </div> : <div style={{ marginTop: 8 }}><Text type="secondary" style={{ fontSize: 12 }}>{rules.mode === 'tmk' ? '新线索按当天非休息 TMK 的权重分配，预约后由 TMK 手动选择销售转交；全部休息时保留待分配。' : '新线索按当天非休息 CC 的权重分配，全部休息时保留待分配。'}</Text></div>}
    </div>
    <Text strong style={{ fontSize: 16 }}>成员分配权重与休息日</Text>
    <Tabs tabBarGutter={16} activeKey={kind} onChange={v => { setKind(v as 'CC' | 'TMK'); setTeamFilter(undefined) }} items={rules.mode === 'direct' ? [{ key: 'CC', label: 'CC 分配' }] : rules.mode === 'tmk' ? [{ key: 'TMK', label: 'TMK 分配' }] : [{ key: 'CC', label: 'CC 分配' }, { key: 'TMK', label: 'TMK 分配' }]} tabBarExtraContent={<Select aria-label="筛选团队" allowClear value={teamFilter} onChange={setTeamFilter} placeholder="全部团队" style={{ width: 110 }} options={s.teams.filter(t => t.line === line && rows.some(a => memberTeams6(s, a, line).some(group => group.id === t.id))).map(t => ({ value: t.id, label: t.name }))} />} />
    <Table rowKey="id" size="small" pagination={false} dataSource={rows} scroll={{ x: 680, y: 230 }} columns={[
      { title: '领取人', width: 230, render: (_, a: Account6) => <div>{a.name}{unavailable(a) && <Tag style={{ marginLeft: 6 }}>{unavailable(a)}</Tag>}<div><Text type="secondary" style={{ fontSize: 12 }}>{a.email}</Text></div></div> },
      { title: '分配权重', width: 100, render: (_, a: Account6) => <InputNumber aria-label={`${a.name}分配权重`} style={{ width: 76 }} min={0} max={100} precision={0} disabled={!editable || !access.memberIds.includes(a.id) || !!unavailable(a)} value={rules.weights[a.id] || 0} onChange={v => change({ weights: { ...rules.weights, [a.id]: v || 0 } })} /> },
      { title: '每周休息日', width: 190, render: (_: unknown, a: Account6) => <Select mode="multiple" aria-label={`${a.name}每周休息日`} disabled={!editable || !access.memberIds.includes(a.id)} value={restDays6(rules, a.id)} options={weekDays} maxTagCount={2} placeholder="无休息日" style={{ width: '100%' }} onChange={days => change({ restDays: { ...rules.restDays, [a.id]: days } })} /> },
      { title: '所属团队', width: 160, render: (_, a: Account6) => memberTeams6(s, a, line).map(t => t.name).join('、') || '—' },
    ]} />
    <div style={{ margin: '10px 0 18px' }}><Text type="secondary" style={{ fontSize: 12 }}>{rules.mode === 'direct' ? '新线索仅按 CC 权重分配，排除当天休息成员；无人可接收时保留待分配。' : '先按分配方式确定接收方，再按对应成员权重分配，排除当天休息成员；应接收的一方无人可接收时保留待分配。'}填写 0 表示不参与，筛选团队不改变分配规则。休息日按业务线时区每周重复，仅影响新分配，不转走已有客户。默认周六、周日为示例，可逐人调整。</Text></div>
    {rules.mode !== 'direct' && <div style={{ marginBottom: 16 }}><Text type="secondary" style={{ fontSize: 12 }}>预约后由 TMK 手动选择销售转交，无需配置转交比例。</Text></div>}
    <Collapse ghost size="small" items={[{ key: 'try', label: '试分配（演示）', children: <><Space wrap><Select aria-label="试分配场景" value={scenario} style={{ width: 230 }} onChange={v => { setScenario(v); setResult('') }} options={[{ value: 'new', label: '当前时间 · 新线索进入' }, { value: 'working', label: 'CC 上班时间 · 新线索' }, { value: 'off-hours', label: 'CC 非上班时间 · 新线索' }]} />{scenario !== 'new' && <Input aria-label="试分配日期" type="date" value={trialDate} style={{ width: 150 }} onChange={e => { setTrialDate(e.target.value); setResult('') }} />}<Button disabled={scenario !== 'new' && !trialDate} onClick={() => { const a = simulate6(s, line, rules, scenario === 'working' ? true : scenario === 'off-hours' ? false : undefined, Math.random(), scenario === 'new' ? new Date() : new Date(`${trialDate}T05:00:00Z`)); setResult(a ? `分配给 ${a.staffKind} · ${a.name}` : '待分配') }}>模拟分配</Button></Space>{result && <div role="status" style={{ marginTop: 12 }}><Tag color="blue">{result}</Tag></div>}</> }]} />
      </> },
      { key: 'recycle', label: '掉库设置', children: <>
    <div style={{ marginBottom: 22 }}><Text strong style={{ fontSize: 16 }}>掉库规则</Text><div style={{ padding: 16, marginTop: 12, background: '#f5f5f5', borderRadius: 6 }}>
      <Switch aria-label="自动掉库" checked={rules.dropEnabled} disabled={!lineEditable} checkedChildren="开启" unCheckedChildren="关闭" onChange={dropEnabled => change({ dropEnabled })} />
      <Space wrap style={{ marginTop: 12, display: 'flex', color: rules.dropEnabled ? undefined : '#bfbfbf' }}><span>CC 领取后超过</span><InputNumber aria-label="掉库分钟数" min={1} max={43200} precision={0} value={rules.dropMinutes} disabled={!lineEditable || !rules.dropEnabled} onChange={v => change({ dropMinutes: v || 1 })} /><span>分钟无跟进，自动掉库并重新按 CC 比例分配。</span></Space>
      <div style={{ marginTop: 8 }}><Text type="secondary" style={{ fontSize: 12 }}>TMK 邀约中及待交接线索不触发；成功交接给 CC 后开始计时。</Text></div>
    </div></div>
      </> },
    ]} />
    <Text type="secondary" style={{ fontSize: 12 }}>六期设计预览：设置独立保存，试分配不改变现有客户归属。</Text>
  </Modal>
}
