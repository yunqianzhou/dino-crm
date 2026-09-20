import { useEffect, useRef, useState } from 'react'
import { Alert, Button, Card, Checkbox, Descriptions, Empty, Form, Input, InputNumber, message, Modal, Radio, Select, Space, Steps, Table, Tabs, Tag, Typography } from 'antd'
import { ArrowLeftOutlined, ArrowRightOutlined, CheckCircleOutlined, CopyOutlined, DeleteOutlined, PlusOutlined, SaveOutlined } from '@ant-design/icons'
import { usePerm } from '../perm'
import ABPlanEditor from '../components/ABPlanEditor'
import { STORAGE_KEY, clone, closeExperiment, countries, enableExperiment, experimentState, formatDate, fromDateInput, makeId, newExperiment, newOnline, newPlan, promoteVariant, publishOnline, saveExperiment, saveOnline, seedStore, targetSummary, templates, toDateInput, validateExperiment, validateOnline, weightTotal } from '../abTestConfig'
import type { ABStore, Experiment, OnlineConfig, Platform, Target, Variant, VersionOperator } from '../abTestConfig'
import './AppABTest.css'

const { Title, Text, Paragraph } = Typography
const versionOptions = [{ value: '>', label: '大于 >' }, { value: '>=', label: '大于等于 ≥' }, { value: '=', label: '等于 =' }, { value: '<', label: '小于 <' }, { value: '<=', label: '小于等于 ≤' }]
type Editing = { kind: 'online'; value: OnlineConfig } | { kind: 'experiment'; value: Experiment }
function loadStore(): ABStore {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')
    if (stored?.version === 2 && Array.isArray(stored.online) && Array.isArray(stored.experiments)) {
      const targetOK = (t: Target) => t && Array.isArray(t.countries) && Array.isArray(t.platforms) && Array.isArray(t.versions)
      const planOK = (p: OnlineConfig['plan']) => p && templates.some(t => t.id === p.template) && p.copy && p.translations
      if (stored.online.every((x: OnlineConfig) => x && typeof x.id === 'string' && targetOK(x.target) && planOK(x.plan)) && stored.experiments.every((x: Experiment) => x && typeof x.id === 'string' && targetOK(x.target) && x.base && planOK(x.base.plan) && Array.isArray(x.variants) && x.variants.every(v => planOK(v.plan)))) return stored
    }
    const seed = seedStore()
    const legacy = JSON.parse(localStorage.getItem('dinoai_app_ab_preview_v1') ?? 'null')
    if (legacy && templates.some(t => t.id === legacy.template) && legacy.copy && typeof legacy.copy === 'object') {
      const plan = newPlan()
      for (const [key, copy] of Object.entries(legacy.copy)) {
        const c = copy as Record<string, unknown>
        if (plan.copy[key] && c && ['title', 'body', 'button'].every(k => typeof c[k] === 'string') && ['static', 'breathe', 'shake'].includes(String(c.animation))) plan.copy[key] = clone(c) as unknown as typeof plan.copy[string]
      }
      seed.online.unshift({ ...newOnline(), name: '旧版页面预览草稿', plan: { ...plan, template: legacy.template } })
    }
    return seed
  } catch { return seedStore() }
}

