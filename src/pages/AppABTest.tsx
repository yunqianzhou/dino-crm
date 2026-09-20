import { useEffect, useRef, useState } from 'react'
import { Alert, Button, Card, Form, Input, message, Modal, Segmented, Select, Space, Tag, Typography } from 'antd'
import { ArrowRightOutlined, CheckOutlined, EyeOutlined, MobileOutlined, SaveOutlined } from '@ant-design/icons'
import { usePerm } from '../perm'
import { LOGO } from '../logo'
import './AppABTest.css'

const { Title, Text, Paragraph } = Typography
const STORAGE_KEY = 'dinoai_app_ab_preview_v1'
const templates = [
  { id: 'register-first', name: '先注册，再体验', badge: '方案 01', desc: '先建立账号，再完成资料与课程体验。', nodes: ['auth', 'name', 'age', 'level', 'goal', 'teacher', 'lesson', 'report', 'plan', 'paywall', 'home'] },
  { id: 'experience-first', name: '先体验，支付后注册', badge: '方案 02', desc: '游客先体验课程，购买页结束后衔接注册。', nodes: ['value', 'name', 'age', 'level', 'goal', 'teacher', 'lesson', 'report', 'plan', 'paywall', 'auth', 'home'] },
  { id: 'double-paywall', name: '课前和课后各一次购买页', badge: '方案 03', desc: '两处购买页独立配置，点击购买时先登录。', nodes: ['value', 'name', 'age', 'level', 'goal', 'plan', 'paywall-before', 'teacher', 'lesson', 'report', 'paywall-after', 'auth', 'home'] },
]
const labels: Record<string, string> = { value: '首启价值页', auth: '注册登录', name: '孩子称呼', age: '孩子年龄', level: '英语水平', goal: '学习目标', teacher: '选老师', lesson: '体验课', report: '完课报告', plan: '学习计划', paywall: '主购买页', 'paywall-before': '课前购买页', 'paywall-after': '课后购买页', home: '首页' }
type Copy = { title: string; body: string; button: string; animation: 'static' | 'breathe' | 'shake' }
type Draft = { template: string; copy: Record<string, Copy> }
const defaults: Record<string, Omit<Copy, 'animation'>> = {
  value: { title: '让孩子自信开口说英语', body: '和 Dino 一起，在有趣的互动中开启英语学习之旅。', button: '我是新用户' },
  auth: { title: '开启孩子的英语成长之旅', body: '每一次开口，都是成长的一小步。', button: '继续注册 / 登录' },
  name: { title: '我们该怎么称呼你？', body: '告诉 Dino 你的名字，让我们成为朋友吧。', button: '继续' },
  age: { title: '孩子今年几岁？', body: '我们会推荐适合孩子年龄的学习内容。', button: '继续' },
  level: { title: '孩子的英语水平怎么样？', body: '选择最符合当前情况的一项。', button: '继续' },
  goal: { title: '你希望孩子收获什么？', body: '让每一次练习，都更接近学习目标。', button: '继续' },
  paywall: { title: '给孩子更多开口的机会', body: '开启专属英语学习旅程，让进步每天发生。', button: '开启学习之旅' },
}
const isPaywall = (node: string) => node.startsWith('paywall')
const editable = (node: string) => Boolean(defaults[isPaywall(node) ? 'paywall' : node])
function initialDraft(): Draft {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')
    if (templates.some(t => t.id === data?.template) && data.copy && typeof data.copy === 'object') {
      const copy: Record<string, Copy> = {}
      for (const [key, value] of Object.entries(data.copy)) {
        const c = value as Copy
        if (labels[key] && c && ['title', 'body', 'button'].every(k => typeof c[k as keyof Copy] === 'string') && ['static', 'breathe', 'shake'].includes(c.animation)) copy[key] = c
      }
      return { template: data.template, copy }
    }
  } catch { /* Start with the preview defaults when a stored draft is unavailable. */ }
  return { template: templates[0].id, copy: {} }
}

