import { useState } from 'react'
import { Alert, Button, Card, ColorPicker, DatePicker, Form, Input, InputNumber, Modal, Radio, Select, Space, Switch, Table, Tabs, Tag, Typography, Upload, message } from 'antd'
import { BellOutlined, MailOutlined, PlusOutlined, TagsOutlined, ThunderboltOutlined } from '@ant-design/icons'
import { usePerm } from '../perm'
import { useStore } from '../store'

const { Text, Paragraph } = Typography
type Rule = { field: string; operator: string; value: string; timeMode?: 'absolute' | 'relative' }
type UserTag = { id: string; name: string; businessLine: string[]; logic: '满足全部条件' | '满足任一条件'; rules: Rule[]; users: number }
type Template = { id: string; code: string; name: string; businessLine: string[]; channel: string; language: string; content: string; contentType: 'text' | 'rich'; tags: string[]; enabled: boolean; pushTarget?: string; pushUrl?: string }

const variables = ['用户名称']
const seedTags: UserTag[] = [
  { id: 'tag_new', name: '韩国新注册用户', businessLine: ['Dino English'], logic: '满足全部条件', rules: [{ field: '国家', operator: '等于', value: '韩国' }, { field: '注册时间', operator: '近', value: '7天' }], users: 328 },
  { id: 'tag_trial', name: '体验未完课用户', businessLine: ['Dino English'], logic: '满足全部条件', rules: [{ field: '用户状态', operator: '等于', value: '未付费-体验中' }], users: 146 },
]
const seedTemplates: Template[] = [
  { id: 'tpl_1', code: 'MSG0001', name: '体验课提醒', businessLine: ['Dino English'], channel: 'Push', language: 'English', content: 'Hi {{用户姓名}}，你的体验课已为你准备好，点击即可开始学习。', contentType: 'text', tags: ['体验未完课用户'], enabled: true, pushTarget: 'Dino' },
]