function TargetFields({ value, onChange, disabled }: { value: Target; onChange: (target: Target) => void; disabled: boolean }) {
  const changeVersion = (index: number, patch: Partial<Target['versions'][number]>) => onChange({ ...value, versions: value.versions.map((c, i) => i === index ? { ...c, ...patch } : c) })
  return <Form layout="vertical" disabled={disabled} className="ab-target-form">
    <div className="ab-two-fields">
      <Form.Item label="国家（按用户当前 IP）" htmlFor="ab-countries" required>
        <Select id="ab-countries" mode="multiple" placeholder="选择适用国家" value={value.countries} options={countries} onChange={selected => onChange({ ...value, countries: selected.includes('*') ? selected[selected.length - 1] === '*' ? ['*'] : selected.filter(c => c !== '*') : selected })} />
      </Form.Item>
      <Form.Item label="App 终端" required><Checkbox.Group aria-label="App 终端" options={['iOS', 'Android']} value={value.platforms} onChange={platforms => onChange({ ...value, platforms: platforms as Platform[] })} /></Form.Item>
    </div>
    <Form.Item label="App 版本条件" extra="各条条件同时满足（且）；版本按数值比较，例如 1.10.0 高于 1.9.0。移除全部条件表示不限版本。">
      <div className="ab-version-rows">{value.versions.map((c, i) => <div className="ab-version-row" key={i}>
        <span className="ab-condition-label">{i ? '且' : '版本'}</span>
        <Select aria-label={`版本运算符 ${i + 1}`} value={c.operator} options={versionOptions} onChange={operator => changeVersion(i, { operator: operator as VersionOperator })} style={{ width: 155 }} />
        <Input aria-label={`版本号 ${i + 1}`} placeholder="例如 1.8.0" value={c.value} onChange={e => changeVersion(i, { value: e.target.value.trim() })} style={{ width: 180 }} />
        <Button aria-label={`移除版本条件 ${i + 1}`} icon={<DeleteOutlined />} onClick={() => onChange({ ...value, versions: value.versions.filter((_, n) => n !== i) })} />
      </div>)}</div>
      {!value.versions.length && <Tag>全部 App 版本</Tag>}
      <Button type="dashed" icon={<PlusOutlined />} onClick={() => onChange({ ...value, versions: [...value.versions, { operator: '>=', value: '' }] })}>添加版本条件</Button>
    </Form.Item>
    <div className="ab-target-summary"><strong>范围预览</strong><span>{targetSummary(value)}</span></div>
  </Form>
}

const statusColor = (status: string) => ({ 草稿: 'default', 待开始: 'blue', 进行中: 'green', 已结束: 'default', 已关闭: 'default', 已发布: 'green', 历史版本: 'default' }[status] ?? 'default')
const onlineStatus = (x: OnlineConfig) => x.status === 'draft' ? '草稿' : x.status === 'published' ? '已发布' : '历史版本'

