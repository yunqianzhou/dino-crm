import { useMemo, useState } from 'react'
import {
  Alert,
  Button,
  Card,
  DatePicker,
  Divider,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
  message,
} from 'antd'

const { RangePicker } = DatePicker
import { CopyOutlined, EditOutlined, LinkOutlined, ThunderboltOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { setState, uid, useStore } from '../store'
import { BUSINESS_LINES } from '../types'
import type { ChannelLevelNode, ChannelLine, ChannelParams, LandingPage } from '../types'
import { useI18n } from '../i18n'
import { usePerm } from '../perm'
import { useLineScope } from '../useLineScope'
import LineFilter from '../components/LineFilter'

const { Text, Paragraph } = Typography

// 渠道配置的参数拼成查询串（带入落地页链接）
function paramSuffix(params?: ChannelParams): string {
  if (!params) return ''
  let s = ''
  if (params.mediaSource) s += `&media_source=${encodeURIComponent(params.mediaSource)}`
  if (params.afChannel) s += `&af_channel=${encodeURIComponent(params.afChannel)}`
  if (params.campaign) s += `&campaign=${encodeURIComponent(params.campaign)}`
  if (params.campaignId) s += `&campaign_id=${encodeURIComponent(params.campaignId)}`
  if (params.param1) s += `&p1=${encodeURIComponent(params.param1)}`
  if (params.param2) s += `&p2=${encodeURIComponent(params.param2)}`
  return s
}

// 各业务线的落地页模版（关联渠道 / 商品包 / 优惠码 / 渠道参数）
const LANDING_TEMPLATES: Record<
  string,
  (p: { channel: string; packageId?: string; coupon?: string; params?: string }) => string
> = {
  韩国: ({ channel, packageId, coupon, params }) => {
    const inner =
      `/website/payment/sku/?id=${packageId ?? ''}&channel=${channel}` +
      (coupon ? `&coupon=${coupon}` : '') +
      (params ?? '')
    return `https://kr.dinoai.ai/website/signin/?backurl=${encodeURIComponent(inner)}`
  },
  越南: ({ channel, coupon, params }) =>
    `https://vn.dinoai.ai/website/landingpage/signin/?channel=${channel}` +
    (coupon ? `&coupon=${coupon}` : '') +
    (params ?? ''),
  印尼: ({ channel, coupon, params }) =>
    `https://in.dinoai.ai/website/landingpage/signin/?channel=${channel}` +
    (coupon ? `&coupon=${coupon}` : '') +
    (params ?? ''),
  马来西亚: ({ channel, coupon, params }) =>
    `https://ma.dinoai.ai/website/landingpage/signin/?channel=${channel}` +
    (coupon ? `&coupon=${coupon}` : '') +
    (params ?? ''),
  马来: ({ channel, coupon, params }) =>
    `https://ma.dinoai.ai/website/landingpage/signin/?channel=${channel}` +
    (coupon ? `&coupon=${coupon}` : '') +
    (params ?? ''),
  泰国: ({ channel, coupon, params }) =>
    `https://th.dinoai.ai/website/landingpage/signin/?channel=${channel}` +
    (coupon ? `&coupon=${coupon}` : '') +
    (params ?? ''),
  新加坡: ({ channel, coupon, params }) =>
    `https://sg.dinoai.ai/website/landingpage/signin/?channel=${channel}` +
    (coupon ? `&coupon=${coupon}` : '') +
    (params ?? ''),
  其他: ({ channel, coupon, params }) =>
    `https://www.dinoai.ai/website/landingpage/signin/?channel=${channel}` +
    (coupon ? `&coupon=${coupon}` : '') +
    (params ?? ''),
}

// 收集某业务线下所有「已生成 code」的渠道（带层级路径 + 渠道参数）
function collectCodes(line: ChannelLine): { code: string; path: string; params?: ChannelParams }[] {
  const res: { code: string; path: string; params?: ChannelParams }[] = []
  for (const tp of line.children) {
    if (tp.code) res.push({ code: tp.code, path: tp.name, params: tp.params })
    const walk = (nodes: ChannelLevelNode[], names: string[]) => {
      for (const n of nodes) {
        const path = [tp.name, ...names, n.name].join(' / ')
        if (n.code) res.push({ code: n.code, path, params: n.params })
        walk(n.children, [...names, n.name])
      }
    }
    walk(tp.children, [])
  }
  return res
}

function copy(text: string, ok: string) {
  navigator.clipboard?.writeText(text)
  message.success(ok)
}

export default function LandingPageManagement() {
  const { t } = useI18n()
  const { can, actor } = usePerm()
  const canCreate = can('landing_create') === 'operate'
  const canEdit = can('landing_edit') === 'operate' || canCreate
  const { selected: lineSel, setSelected: setLineSel, matchLine, disabled: lineDisabled, filterOptions } = useLineScope()
  const channels = useStore((s) => s.channels)
  const packages = useStore((s) => s.packages)
  const coupons = useStore((s) => s.coupons)
  const landingPagesAll = useStore((s) => s.landingPages)
  const landingPages = useMemo(
    () => landingPagesAll.filter((lp) => matchLine(lp.businessLine)),
    [landingPagesAll, lineSel, matchLine],
  )

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<LandingPage | null>(null)
  const [form] = Form.useForm()
  const [preview, setPreview] = useState<string | null>(null)
  const line = Form.useWatch('businessLine', form) as string | undefined
  const couponId = Form.useWatch('couponId', form) as string | undefined
  const channelCode = Form.useWatch('channelCode', form) as string | undefined

  // 生成弹窗里可选业务线 + 列表筛选选项
  const lines = BUSINESS_LINES
  const lineOptions = useMemo(
    () => Array.from(new Set([...lines, ...landingPagesAll.map((lp) => lp.businessLine)].filter(Boolean))),
    [lines, landingPagesAll],
  )
  const codeOptions = useMemo(() => {
    const c = channels.find((x) => x.name === line)
    return c ? collectCodes(c) : []
  }, [channels, line])
  const pkgOptions = useMemo(() => packages.filter((p) => p.businessLine === line), [packages, line])
  const couponOptions = useMemo(() => coupons.filter((c) => c.businessLine === line), [coupons, line])
  const codeOfCoupon = useMemo(
    () => coupons.find((c) => c.id === couponId)?.codes ?? [],
    [coupons, couponId],
  )
  const selectedChannel = useMemo(
    () => codeOptions.find((c) => c.code === channelCode),
    [codeOptions, channelCode],
  )
  const channelParams = selectedChannel?.params
  const hasChannelParams = !!(channelParams?.mediaSource || channelParams?.afChannel || channelParams?.campaign || channelParams?.campaignId || channelParams?.param1 || channelParams?.param2)

  const hasTemplate = !!line && !!LANDING_TEMPLATES[line]

  const onLineChange = () => {
    form.setFieldsValue({ channelCode: undefined, skuIds: undefined })
    setPreview(null)
  }

  const buildUrl = (): string | null => {
    const v = form.getFieldsValue()
    if (!v.businessLine || !LANDING_TEMPLATES[v.businessLine]) return null
    if (!v.channelCode) return null
    const ch = codeOptions.find((c) => c.code === v.channelCode)
    const skuIds: string[] = v.skuIds ?? []
    return LANDING_TEMPLATES[v.businessLine]({
      channel: v.channelCode,
      packageId: skuIds.join(','),
      params: paramSuffix(ch?.params),
    })
  }

  const doPreview = async () => {
    await form.validateFields(['businessLine', 'channelCode'])
    const url = buildUrl()
    setPreview(url)
  }

  const openModal = () => {
    form.resetFields()
    setPreview(null)
    setEditing(null)
    setOpen(true)
  }

  const openEdit = (lp: LandingPage) => {
    form.setFieldsValue({
      name: lp.name,
      businessLine: lp.businessLine,
      channelCode: lp.channelCode,
      skuIds: lp.skuIds?.length ? lp.skuIds : lp.packageIds ?? [],
    })
    setPreview(lp.url)
    setEditing(lp)
    setOpen(true)
  }

  const submit = async () => {
    const v = await form.validateFields()
    if (landingPagesAll.some((item) => item.channelCode === v.channelCode && item.id !== editing?.id)) {
      message.error('该渠道码已关联落地页；每个渠道只能配置一个落地页。')
      return
    }
    const url = buildUrl()
    if (!url) {
      message.error(t('lp.noTemplate'))
      return
    }
    const ch = codeOptions.find((c) => c.code === v.channelCode)
    const skuIds: string[] = v.skuIds ?? []
    const skuNames = skuIds.map((id) => packages.find((item) => item.id === id)?.name ?? id)
    const values = {
      name: v.name?.trim(),
      businessLine: v.businessLine,
      channelCode: v.channelCode,
      channelName: ch?.path,
      mediaSource: ch?.params?.mediaSource,
      afChannel: ch?.params?.afChannel,
      campaign: ch?.params?.campaign,
      campaignId: ch?.params?.campaignId,
      param1: ch?.params?.param1 || undefined,
      param2: ch?.params?.param2 || undefined,
      skuIds,
      skuNames,
      packageIds: skuIds,
      packageNames: skuNames,
      packageId: skuIds[0],
      packageName: skuNames[0],
      url,
    }
    if (editing) {
      setState((prev) => ({
        ...prev,
        landingPages: prev.landingPages.map((item) => item.id === editing.id ? { ...item, ...values } : item),
      }))
      message.success('落地页已更新')
    } else {
      const lp: LandingPage = {
        id: uid('lp_'),
        ...values,
        creator: actor,
        createdAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
      }
      setState((prev) => ({ ...prev, landingPages: [lp, ...prev.landingPages] }))
      message.success(t('lp.genOk'))
    }
    setOpen(false)
    setEditing(null)
  }

  const columns: ColumnsType<LandingPage> = [
    {
      title: t('lp.col.name'),
      dataIndex: 'name',
      width: 160,
      fixed: 'left',
      render: (v: string | undefined) => (v ? <Text strong>{v}</Text> : <Text type="secondary">—</Text>),
    },
    { title: t('lp.col.line'), dataIndex: 'businessLine', width: 90, render: (v) => <Tag color="magenta">{v}</Tag> },
    {
      title: t('lp.col.channel'),
      dataIndex: 'channelName',
      width: 220,
      render: (v, r) => (
        <span>
          {v || '—'}
          <br />
          <Text code style={{ fontSize: 12 }}>{r.channelCode}</Text>
          {(r.mediaSource || r.afChannel || r.campaign || r.campaignId || r.param1 || r.param2) && (
            <div style={{ marginTop: 4 }}>
              {r.mediaSource && <Tag color="blue" style={{ marginInlineEnd: 4 }}>media_source: {r.mediaSource}</Tag>}
              {r.afChannel && <Tag color="cyan">af_channel: {r.afChannel}</Tag>}
              {r.campaign && <Tag color="purple">campaign: {r.campaign}</Tag>}
              {r.campaignId && <Tag color="gold">campaign_id: {r.campaignId}</Tag>}
            </div>
          )}
        </span>
      ),
    },
    {
      title: '关联 SKU',
      dataIndex: 'skuNames',
      width: 200,
      render: (_: unknown, record: LandingPage) => {
        const names = record.skuNames?.length ? record.skuNames : record.packageNames ?? []
        return names.length ? <Space wrap>{names.map((name) => <Tag color="geekblue" key={name}>{name}</Tag>)}</Space> : <Text type="secondary">—</Text>
      },
    },
    {
      title: t('lp.col.url'),
      dataIndex: 'url',
      render: (v: string) => (
        <Space>
          <Text style={{ maxWidth: 320, display: 'inline-block', wordBreak: 'break-all' }}>{v}</Text>
          <Tooltip title={t('common.copy')}>
            <Button size="small" type="text" icon={<CopyOutlined />} onClick={() => copy(v, t('common.copied'))} />
          </Tooltip>
          <Tooltip title={t('lp.openLink')}>
            <Button size="small" type="text" icon={<LinkOutlined />} href={v} target="_blank" />
          </Tooltip>
        </Space>
      ),
    },
    { title: t('lp.col.creator'), dataIndex: 'creator', width: 170 },
    { title: t('lp.col.createTime'), dataIndex: 'createdAt', width: 170 },
    ...(canEdit
      ? [
          {
            title: t('common.action'),
            key: 'op',
            width: 150,
            fixed: 'right' as const,
            render: (_: unknown, r: LandingPage) => (
              <Space size={0}>
                {canEdit && <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(r)}>{t('common.edit')}</Button>}
              </Space>
            ),
          },
        ]
      : []),
  ]

  return (
    <Card
      className="page-card"
      bordered={false}
      title={<span className="section-title">{t('lp.title')}</span>}
      extra={
        canCreate ? (
          <Button type="primary" icon={<ThunderboltOutlined />} onClick={openModal}>
            {t('lp.genBtn')}
          </Button>
        ) : null
      }
    >
      <div style={{ marginBottom: 12 }}>
        <Text type="secondary">{t('lp.intro')}</Text>
      </div>

      <Space wrap style={{ marginBottom: 16 }}>
        <LineFilter value={lineSel} onChange={setLineSel} options={filterOptions(lineOptions)} disabled={lineDisabled} />
      </Space>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={landingPages}
        scroll={{ x: 1890 }}
        pagination={{ showTotal: (n) => t('common.total', { n }), showSizeChanger: true }}
      />

      <Modal
        open={open}
        title={editing ? '编辑落地页' : t('lp.genTitle')}
        onCancel={() => { setOpen(false); setEditing(null) }}
        onOk={submit}
        okText={editing ? t('common.save') : t('lp.genConfirm')}
        cancelText={t('common.cancel')}
        okButtonProps={{ disabled: !hasTemplate }}
        width={640}
        destroyOnClose
      >
        <Form form={form} layout="vertical" preserve={false} style={{ marginTop: 12 }}>
          <Form.Item
            name="name"
            label={t('lp.f.name')}
            rules={[{ required: true, message: t('lp.f.namePlaceholder') }]}
          >
            <Input allowClear autoComplete="off" placeholder={t('lp.f.namePlaceholder')} maxLength={50} />
          </Form.Item>
          <Form.Item
            name="businessLine"
            label={t('lp.f.line')}
            rules={[{ required: true, message: t('common.pleaseSelect') }]}
          >
            <Select
              placeholder={t('common.pleaseSelect')}
              onChange={onLineChange}
              options={lines.map((l) => ({
                label: LANDING_TEMPLATES[l] ? l : `${l}（${t('lp.noTemplateTag')}）`,
                value: l,
              }))}
            />
          </Form.Item>

          {line && !hasTemplate && (
            <Alert type="warning" showIcon style={{ marginBottom: 16 }} message={t('lp.noTemplate')} />
          )}

          <Form.Item
            name="channelCode"
            label={t('lp.f.channel')}
            tooltip={t('lp.f.channelTip')}
            rules={[{ required: true, message: t('common.pleaseSelect') }]}
          >
            <Select
              showSearch
              placeholder={line ? t('lp.f.channelPlaceholder') : t('lp.f.pickLineFirst')}
              disabled={!line}
              optionFilterProp="label"
              onChange={() => setPreview(null)}
              notFoundContent={t('lp.f.noChannel')}
              options={codeOptions.map((c) => ({ label: `${c.path}  ·  ${c.code}`, value: c.code }))}
            />
          </Form.Item>

          {channelCode && (
            <div style={{ marginTop: -12, marginBottom: 16 }}>
              {hasChannelParams ? (
                <Space size={6} wrap>
                  <Text type="secondary" style={{ fontSize: 12 }}>{t('lp.f.channelParams')}</Text>
                  {channelParams?.mediaSource && <Tag color="blue">media_source: {channelParams.mediaSource}</Tag>}
                  {channelParams?.afChannel && <Tag color="cyan">af_channel: {channelParams.afChannel}</Tag>}
                  {channelParams?.campaign && <Tag color="purple">campaign: {channelParams.campaign}</Tag>}
                  {channelParams?.campaignId && <Tag color="gold">campaign_id: {channelParams.campaignId}</Tag>}
                </Space>
              ) : (
                <Text type="secondary" style={{ fontSize: 12 }}>{t('lp.f.noChannelParams')}</Text>
              )}
            </div>
          )}

          <Form.Item name="skuIds" label="关联 SKU（选填）">
            <Select mode="multiple" showSearch allowClear placeholder={line ? '请选择 SKU' : t('lp.f.pickLineFirst')} disabled={!line} optionFilterProp="label" onChange={() => setPreview(null)} options={pkgOptions.map((item) => ({ label: `${item.id} · ${item.name}`, value: item.id }))} />
          </Form.Item>

          <Divider style={{ margin: '8px 0 16px' }} />
          <Space style={{ marginBottom: 8 }}>
            <Button onClick={doPreview} disabled={!hasTemplate}>
              {t('lp.previewBtn')}
            </Button>
            <Text type="secondary">{t('lp.previewHint')}</Text>
          </Space>
          {preview && (
            <div
              style={{
                padding: '10px 12px',
                background: '#f5f7fa',
                borderRadius: 8,
                wordBreak: 'break-all',
                position: 'relative',
              }}
            >
              <Paragraph style={{ margin: 0, fontFamily: 'monospace', fontSize: 13 }}>{preview}</Paragraph>
              <Button
                size="small"
                style={{ marginTop: 8 }}
                icon={<CopyOutlined />}
                onClick={() => copy(preview, t('common.copied'))}
              >
                {t('common.copy')}
              </Button>
            </div>
          )}
        </Form>
      </Modal>
    </Card>
  )
}