export default function AppABTest() {
  const [draft, setDraft] = useState<Draft>(initialDraft)
  const [node, setNode] = useState(() => (templates.find(t => t.id === draft.template) ?? templates[0]).nodes[0])
  const pageRef = useRef<HTMLDivElement>(null)
  useEffect(() => { pageRef.current?.scrollIntoView({ block: 'start' }) }, [])
  const [platform, setPlatform] = useState<string>('iOS')
  const [expanded, setExpanded] = useState(false)
  const [dirty, setDirty] = useState(false)
  const { isOperate } = usePerm()
  const canEdit = isOperate('appABTest')
  const template = templates.find(t => t.id === draft.template) ?? templates[0]
  const current = draft.copy[node] ?? { ...(defaults[isPaywall(node) ? 'paywall' : node] ?? { title: labels[node], body: '此模块沿用 App 现有业务能力。', button: '继续' }), animation: 'static' }
  const update = (patch: Partial<Copy>) => {
    setDraft(d => ({ ...d, copy: { ...d.copy, [node]: { ...current, ...patch } } }))
    setDirty(true)
  }
  const selectTemplate = (id: string) => {
    setDraft(d => ({ ...d, template: id }))
    setNode(templates.find(t => t.id === id)!.nodes[0])
    setDirty(true)
  }
  const save = () => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(draft)); setDirty(false); message.success('预览草稿已保存在当前浏览器') }
    catch { message.error('保存失败，请检查浏览器存储空间后重试') }
  }
  const phone = (
    <div className={`ab-phone ab-phone-${platform.toLowerCase()}`}>
      <div className="ab-phone-status"><span>9:41</span><span>{platform} · ▰</span></div>
      <div className="ab-phone-brand"><img src={LOGO} alt="Dino AI" /> Dino AI</div>
      <div className="ab-phone-content">
        <div className="ab-art"><img src={LOGO} alt="Dino" /><span>LET’S GROW TOGETHER</span></div>
        <h2>{current.title}</h2><p>{current.body}</p>
        {node === 'name' && <div className="ab-example-input">孩子的名字</div>}
        {['age', 'level', 'goal'].includes(node) && <div className="ab-options">{(node === 'age' ? ['年龄选项一', '年龄选项二', '年龄选项三'] : node === 'level' ? ['水平选项一', '水平选项二', '水平选项三'] : ['学习目标一', '学习目标二', '学习目标三']).map(label => <div key={label}>{label}<span>○</span></div>)}</div>}
        {isPaywall(node) && <div className="ab-product"><small>商品卡片示意</small><strong>英语学习会员</strong><span>价格与周期以商店返回为准</span></div>}
        {!editable(node) && <div className="ab-native-note">{labels[node]}由 App 提供<br />当前展示流程节点示意</div>}
      </div>
      <div className="ab-phone-bottom"><div className={`ab-preview-button ab-animation-${current.animation}`}>{current.button}</div>{node === 'value' && <div className="ab-secondary">已有账号？登录</div>}<small>内容示意 · 非 App 实际运行画面</small></div>
      <div className="ab-home-indicator" />
    </div>
  )
  return (
    <div className="ab-page" ref={pageRef}>
      <div className="ab-heading"><div><Space><Title level={3} style={{ margin: 0 }}>APP A/B test配置</Title><Tag color="geekblue">六期</Tag><Tag>交互原型</Tag></Space><Paragraph type="secondary" style={{ margin: '10px 0 0' }}>首次使用链路与页面配置 · 选择流程，编辑内容，实时预览</Paragraph></div><Space><Text type="secondary">{dirty ? '有未保存的修改' : '浏览器预览草稿'}</Text><Button icon={<EyeOutlined />} onClick={() => setExpanded(true)}>放大预览</Button><Button type="primary" icon={<SaveOutlined />} onClick={save} disabled={!canEdit}>保存预览草稿</Button></Space></div>
      <Alert type="info" showIcon message="当前支持流程选择、文案与按钮动效预览。草稿仅保存在当前浏览器，尚未接入线上发布、实验分流及 App 下发。" />
      <section className="ab-section"><div className="ab-section-title"><h3>选择流程模板</h3><Text type="secondary">三套首期方案</Text></div><div className="ab-template-grid">{templates.map(t => <button key={t.id} className={`ab-template ${t.id === draft.template ? 'is-active' : ''}`} onClick={() => selectTemplate(t.id)}><div><span>{t.badge}</span>{t.id === draft.template && <CheckOutlined />}</div><h3>{t.name}</h3><p>{t.desc}</p></button>)}</div></section>
      <Card className="ab-flow-card" size="small" title="流程预览" extra={<Text type="secondary">点击节点查看页面</Text>}><div className="ab-flow">{template.nodes.map((key, i) => <div className="ab-flow-item" key={key}><button className={node === key ? 'selected' : ''} onClick={() => setNode(key)}><span>{String(i + 1).padStart(2, '0')}</span>{labels[key]}{editable(key) && <i />}</button>{i < template.nodes.length - 1 && <ArrowRightOutlined />}</div>)}</div><div className="ab-flow-note">流程为评审示意，完整分支与最终顺序待协议确认。已完成步骤按业务状态跳过；购买页退出须完成现有挽留处理。{draft.template === 'double-paywall' && ' 点击购买时先登录，完成后回到原购买位置；课前与课后内容分别编辑。'}</div></Card>
      <div className="ab-editor-grid">
        <Card title={<Space><span>{labels[node]}</span><Tag color={editable(node) ? 'blue' : 'default'}>{editable(node) ? '内容预览' : '固定业务模块'}</Tag></Space>} className="ab-fields">
          {editable(node) ? <><Paragraph type="secondary">修改左侧内容，右侧同步更新。当前预览文案为示例，可用于评审配置方式。</Paragraph><Form layout="vertical" disabled={!canEdit}><Form.Item label="标题"><Input value={current.title} onChange={e => update({ title: e.target.value })} /></Form.Item><Form.Item label="说明文案"><Input.TextArea rows={3} value={current.body} onChange={e => update({ body: e.target.value })} /></Form.Item><Form.Item label="按钮文案"><Input value={current.button} onChange={e => update({ button: e.target.value })} /></Form.Item><Form.Item label="按钮动效"><Select value={current.animation} onChange={animation => update({ animation })} options={[{ value: 'static', label: '静态' }, { value: 'breathe', label: '呼吸动效' }, { value: 'shake', label: '抖动动效' }]} /></Form.Item></Form><Alert type="info" message={isPaywall(node) ? '本次仅预览宣传文案与动效。商品选择、Promo 场景、多语言及发布校验将在完整配置功能中接入。' : '品牌、页面布局和业务选项保持 App 既有规则。图片与多语言配置将在完整配置功能中接入。'} /></> : <div className="ab-fixed"><MobileOutlined /><Title level={4}>{labels[node]}</Title><Paragraph type="secondary">该节点沿用 App 既有页面和业务规则，当前可在流程中预览位置。选择首启价值页、注册登录、资料填写或购买页，可体验内容编辑。</Paragraph></div>}
        </Card>
        <div className="ab-preview-panel"><div className="ab-preview-toolbar"><Space><MobileOutlined /><strong>手机预览</strong></Space><Segmented value={platform} onChange={v => setPlatform(String(v))} options={['iOS', 'Android']} /></div>{phone}<Text type="secondary">预览仅展示文案及动效，不模拟真实注册或支付</Text></div>
      </div>
      <Modal title={`${labels[node]} · ${platform} 预览`} open={expanded} onCancel={() => setExpanded(false)} footer={null} width={440}><div className="ab-expanded">{phone}</div></Modal>
    </div>
  )
}