export default function AppABTest() {
  const [messageApi, messageHolder] = message.useMessage()
  const [modalApi, modalHolder] = Modal.useModal()
  const [store, setStore] = useState<ABStore>(loadStore)
  const [tab, setTab] = useState('online')
  const [editing, setEditing] = useState<Editing | null>(null)
  const [step, setStep] = useState(0)
  const [activeGroup, setActiveGroup] = useState('')
  const [dirty, setDirty] = useState(false)
  const [now, setNow] = useState(Date.now())
  const [basePicker, setBasePicker] = useState(false)
  const [baseId, setBaseId] = useState<string>()
  const [promotion, setPromotion] = useState<Experiment | null>(null)
  const [promotionGroup, setPromotionGroup] = useState<string>()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>()
  const loadedRaw = useRef(localStorage.getItem(STORAGE_KEY))
  const pageRef = useRef<HTMLDivElement>(null)
  const { isOperate } = usePerm()
  const canEdit = isOperate('appABTest')
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer) }, [])
  useEffect(() => { pageRef.current?.scrollIntoView({ block: 'start' }) }, [editing?.value.id, step])
  useEffect(() => {
    if (!dirty) return
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])

  const locked = !canEdit || Boolean(editing && editing.value.status !== 'draft')
  const experiment = editing?.kind === 'experiment' ? editing.value : null
  const online = editing?.kind === 'online' ? editing.value : null
  const currentVariant = experiment?.variants.find(v => v.id === activeGroup) ?? experiment?.variants[0]
  const liveOnline = store.online.filter(x => x.status === 'published')
  const errors = editing ? editing.kind === 'online' ? validateOnline(editing.value, store.online) : validateExperiment(editing.value, now) : []
  const activeStatus = editing ? editing.kind === 'online' ? onlineStatus(editing.value) : experimentState(editing.value, now) : ''
  const persist = (next: ABStore) => {
    if (!canEdit) throw new Error('当前角色仅可查看。')
    if (localStorage.getItem(STORAGE_KEY) !== loadedRaw.current) throw new Error('其他窗口已更新配置，请刷新后再操作，避免覆盖修改。')
    const raw = JSON.stringify(next)
    localStorage.setItem(STORAGE_KEY, raw)
    loadedRaw.current = raw
    setStore(next)
  }
  const open = (item: Editing, unsaved = false) => {
    setEditing(clone(item)); setDirty(unsaved); setStep(0)
    if (item.kind === 'experiment') setActiveGroup(item.value.variants[0]?.id ?? '')
  }
  const changeOnline = (patch: Partial<OnlineConfig>) => { if (online && !locked) { setEditing({ kind: 'online', value: { ...online, ...patch } }); setDirty(true) } }
  const changeExperiment = (patch: Partial<Experiment>) => { if (experiment && !locked) { setEditing({ kind: 'experiment', value: { ...experiment, ...patch } }); setDirty(true) } }
  const saveDraft = (): boolean => {
    if (!editing || locked) return false
    try {
      const item = { ...editing.value, updatedAt: new Date().toISOString() }
      const next = editing.kind === 'online' ? saveOnline(store, item as OnlineConfig) : saveExperiment(store, item as Experiment)
      persist(next); setEditing(editing.kind === 'online' ? { kind: 'online', value: item as OnlineConfig } : { kind: 'experiment', value: item as Experiment }); setDirty(false)
      messageApi.success('草稿已保存，尚未生效'); return true
    } catch (e) { messageApi.error((e as Error).message); return false }
  }
  const back = () => {
    if (!dirty) { setEditing(null); return }
    modalApi.confirm({ title: '还有未保存的修改', content: '返回列表前，将当前修改保存为草稿。', okText: '保存并返回', cancelText: '继续编辑', onOk: () => { if (saveDraft()) setEditing(null); else return Promise.reject(new Error('保存失败')) } })
  }
  const startExperiment = (base: OnlineConfig) => { setTab('experiment'); open({ kind: 'experiment', value: newExperiment(base) }, true); setBasePicker(false) }
  const copyExperiment = (exp: Experiment) => {
    const next: Experiment = { ...clone(exp), id: makeId(), name: `${exp.name}（副本）`, status: 'draft', startMode: 'now', startAt: '', endAt: new Date(Date.now() + 7 * 86400000).toISOString(), closedAt: undefined, updatedAt: new Date().toISOString(), variants: exp.variants.map(v => ({ ...clone(v), id: makeId() })) }
    open({ kind: 'experiment', value: next }, true)
  }
  const reviseOnline = (item: OnlineConfig) => open({ kind: 'online', value: { ...clone(item), id: makeId(), status: 'draft', replacesId: item.status === 'published' ? item.id : undefined, updatedAt: new Date().toISOString() } }, true)
  const close = (exp: Experiment) => modalApi.confirm({ title: `关闭实验「${exp.name}」？`, content: '配置与历史分组保留，关闭后不可恢复。产品规则：当前进行中的流程不切换配置，下次启动重新匹配。本原型仅演示状态变化。', okText: '关闭实验', okButtonProps: { danger: true }, cancelText: '取消', onOk: () => {
    try { const next = closeExperiment(store, exp.id); persist(next); const updated = next.experiments.find(x => x.id === exp.id)!; if (editing?.value.id === exp.id) setEditing({ kind: 'experiment', value: updated }); messageApi.success('实验已关闭（原型演示）') }
    catch (e) { messageApi.error((e as Error).message); return Promise.reject(e) }
  } })
  const publish = () => {
    if (!editing || locked) return
    if (errors.length) { setStep(2); messageApi.error('请先处理发布检查中的问题'); return }
    modalApi.confirm({ title: editing.kind === 'online' ? '发布此线上配置？' : '开启实验并冻结配置？', content: editing.kind === 'online' ? `适用范围：${targetSummary(editing.value.target)}。仅影响原型中的线上配置状态，不向真实 App 下发。` : '开启后，参与条件、流量、分组、时间、各组流程、页面和译文均锁定。若需调整，须复制为新实验。本操作仅演示，不产生真实分流。', okText: editing.kind === 'online' ? '确认发布' : '确认开启', cancelText: '返回检查', onOk: () => {
      try {
        const next = editing.kind === 'online' ? publishOnline(store, editing.value) : enableExperiment(store, editing.value)
        persist(next); setDirty(false)
        if (editing.kind === 'online') setEditing({ kind: 'online', value: next.online.find(x => x.id === editing.value.id)! })
        else setEditing({ kind: 'experiment', value: next.experiments.find(x => x.id === editing.value.id)! })
        messageApi.success(editing.kind === 'online' ? '线上配置已发布（原型演示）' : '实验已开启，配置已冻结（原型演示）')
      } catch (e) { messageApi.error((e as Error).message); return Promise.reject(e) }
    } })
  }
  const showPromotion = (exp: Experiment) => { setPromotion(exp); setPromotionGroup(exp.variants[0]?.id) }
  const createPromotion = () => {
    if (!promotion) return
    const group = promotion.variants.find(v => v.id === promotionGroup)
    if (!group) return
    const draft = promoteVariant(promotion, group)
    const base = liveOnline.find(x => x.id === promotion.base.id)
    draft.replacesId = base?.id
    setTab('online'); open({ kind: 'online', value: draft }, true); setPromotion(null)
  }
  const changeVariant = (id: string, patch: Partial<Variant>) => {
    if (!experiment) return
    changeExperiment({ variants: experiment.variants.map(v => v.id === id ? { ...v, ...patch } : patch.control ? { ...v, control: false } : v) })
  }

  const settings = editing && <div className="ab-settings-grid">
    <div className="ab-settings-main">
      <Card title={experiment ? '实验信息' : '线上配置信息'}>
        <Form layout="vertical" disabled={locked}>
          <Form.Item label={experiment ? '实验名称' : '配置名称'} htmlFor="ab-config-name" required><Input id="ab-config-name" placeholder={experiment ? '例如：沙特 Android 登录后置实验' : '例如：沙特 Android 首次使用方案'} value={editing.value.name} onChange={e => experiment ? changeExperiment({ name: e.target.value }) : changeOnline({ name: e.target.value })} /></Form.Item>
          {online && <Form.Item label="替换现有线上配置" extra="保存草稿不会影响当前线上版本；发布成功后才替换。未选择则作为独立投放，范围不得与其他生效配置重叠。"><Select aria-label="替换现有线上配置" allowClear value={online.replacesId} placeholder="不替换，新建独立投放" options={liveOnline.filter(x => x.id !== online.id).map(x => ({ value: x.id, label: `${x.name} · V${x.revision}` }))} onChange={replacesId => changeOnline({ replacesId })} /></Form.Item>}
          {experiment && <div className="ab-base-snapshot"><CopyOutlined /><div><strong>基准快照：{experiment.base.name} · V{experiment.base.revision}</strong><p>创建实验时复制；后续线上修改不会改变本实验。各组初始内容与基准一致。</p></div></div>}
          {online?.source && <Alert type="info" showIcon message={`来源：${online.source}。流程、页面与已填写译文已一并复制；请确认下方适用范围。`} />}
        </Form>
      </Card>
      <Card title={experiment ? '参与人群' : '适用范围'} extra={<Tag>线上与实验共用规则</Tag>}><TargetFields value={editing.value.target} disabled={locked} onChange={target => experiment ? changeExperiment({ target }) : changeOnline({ target })} /></Card>
      {experiment && <>
        <Card title="实验流量与分组">
          <Form layout="vertical" disabled={locked}><Form.Item label="实验流量" required extra="占符合参与条件用户的比例；其余用户不进入本场实验，不自动记为 A 组。"><InputNumber aria-label="实验流量" min={0} max={100} precision={2} value={experiment.traffic} onChange={value => changeExperiment({ traffic: value ?? 0 })} suffix="%" style={{ width: 190 }} /></Form.Item></Form>
          <div className="ab-group-heading"><strong>组内比例</strong><Tag color={weightTotal(experiment.variants) === 100 ? 'green' : 'error'}>合计 {weightTotal(experiment.variants)}% / 100%</Tag></div>
          <div className="ab-group-table"><div className="ab-group-row ab-group-labels"><span>分组名称</span><span>组内比例</span><span>对照组</span><span /></div>
            {experiment.variants.map((v, index) => <div className="ab-group-row" key={v.id}>
              <Input aria-label={`分组 ${index + 1} 名称`} value={v.name} disabled={locked} onChange={e => changeVariant(v.id, { name: e.target.value })} />
              <InputNumber aria-label={`分组 ${index + 1} 比例`} min={0} max={100} precision={2} value={v.weight} disabled={locked} onChange={weight => changeVariant(v.id, { weight: weight ?? 0 })} suffix="%" style={{ width: '100%' }} />
              <Radio aria-label={`设 ${v.name} 为对照组`} checked={v.control} disabled={locked} onChange={() => changeVariant(v.id, { control: true })}>对照组</Radio>
              <Button aria-label={`删除 ${v.name}`} icon={<DeleteOutlined />} disabled={locked || experiment.variants.length <= 2} onClick={() => { const variants = experiment.variants.filter(x => x.id !== v.id); if (v.control) variants[0] = { ...variants[0], control: true }; changeExperiment({ variants }) }} />
            </div>)}
          </div>
          <Button type="dashed" icon={<PlusOutlined />} disabled={locked} onClick={() => changeExperiment({ variants: [...experiment.variants, { id: makeId(), name: `分组 ${experiment.variants.length + 1}`, weight: 0, control: false, plan: clone(experiment.base.plan) }] })}>添加分组</Button>
          <Paragraph type="secondary" style={{ margin: '14px 0 0' }}>各组比例占本场实验流量，合计必须为 100%；恰好一个随机对照组。未入组的线上用户单列为观测人群。</Paragraph>
        </Card>
        <Card title="生效时间"><Form layout="vertical" disabled={locked}>
          <Form.Item label="开始方式"><Radio.Group value={experiment.startMode} onChange={e => changeExperiment({ startMode: e.target.value })}><Radio value="now">开启后立即开始</Radio><Radio value="scheduled">定时开始</Radio></Radio.Group></Form.Item>
          <div className="ab-two-fields">
            <Form.Item label="开始时间（UTC+8）" htmlFor="ab-start" required>{experiment.startMode === 'scheduled' ? <Input id="ab-start" type="datetime-local" value={toDateInput(experiment.startAt)} onChange={e => changeExperiment({ startAt: fromDateInput(e.target.value) })} /> : <Input id="ab-start" disabled value={experiment.startAt ? formatDate(experiment.startAt) : '点击“开启实验”时记录'} />}</Form.Item>
            <Form.Item label="结束时间（UTC+8）" htmlFor="ab-end" required><Input id="ab-end" type="datetime-local" value={toDateInput(experiment.endAt)} onChange={e => changeExperiment({ endAt: fromDateInput(e.target.value) })} /></Form.Item>
          </div><Text type="secondary">到期自动显示“已结束”。定时实验开启后即冻结全部配置；原型不运行真实 App 调度。</Text>
        </Form></Card>
      </>}
    </div>
    <div className="ab-settings-aside">
      <Card title={experiment ? '流量分配预览' : '谁会使用这套配置？'}>
        {experiment ? <><Text type="secondary">以 1,000 名符合条件的用户估算</Text><div className="ab-allocation-number">{Number((1000 * experiment.traffic / 100).toFixed(2)).toLocaleString()}<small>人进入本场实验</small></div>
          <div className="ab-allocation-bar">{experiment.variants.map((v, i) => <div key={v.id} style={{ width: `${Math.max(0, experiment.traffic * v.weight / 100)}%`, background: ['#3866ed', '#8c6de3', '#14a89d', '#efb544'][i % 4] }} title={v.name} />)}</div>
          {experiment.variants.map(v => <div className="ab-allocation-line" key={v.id}><span>{v.name || '未命名分组'}{v.control ? '（对照组）' : ''}</span><strong>约 {Number((1000 * experiment.traffic / 100 * v.weight / 100).toFixed(2))} 人</strong></div>)}
          <div className="ab-allocation-line"><span>不进入本场实验</span><strong>约 {Number((1000 * (1 - experiment.traffic / 100)).toFixed(2))} 人</strong></div>
          {weightTotal(experiment.variants) !== 100 && <Alert type="error" message="组内比例未满 100%，请调整后开启。" />}
          <Paragraph type="secondary" style={{ margin: '12px 0 0', fontSize: 12 }}>仅为比例估算，实际人数会有波动。未进入本场实验的用户仍可能命中其他有效实验。</Paragraph>
        </> : <Paragraph>未参加有效实验的用户，按国家、终端、版本匹配线上配置。线上用户用于观察整体表现，不是实验内随机分出的对照组。</Paragraph>}
      </Card>
      <Card title="操作顺序" size="small"><ol className="ab-instructions"><li>配置人群{experiment ? '、流量、分组与时间' : '与版本范围'}</li><li>编辑{experiment ? '各组的' : ''}流程、页面和译文</li><li>预览检查后{experiment ? '开启实验' : '发布线上配置'}</li></ol></Card>
      {experiment && <Alert type="warning" showIcon message="开启即冻结" description="参与条件、流量、组别、比例、时间、流程、页面和译文均不可修改；需要调整时复制新实验。" />}
    </div>
  </div>

  const planEditor = editing && <>
    {experiment && <Tabs activeKey={currentVariant?.id} onChange={setActiveGroup} items={experiment.variants.map(v => ({ key: v.id, label: <Space>{v.name || '未命名分组'}<Tag color={v.control ? 'blue' : 'purple'}>{v.control ? '对照组' : '实验组'}</Tag><Text type="secondary">{v.weight}%</Text></Space> }))} />}
    {online ? <ABPlanEditor platforms={online.target.platforms} key={online.id} plan={online.plan} readOnly={locked} onChange={plan => changeOnline({ plan })} /> : currentVariant && <ABPlanEditor platforms={experiment!.target.platforms} key={currentVariant.id} plan={currentVariant.plan} basePlan={experiment!.base.plan} readOnly={locked} onChange={plan => changeVariant(currentVariant.id, { plan })} />}
  </>

  return <div className="ab-page" ref={pageRef}>
    {messageHolder}{modalHolder}
    <div className="ab-heading"><div><Space><Title level={3} style={{ margin: 0 }}>APP A/B test配置</Title><Tag color="geekblue">六期</Tag><Tag>交互原型</Tag></Space><Paragraph type="secondary" style={{ margin: '10px 0 0' }}>配置适用人群，创建实验，再编排流程与页面</Paragraph></div>
      {editing && <Space wrap><Button icon={<ArrowLeftOutlined />} onClick={back}>返回列表</Button>{dirty && <Text type="warning">未保存</Text>}{!locked && <Button icon={<SaveOutlined />} onClick={saveDraft}>保存草稿</Button>}</Space>}
    </div>
    <Alert className="ab-prototype-note" type="info" showIcon message="本页为可交互配置原型：草稿、发布、实验开启与关闭均仅保存在当前浏览器，不向真实 App 下发，也不产生真实分流。" />
    {!editing ? <>
      <Tabs activeKey={tab} onChange={value => { setTab(value); setSearch(''); setStatusFilter(undefined) }} items={[{ key: 'online', label: '线上配置' }, { key: 'experiment', label: 'A/B 实验' }]} />
      <div className="ab-list-intro"><div><Title level={4}>{tab === 'online' ? '线上版本配置' : 'A/B 实验管理'}</Title><Text type="secondary">{tab === 'online' ? '维护未参加有效实验用户的默认体验，按国家、终端和 App 版本匹配。' : '从线上配置快照创建实验，独立设置人群、流量、分组和生效时间。'}</Text></div><Button type="primary" icon={<PlusOutlined />} disabled={!canEdit} onClick={() => { if (tab === 'online') open({ kind: 'online', value: newOnline() }, true); else { setBaseId(liveOnline[0]?.id); setBasePicker(true) } }}>{tab === 'online' ? '新建线上配置' : '新建实验'}</Button></div>
      <Card>
        <Space wrap className="ab-list-filters"><Input.Search aria-label="搜索配置名称" placeholder="搜索名称" allowClear value={search} onChange={e => setSearch(e.target.value)} style={{ width: 270 }} /><Select aria-label="筛选状态" placeholder="全部状态" allowClear value={statusFilter} onChange={setStatusFilter} options={(tab === 'online' ? ['草稿', '已发布', '历史版本'] : ['草稿', '待开始', '进行中', '已结束', '已关闭']).map(value => ({ value, label: value }))} style={{ width: 145 }} /><Text type="secondary">发布和开启均为原型演示</Text></Space>
        {tab === 'online' ? <Table rowKey="id" pagination={{ pageSize: 6, showSizeChanger: false }} scroll={{ x: 850 }} dataSource={store.online.filter(x => x.name.includes(search) && (!statusFilter || onlineStatus(x) === statusFilter))} columns={[
          { title: '配置名称', key: 'name', width: 220, render: (_, x) => <div><strong>{x.name || '未命名草稿'}</strong><div><Text type="secondary">{x.revision ? `V${x.revision}` : '待发布'}{x.source ? ` · 来源：${x.source}` : ''}</Text></div></div> },
          { title: '适用范围', key: 'target', render: (_, x) => <span className="ab-table-scope">{targetSummary(x.target)}</span> },
          { title: '状态', key: 'status', width: 100, render: (_, x) => <Tag color={statusColor(onlineStatus(x))}>{onlineStatus(x)}</Tag> },
          { title: '操作', key: 'actions', width: 270, render: (_, x) => <Space wrap><Button type="link" onClick={() => open({ kind: 'online', value: x })}>{x.status === 'draft' && canEdit ? '编辑草稿' : '查看 / 预览'}</Button>{x.status === 'published' && canEdit && <><Button type="link" onClick={() => reviseOnline(x)}>修改新版本</Button><Button type="link" onClick={() => startExperiment(x)}>创建实验</Button></>}</Space> },
        ]} /> : <Table rowKey="id" pagination={{ pageSize: 6, showSizeChanger: false }} scroll={{ x: 1000 }} locale={{ emptyText: <Empty description="还没有实验。先选择线上基准，再配置参与条件和实验分组。" /> }} dataSource={store.experiments.filter(x => x.name.includes(search) && (!statusFilter || experimentState(x, now) === statusFilter))} columns={[
          { title: '实验名称', width: 200, key: 'name', render: (_, x) => <div><strong>{x.name || '未命名实验'}</strong><div><Text type="secondary">{x.variants.length} 个分组 · 实验流量 {x.traffic}%</Text></div></div> },
          { title: '参与范围', key: 'target', render: (_, x) => <span className="ab-table-scope">{targetSummary(x.target)}</span> },
          { title: '生效时间（UTC+8）', key: 'time', width: 170, render: (_, x) => <Text type="secondary">{x.startMode === 'now' && !x.startAt ? '开启后立即开始' : formatDate(x.startAt)}<br />至 {formatDate(x.endAt)}</Text> },
          { title: '状态', key: 'status', width: 95, render: (_, x) => <Tag color={statusColor(experimentState(x, now))}>{experimentState(x, now)}</Tag> },
          { title: '操作', key: 'actions', width: 240, render: (_, x) => <Space wrap><Button type="link" onClick={() => open({ kind: 'experiment', value: x })}>{x.status === 'draft' && canEdit ? '编辑草稿' : '查看 / 预览'}</Button>{canEdit && <><Button type="link" onClick={() => copyExperiment(x)}>复制</Button>{x.status !== 'draft' && <Button type="link" onClick={() => showPromotion(x)}>实验组转线上</Button>}{['待开始', '进行中'].includes(experimentState(x, now)) && <Button type="link" danger onClick={() => close(x)}>关闭</Button>}</>}</Space> },
        ]} />}
      </Card>
    </> : <>
      <div className="ab-edit-meta"><Space wrap><strong>{editing.value.name || (experiment ? '新建实验' : '新建线上配置')}</strong><Tag color={statusColor(activeStatus)}>{activeStatus}</Tag>{editing.value.status !== 'draft' && <Tag>配置只读</Tag>}</Space><Space>{canEdit && experiment && experiment.status !== 'draft' && <><Button icon={<CopyOutlined />} onClick={() => copyExperiment(experiment)}>复制为新实验</Button><Button onClick={() => showPromotion(experiment)}>实验组转线上</Button>{['待开始', '进行中'].includes(activeStatus) && <Button danger onClick={() => close(experiment)}>关闭实验</Button>}</>}{canEdit && online?.status === 'published' && <Button icon={<CopyOutlined />} onClick={() => reviseOnline(online)}>修改新版本</Button>}</Space></div>
      {experiment?.status !== 'draft' && experiment && <Alert className="ab-freeze-note" type="warning" showIcon message="本实验配置已冻结" description="可以预览各组页面与译文；如需修改条件、流量、分组、时间或内容，请复制为新实验。关闭或结束后也不能恢复编辑。" />}
      <Steps current={step} onChange={setStep} className="ab-steps" items={[{ title: experiment ? '实验设置' : '适用范围' }, { title: experiment ? '分组方案' : '流程与页面' }, { title: experiment ? '检查并开启' : '检查并发布' }]} />
      {step === 0 ? settings : step === 1 ? planEditor : <>
        <Card title={locked ? '配置概览' : '发布前检查'} className="ab-review-card">
          <Descriptions column={2} size="small" bordered items={[
            { key: 'name', label: '名称', children: editing.value.name || '未填写' },
            { key: 'kind', label: '配置类型', children: experiment ? 'A/B 实验' : '线上配置（观测人群）' },
            { key: 'target', label: '适用范围', span: 2, children: targetSummary(editing.value.target) },
            ...(experiment ? [{ key: 'traffic', label: '实验流量', children: `${experiment.traffic}%` }, { key: 'variants', label: '分组', children: experiment.variants.map(v => `${v.name} ${v.weight}%${v.control ? '（对照）' : ''}`).join(' / ') }, { key: 'time', label: '时间（UTC+8）', span: 2, children: `${experiment.startMode === 'now' && !experiment.startAt ? '开启后立即开始' : formatDate(experiment.startAt)} 至 ${formatDate(experiment.endAt)}` }] : [{ key: 'replaces', label: '替换配置', span: 2, children: store.online.find(x => x.id === online?.replacesId)?.name ?? '新建独立投放' }]),
          ]} />
          {!locked && (errors.length ? <Alert type="error" showIcon message={`有 ${errors.length} 项需要处理`} description={<ul>{errors.map((error, index) => <li key={index}>{error}</li>)}</ul>} /> : <Alert type="success" showIcon icon={<CheckCircleOutlined />} message="人群、版本条件、比例和时间等本地校验已通过" description="仍需正式接口校验素材、商品、客户端兼容与实际投放冲突。当前操作只改变原型数据。" />)}
          <Paragraph type="secondary" style={{ margin: '16px 0 0' }}>已填写的基础文案和译文随方案一同保存{experiment ? '、冻结' : ''}。未填写的语言在本原型中回退基础中文；正式多语言发布与服务端校验尚未接入。</Paragraph>
        </Card>
        {planEditor}
      </>}
      <div className="ab-editor-actions"><Button disabled={step === 0} onClick={() => setStep(step - 1)}>上一步</Button><Space>{step < 2 ? <Button type="primary" icon={<ArrowRightOutlined />} onClick={() => setStep(step + 1)}>下一步：{step === 0 ? experiment ? '配置分组方案' : '配置流程与页面' : '预览与检查'}</Button> : !locked && <Button type="primary" onClick={publish}>{experiment ? '开启实验' : '发布线上配置'}</Button>}</Space></div>
    </>}
    <Modal title="新建实验：选择线上基准" open={basePicker} onCancel={() => setBasePicker(false)} okText="创建实验草稿" cancelText="取消" okButtonProps={{ disabled: !baseId }} onOk={() => { const base = liveOnline.find(x => x.id === baseId); if (base) startExperiment(base) }}>
      <Paragraph>各组会复制所选线上版本的流程、页面与已填写译文，之后可分别修改；不会跟随线上配置变化。</Paragraph>
      <Select aria-label="选择线上基准" value={baseId} onChange={setBaseId} style={{ width: '100%' }} options={liveOnline.map(x => ({ value: x.id, label: `${x.name} · V${x.revision}` }))} />
      {!liveOnline.length && <Alert style={{ marginTop: 12 }} type="warning" message="请先新建并发布一套线上配置，再创建实验。" />}
    </Modal>
    <Modal title="实验组转为线上配置" open={Boolean(promotion)} onCancel={() => setPromotion(null)} okText="生成线上草稿" cancelText="取消" onOk={createPromotion}>
      <Paragraph>选择需要沿用的组，复制该组的流程、页面和已填写译文。下一步确认国家、终端和版本范围，检查后发布。</Paragraph>
      <Select aria-label="转线上实验组" value={promotionGroup} onChange={setPromotionGroup} options={promotion?.variants.map(v => ({ value: v.id, label: `${v.name}${v.control ? '（对照组）' : ''}` }))} style={{ width: '100%' }} />
      <Alert style={{ marginTop: 16 }} type="info" showIcon message="原实验保持原状态" description="转线上只作用于所选范围内未参加有效实验的用户，不会自动结束原实验，也不会覆盖其他有效实验。" />
    </Modal>
  </div>
}
