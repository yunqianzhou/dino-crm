import { useState } from 'react'
import { Alert, Button, Card, Form, Input, Modal, Segmented, Select, Space, Tag, Typography } from 'antd'
import { ArrowRightOutlined, CheckOutlined, EyeOutlined, MobileOutlined } from '@ant-design/icons'
import { LOGO } from '../logo'
import { templates, labels, languages, isPaywall, isEditableNode, newPlan } from '../abTestConfig'
import type { Plan, PageCopy, Platform } from '../abTestConfig'
const { Text, Title, Paragraph } = Typography

export default function ABPlanEditor({ plan, onChange, readOnly = false, basePlan, platforms = ['iOS', 'Android'] }: { plan: Plan; onChange: (plan: Plan) => void; readOnly?: boolean; basePlan?: Plan; platforms: Platform[] }) {
  const [node, setNode] = useState(() => (templates.find(t => t.id === plan.template) ?? templates[0]).nodes[0])
  const [platform, setPlatform] = useState(platforms[0] ?? 'iOS')
  const [language, setLanguage] = useState('zh')
  const [expanded, setExpanded] = useState(false)
  const template = templates.find(t => t.id === plan.template) ?? templates[0]
  const current: PageCopy = (language === 'zh' ? plan.copy[node] : plan.translations[language]?.[node]) ?? plan.copy[node] ?? newPlan().copy[node] ?? { title: labels[node], body: '此模块沿用 App 现有业务能力。', button: '继续', animation: 'static' }
  const translated = language === 'zh' || Boolean(plan.translations[language]?.[node])
  const update = (patch: Partial<PageCopy>) => {
    if (readOnly) return
    const copy = { ...current, ...patch }
    onChange(language === 'zh' ? { ...plan, copy: { ...plan.copy, [node]: copy } } : { ...plan, translations: { ...plan.translations, [language]: { ...plan.translations[language], [node]: copy } } })
  }
  const selectTemplate = (id: string) => {
    if (readOnly) return
    onChange({ ...plan, template: id })
    setNode(templates.find(t => t.id === id)!.nodes[0])
  }
  const phone = (
    <div className={`ab-phone ab-phone-${platform.toLowerCase()}`}>
      <div className="ab-phone-status"><span>9:41</span><span>{platform} · ▰</span></div>
      <div className="ab-phone-brand"><img src={LOGO} alt="Dino AI" /> Dino AI</div>
      <div className="ab-phone-content" dir={language === 'ar' ? 'rtl' : 'ltr'}>
        <div className="ab-art"><img src={LOGO} alt="Dino" /><span>LET’S GROW TOGETHER</span></div>
        <h2>{current.title}</h2><p>{current.body}</p>
        {node === 'name' && <div className="ab-example-input">孩子的名字</div>}
        {['age', 'level', 'goal'].includes(node) && <div className="ab-options">{(node === 'age' ? ['年龄选项一', '年龄选项二', '年龄选项三'] : node === 'level' ? ['水平选项一', '水平选项二', '水平选项三'] : ['学习目标一', '学习目标二', '学习目标三']).map(label => <div key={label}>{label}<span>○</span></div>)}</div>}
        {isPaywall(node) && <div className="ab-product"><small>商品卡片示意</small><strong>英语学习会员</strong><span>价格与周期以商店返回为准</span></div>}
        {!isEditableNode(node) && <div className="ab-native-note">{labels[node]}由 App 提供<br />当前展示流程节点示意</div>}
      </div>
      <div className="ab-phone-bottom"><div className={`ab-preview-button ab-animation-${current.animation}`}>{current.button}</div>{node === 'value' && <div className="ab-secondary">已有账号？登录</div>}<small>内容示意 · 非 App 实际运行画面</small></div>
      <div className="ab-home-indicator" />
    </div>
  )
  return <div className="ab-plan-editor">
    <div className="ab-plan-toolbar"><Space wrap><strong>流程与页面</strong>{readOnly && <Tag>只读预览</Tag>}{basePlan && <Tag color={JSON.stringify(basePlan) === JSON.stringify(plan) ? 'default' : 'blue'}>{JSON.stringify(basePlan) === JSON.stringify(plan) ? '与基准快照一致' : '已独立修改'}</Tag>}</Space><Space><Select aria-label="预览语言" value={language} onChange={setLanguage} options={languages} style={{ width: 185 }} /><Button icon={<EyeOutlined />} onClick={() => setExpanded(true)}>放大预览</Button></Space></div>
    {!translated && isEditableNode(node) && <Alert type="info" message="该页尚未填写此语言译文，暂用基础中文预览。编辑后将作为本方案的独立译文保存。" />}
      <section className="ab-section"><div className="ab-section-title"><h3>选择流程模板</h3><Text type="secondary">三套首期方案</Text></div><div className="ab-template-grid">{templates.map(t => <button disabled={readOnly} aria-pressed={t.id === plan.template} key={t.id} className={`ab-template ${t.id === plan.template ? 'is-active' : ''}`} onClick={() => selectTemplate(t.id)}><div><span>{t.badge}</span>{t.id === plan.template && <CheckOutlined />}</div><h3>{t.name}</h3><p>{t.desc}</p></button>)}</div></section>
      <Card className="ab-flow-card" size="small" title="流程预览" extra={<Text type="secondary">点击节点查看页面</Text>}><div className="ab-flow">{template.nodes.map((key, i) => <div className="ab-flow-item" key={key}><button className={node === key ? 'selected' : ''} onClick={() => setNode(key)}><span>{String(i + 1).padStart(2, '0')}</span>{labels[key]}{isEditableNode(key) && <i />}</button>{i < template.nodes.length - 1 && <ArrowRightOutlined />}</div>)}</div><div className="ab-flow-note">流程为评审示意，完整分支与最终顺序待协议确认。已完成步骤按业务状态跳过；购买页退出须完成现有挽留处理。{plan.template === 'double-paywall' && ' 点击购买时先登录，完成后回到原购买位置；课前与课后内容分别编辑。'}</div></Card>
      <div className="ab-editor-grid">
        <Card title={<Space><span>{labels[node]}</span><Tag color={isEditableNode(node) ? 'blue' : 'default'}>{isEditableNode(node) ? '内容预览' : '固定业务模块'}</Tag></Space>} className="ab-fields">
          {isEditableNode(node) ? <><Paragraph type="secondary">文案与动效实时预览；每个实验组独立保存，未修改内容保留基准快照。</Paragraph><Form layout="vertical" disabled={readOnly}><Form.Item label="标题" htmlFor="ab-title"><Input id="ab-title" value={current.title} onChange={e => update({ title: e.target.value })} /></Form.Item><Form.Item label="说明文案" htmlFor="ab-body"><Input.TextArea id="ab-body" rows={3} value={current.body} onChange={e => update({ body: e.target.value })} /></Form.Item><Form.Item label="按钮文案" htmlFor="ab-button"><Input id="ab-button" value={current.button} onChange={e => update({ button: e.target.value })} /></Form.Item><Form.Item label="按钮动效" htmlFor="ab-animation"><Select id="ab-animation" value={current.animation} onChange={animation => update({ animation })} options={[{ value: 'static', label: '静态' }, { value: 'breathe', label: '呼吸动效' }, { value: 'shake', label: '抖动动效' }]} /></Form.Item></Form><Alert type="info" message={isPaywall(node) ? '商品选择与 Promo 场景尚未接入，本预览不模拟真实交易。' : '品牌、页面布局和业务选项保持 App 既有规则。素材上传暂未接入。'} /></> : <div className="ab-fixed"><MobileOutlined /><Title level={4}>{labels[node]}</Title><Paragraph type="secondary">该节点沿用 App 既有页面和业务规则，当前可在流程中预览位置。选择首启价值页、注册登录、资料填写或购买页，可体验内容编辑。</Paragraph></div>}
        </Card>
        <div className="ab-preview-panel"><div className="ab-preview-toolbar"><Space><MobileOutlined /><strong>手机预览</strong></Space><Segmented value={platform} onChange={v => setPlatform(v as Platform)} options={platforms.length ? platforms : ['iOS', 'Android']} /></div>{phone}<Text type="secondary">预览仅展示文案及动效，不模拟真实注册或支付</Text></div>
      </div>

    <Modal title={labels[node] + ' · ' + platform + ' 预览'} open={expanded} onCancel={() => setExpanded(false)} footer={null} width={440}><div className="ab-expanded">{phone}</div></Modal>
  </div>
}