export default function LifecycleAutomation() {
  const { can } = usePerm()
  const channels = useStore((s) => s.channels)
  const editable = can('lifecycle') === 'operate'
  const [templates, setTemplates] = useState(seedTemplates)
  const [tags, setTags] = useState(seedTags)
  const [templateOpen, setTemplateOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null)
  const [tagOpen, setTagOpen] = useState(false)
  const [editingTag, setEditingTag] = useState<UserTag | null>(null)
  const [content, setContent] = useState('')
  const [contentType, setContentType] = useState<Template['contentType']>('text')
  const [imageUploadOpen, setImageUploadOpen] = useState(false)
  const [pendingImage, setPendingImage] = useState('')
  const [templateForm] = Form.useForm()
  const [tagForm] = Form.useForm()
  const businessLineOptions = channels.map((channel) => ({ value: channel.name }))

  const addVariable = (variable: string) => setContent((value) => `${value}${value ? ' ' : ''}{{${variable}}}`)
  const formatRichText = (command: string, value?: string) => document.execCommand(command, false, value)
  const selectLocalImage = (file: File) => {
    const reader = new FileReader()
    reader.onload = () => setPendingImage(String(reader.result))
    reader.readAsDataURL(file)
    return false
  }
  const insertLocalImage = () => {
    if (!pendingImage) return
    setContent((value) => `${value}${value ? '<br />' : ''}<img src="${pendingImage}" alt="上传图片" style="max-width:100%;height:auto;" />`)
    setPendingImage('')
    setImageUploadOpen(false)
    message.success('图片已插入消息内容')
  }
  const openTemplate = (template?: Template) => {
    setEditingTemplate(template ?? null)
    setContent(template?.content ?? '')
    setContentType(template?.contentType ?? 'text')
    templateForm.setFieldsValue(template ?? { businessLine: channels[0]?.name ? [channels[0].name] : [], channel: 'Push', language: 'English', enabled: true, tags: [], pushTarget: '不跳转' })
    setTemplateOpen(true)
  }
  const saveTemplate = async () => {
    const value = await templateForm.validateFields()
    setTemplates((items) => editingTemplate
      ? items.map((item) => item.id === editingTemplate.id ? { ...item, name: value.name, businessLine: value.businessLine, channel: value.channel, language: value.language, content, contentType, tags: value.tags || [], enabled: value.enabled ?? true, pushTarget: value.channel === 'Push' ? value.pushTarget : undefined, pushUrl: value.channel === 'Push' && value.pushTarget === 'H5页面' ? value.pushUrl : undefined } : item)
      : [{ id: `tpl_${Date.now()}`, code: `MSG${String(items.length + 1).padStart(4, '0')}`, name: value.name, businessLine: value.businessLine, channel: value.channel, language: value.language, content, contentType, tags: value.tags || [], enabled: value.enabled ?? true, pushTarget: value.channel === 'Push' ? value.pushTarget : undefined, pushUrl: value.channel === 'Push' && value.pushTarget === 'H5页面' ? value.pushUrl : undefined }, ...items])
    setTemplateOpen(false)
    setEditingTemplate(null)
    setContent('')
    templateForm.resetFields()
    message.success(editingTemplate ? '消息模板已更新' : '消息模板已保存')
  }
  const openTag = (tag?: UserTag) => {
    setEditingTag(tag ?? null)
    tagForm.setFieldsValue(tag ?? { businessLine: channels[0]?.name ? [channels[0].name] : [], logic: '满足全部条件', rules: [{ field: '用户类型', operator: '等于', value: '' }] })
    setTagOpen(true)
  }
  const saveTag = async () => {
    const value = await tagForm.validateFields()
    setTags((items) => editingTag
      ? items.map((item) => item.id === editingTag.id ? { ...item, name: value.name, businessLine: value.businessLine, logic: value.logic, rules: value.rules } : item)
      : [{ id: `tag_${Date.now()}`, name: value.name, businessLine: value.businessLine, logic: value.logic, rules: value.rules, users: 0 }, ...items])
    setTagOpen(false)
    setEditingTag(null)
    tagForm.resetFields()
    message.success(editingTag ? '用户标签已更新' : '用户标签已保存')
  }

  const templateColumns = [
    { title: '模板ID', dataIndex: 'code', render: (value: string) => <Text code>{value}</Text> },
    { title: '模板名称', dataIndex: 'name', render: (value: string) => <b>{value}</b> },
    { title: '业务线', dataIndex: 'businessLine', render: (value: string[]) => <Space wrap>{value.map((item) => <Tag color="blue" key={item}>{item}</Tag>)}</Space> },
    { title: '发送通道', dataIndex: 'channel', render: (value: string) => <Tag icon={value === 'Email' ? <MailOutlined /> : <BellOutlined />}>{value}</Tag> },
    { title: '语言', dataIndex: 'language', render: (value: string) => <Tag>{value}</Tag> },
    { title: '消息内容', dataIndex: 'content', width: 360, render: (value: string) => <div style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{value}</div> },
    { title: '用户标签', dataIndex: 'tags', render: (value: string[]) => <Space wrap>{value.map((item) => <Tag color="cyan" key={item}>{item}</Tag>)}</Space> },
    { title: '状态', dataIndex: 'enabled', render: (value: boolean) => <Tag color={value ? 'green' : 'default'}>{value ? '已启用' : '未启用'}</Tag> },
    ...(editable ? [{ title: '操作', render: (_: unknown, row: Template) => <Button type="link" size="small" onClick={() => openTemplate(row)}>编辑</Button> }] : []),
  ]
  const tagColumns = [
    { title: '标签名称', dataIndex: 'name', render: (value: string) => <b>{value}</b> },
    { title: '业务线', dataIndex: 'businessLine', render: (value: string[]) => <Space wrap>{value.map((item) => <Tag color="blue" key={item}>{item}</Tag>)}</Space> },
    { title: '组合逻辑', dataIndex: 'logic', render: (value: string) => <Tag color="blue">{value}</Tag> },
    { title: '条件', dataIndex: 'rules', render: (rules: Rule[]) => <Space wrap>{rules.map((rule, index) => <Tag key={index}>{`${rule.field} ${rule.operator} ${rule.value}`}</Tag>)}</Space> },
    { title: '预计用户数', dataIndex: 'users' },
    ...(editable ? [{ title: '操作', render: (_: unknown, row: UserTag) => <Button type="link" size="small" onClick={() => openTag(row)}>编辑</Button> }] : []),
  ]

  return <div>
    <Alert showIcon icon={<ThunderboltOutlined />} type="info" message={<><b>四期功能 · 消息中心</b>　配置消息内容，通过组合用户标签确定触达对象。</>} style={{ marginBottom: 16 }} />
    <div className="lifecycle-hero"><div><Text className="eyebrow">MESSAGE CENTER</Text><Typography.Title level={2} style={{ margin: '6px 0' }}>消息中心 <Tag color="cyan">四期</Tag></Typography.Title><Paragraph type="secondary">用预定义变量快速配置多渠道消息，并通过用户属性组合定义目标人群。</Paragraph></div></div>
    <Tabs className="lifecycle-tabs" items={[
      { key: 'templates', label: <><MailOutlined /> 消息模板</>, children: <Card title="消息模板" extra={editable && <Button type="primary" icon={<PlusOutlined />} onClick={() => openTemplate()}>新建模板</Button>}><Table rowKey="id" pagination={false} dataSource={templates} columns={templateColumns} /></Card> },
      { key: 'tags', label: <><TagsOutlined /> 用户标签</>, children: <Card title="组合用户标签" extra={editable && <Button type="primary" icon={<PlusOutlined />} onClick={() => openTag()}>新建标签</Button>}><Alert type="info" showIcon message="标签由用户属性组合而成；用户属性变化后会自动进入或离开标签。" style={{ marginBottom: 16 }} /><Table rowKey="id" pagination={false} dataSource={tags} columns={tagColumns} /></Card> },
    ]} />

    <Modal open={templateOpen} title={`${editingTemplate ? '编辑' : '新建'}消息模板 · 四期`} onCancel={() => { setTemplateOpen(false); setEditingTemplate(null) }} onOk={saveTemplate} okText="保存" destroyOnClose width={760}>
      <Form form={templateForm} layout="vertical">
        <Form.Item name="name" label="模板名称" rules={[{ required: true, message: '请输入模板名称' }]}><Input /></Form.Item>
        <Form.Item name="businessLine" label="业务线" rules={[{ required: true, message: '请选择业务线' }]}><Select mode="multiple" placeholder="请选择业务线" options={businessLineOptions} /></Form.Item>
        <Form.Item name="channel" label="发送通道" rules={[{ required: true }]}><Select disabled={!!editingTemplate} options={['Push', 'Email', '短信'].map((value) => ({ value }))} /></Form.Item>
        <Form.Item noStyle shouldUpdate={(previous, current) => previous.channel !== current.channel || previous.pushTarget !== current.pushTarget}>{({ getFieldValue }) => getFieldValue('channel') === 'Push' && <>
          <Form.Item name="pushTarget" label="点击 Push 后跳转" rules={[{ required: true, message: '请选择跳转页面' }]}><Select placeholder="请选择" options={['不跳转', 'Dino', 'Class', 'Explore', 'Play', 'H5页面'].map((value) => ({ value, label: value === 'H5页面' ? 'H5页面（需要填跳转地址）' : value }))} /></Form.Item>
          {getFieldValue('pushTarget') === 'H5页面' && <Form.Item name="pushUrl" label="H5 跳转地址" rules={[{ required: true, type: 'url', message: '请输入有效的 H5 链接' }]}><Input placeholder="https://example.com/page" /></Form.Item>}
        </>}</Form.Item>
        <Form.Item name="language" label="消息语言" rules={[{ required: true, message: '请选择消息语言' }]}><Select options={['English', '한국어', 'العربية', '简体中文'].map((value) => ({ value }))} /></Form.Item>
        <Form.Item label="消息内容" required>
          <Radio.Group value={contentType} onChange={(event) => setContentType(event.target.value)} optionType="button" options={[{ value: 'text', label: '纯文本' }, { value: 'rich', label: '富文本' }]} style={{ marginBottom: 10 }} />
          {contentType === 'text' ? <Input.TextArea value={content} onChange={(event) => setContent(event.target.value)} rows={5} maxLength={1000} placeholder="填写消息内容" /> : <div style={{ border: '1px solid #d9d9d9', borderRadius: 6 }}><div style={{ padding: '7px 8px', borderBottom: '1px solid #d9d9d9', background: '#fafafa' }}><Space size={2} wrap><Select size="small" defaultValue="3" style={{ width: 82 }} onChange={(value) => formatRichText('fontSize', value)} options={[['2', '12px'], ['3', '16px'], ['4', '18px'], ['5', '22px']].map(([value, label]) => ({ value, label }))} />{[['bold', 'B'], ['italic', 'I'], ['underline', 'U'], ['strikeThrough', 'S'], ['justifyLeft', '≡'], ['justifyCenter', '≣'], ['justifyRight', '☰'], ['insertUnorderedList', '• 列表'], ['insertOrderedList', '1. 列表']].map(([command, label]) => <Button key={command} size="small" type="text" onMouseDown={(event) => event.preventDefault()} onClick={() => formatRichText(command)} style={{ fontWeight: command === 'bold' ? 700 : undefined, fontStyle: command === 'italic' ? 'italic' : undefined }}>{label}</Button>)}<ColorPicker size="small" onChangeComplete={(color) => formatRichText('foreColor', color.toHexString())}><Button size="small" type="text" style={{ color: '#1677ff', textDecoration: 'underline' }}>A</Button></ColorPicker><Button size="small" onMouseDown={(event) => event.preventDefault()} onClick={() => formatRichText('createLink', window.prompt('输入链接地址') || '')}>链接</Button><Button size="small" onClick={() => { setPendingImage(''); setImageUploadOpen(true) }}>图片</Button></Space></div><div contentEditable suppressContentEditableWarning onInput={(event) => setContent(event.currentTarget.innerHTML)} dangerouslySetInnerHTML={{ __html: content }} style={{ minHeight: 220, padding: 12, outline: 'none' }} /></div>}
          <Text type="secondary">点击加入预定义变量：</Text><div style={{ marginTop: 8 }}><Space wrap>{variables.map((variable) => <Button size="small" key={variable} onClick={() => addVariable(variable)}>{`{{${variable}}}`}</Button>)}</Space></div>
        </Form.Item>
        <Form.Item name="tags" label="选择用户标签"><Select mode="multiple" options={tags.map((tag) => ({ value: tag.name }))} /></Form.Item>
        <Form.Item name="enabled" label="是否启用" valuePropName="checked"><Switch /></Form.Item>
      </Form>
    </Modal>

    <Modal open={imageUploadOpen} title="上传图片" width={420} destroyOnClose onCancel={() => { setPendingImage(''); setImageUploadOpen(false) }} footer={<Space><Button onClick={() => { setPendingImage(''); setImageUploadOpen(false) }}>取消</Button><Button type="primary" disabled={!pendingImage} onClick={insertLocalImage}>保存</Button></Space>}><Upload.Dragger accept="image/*" maxCount={1} multiple={false} showUploadList={false} beforeUpload={selectLocalImage} style={{ padding: '22px 12px' }}><p style={{ margin: '0 0 14px', color: '#667085' }}>将图片拖拽到此处</p><Button>浏览本地图片</Button></Upload.Dragger>{pendingImage && <img src={pendingImage} alt="上传预览" style={{ display: 'block', maxWidth: '100%', maxHeight: 180, margin: '16px auto 0' }} />}</Modal>

    <Modal open={tagOpen} title={`${editingTag ? '编辑' : '组合'}用户标签 · 四期`} onCancel={() => { setTagOpen(false); setEditingTag(null); tagForm.resetFields() }} onOk={saveTag} okText="保存" destroyOnClose width={820}>
      <Form form={tagForm} layout="vertical" initialValues={{ businessLine: channels[0]?.name ? [channels[0].name] : [], logic: '满足全部条件', rules: [{ field: '用户类型', operator: '等于', value: '' }] }}>
        <Form.Item name="name" label="标签名称" rules={[{ required: true, message: '请输入标签名称' }]}><Input placeholder="例如：韩国新注册用户" /></Form.Item>
        <Form.Item name="businessLine" label="业务线" rules={[{ required: true, message: '请选择业务线' }]}><Select mode="multiple" placeholder="请选择业务线" options={businessLineOptions} /></Form.Item>
        <Form.Item name="logic" label="条件组合"><Radio.Group options={['满足全部条件', '满足任一条件'].map((value) => ({ label: value, value }))} optionType="button" /></Form.Item>
        <Form.List name="rules">{(fields, { add, remove }) => <>{fields.map((field) => <Form.Item noStyle shouldUpdate key={field.key}>{() => {
          const kind = tagForm.getFieldValue(['rules', field.name, 'field'])
          const options: Record<string, string[]> = { '用户类型': ['测试用户', '正式用户'], '用户体验状态': ['未体验', '体验中', '已体验'], '用户付费状态': ['未付费', '已付费'], '用户订单状态': ['待支付', '已支付', '支付失败', '已取消订阅', '已退费'], '订阅类型': ['周', '月', '年'], '用户标签': tags.map((tag) => tag.name), '有效期状态': ['有效期内', '已过期'] }
          const relativeTimeRule = <><Form.Item name={[field.name, 'operator']} initialValue="等于" rules={[{ required: true }]}><Select style={{ width: 100 }} options={['大于', '等于', '小于'].map((value) => ({ value }))} /></Form.Item><Form.Item name={[field.name, 'value']} rules={[{ required: true }]}><InputNumber min={1} addonAfter="天" /></Form.Item></>
          const quantityRule = <><Form.Item name={[field.name, 'operator']} initialValue="等于" rules={[{ required: true }]}><Select style={{ width: 100 }} options={['大于', '等于', '小于'].map((value) => ({ value }))} /></Form.Item><Form.Item name={[field.name, 'value']} rules={[{ required: true }]}><InputNumber min={0} addonAfter="节" /></Form.Item></>
          return <Space align="baseline" style={{ display: 'flex', marginBottom: 8 }}><Form.Item name={[field.name, 'field']} rules={[{ required: true }]}><Select style={{ width: 170 }} options={['用户类型', '用户体验状态', '用户付费状态', '用户订单状态', '完课数量（正式课数量）', '订阅类型', '注册时间', '有效期状态', '有效期到期时间', '距离上次打开App的时间', '用户标签'].map((value) => ({ value }))} /></Form.Item>{kind === '注册时间' ? <><Form.Item name={[field.name, 'timeMode']} initialValue="absolute"><Select style={{ width: 120 }} options={[{ value: 'absolute', label: '绝对时间' }, { value: 'relative', label: '相对时间' }]} /></Form.Item><Form.Item shouldUpdate noStyle>{() => tagForm.getFieldValue(['rules', field.name, 'timeMode']) === 'relative' ? relativeTimeRule : <Form.Item name={[field.name, 'value']} rules={[{ required: true }]}><DatePicker.RangePicker /></Form.Item>}</Form.Item></> : kind === '有效期到期时间' || kind === '距离上次打开App的时间' ? relativeTimeRule : kind === '完课数量（正式课数量）' ? quantityRule : <><Form.Item name={[field.name, 'operator']} initialValue="等于"><Select style={{ width: 100 }} options={['等于', '不等于'].map((value) => ({ value }))} /></Form.Item><Form.Item name={[field.name, 'value']} rules={[{ required: true }]}><Select style={{ width: 180 }} options={(options[kind] || []).map((value) => ({ value }))} /></Form.Item></>}{fields.length > 1 && <Button type="link" danger onClick={() => remove(field.name)}>删除</Button>}</Space>
        }}</Form.Item>)}<Button type="dashed" onClick={() => add({ field: '用户类型', operator: '等于', value: '' })}>+ 添加条件</Button></>}</Form.List>
      </Form>
    </Modal>
  </div>
}
