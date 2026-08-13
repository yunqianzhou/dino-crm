import { useMemo, useState } from 'react'
import {
  Alert,
  Button,
  Card,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Modal,
  Radio,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
  message,
} from 'antd'
import { PlusOutlined, SearchOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs, { Dayjs } from 'dayjs'
import { genPackageId, setState, useStore } from '../store'
import { BUSINESS_LINES, LINE_CURRENCY } from '../types'
import type { BusinessLine, CoursePackage } from '../types'
import { useI18n } from '../i18n'
import { usePerm } from '../perm'
import { useLineScope } from '../useLineScope'
import LineFilter from '../components/LineFilter'

const { Text } = Typography
const { RangePicker } = DatePicker

// 前端页面展示的 Best Value 推荐标签样式
function BestValueTag() {
  return (
    <span
      style={{
        display: 'inline-block',
        background: 'linear-gradient(90deg, #ff7a45, #ff4d4f)',
        color: '#fff',
        fontSize: 12,
        fontWeight: 600,
        lineHeight: '20px',
        padding: '0 10px',
        borderRadius: 10,
        whiteSpace: 'nowrap',
      }}
    >
      Best Value
    </span>
  )
}

function currencyOptions(line?: BusinessLine) {
  const opts = [{ label: '美元 (USD)', value: 'USD' }]
  if (line && line !== '其他') {
    const c = LINE_CURRENCY[line]
    opts.unshift({ label: c.label, value: c.code })
  }
  return opts
}

export default function CoursePackagePage() {
  const { t } = useI18n()
  const packages = useStore((s) => s.packages)
  const channels = useStore((s) => s.channels)
  const { can, actor } = usePerm()
  const canEdit = can('packages_edit') === 'operate'
  const canCreate = can('packages_create') === 'operate'
  const canStatus = can('packages_status') === 'operate'
  const [keyword, setKeyword] = useState('')
  const { selected: lineSel, setSelected: setLineSel, matchLine, disabled: lineDisabled, filterOptions } = useLineScope()
  const [modal, setModal] = useState<{ mode: 'add' | 'edit'; record?: CoursePackage } | null>(null)
  const [form] = Form.useForm()
  const watchLine = Form.useWatch('businessLine', form) as BusinessLine | undefined
  const watchValidityMode = Form.useWatch('validityMode', form) as 'absolute' | 'relative' | undefined

  // 业务线筛选项：渠道业务线 + 列表实际包含的业务线
  const lineOptions = useMemo(
    () => Array.from(new Set([...channels.map((c) => c.name), ...packages.map((p) => p.businessLine)].filter(Boolean))),
    [channels, packages],
  )

  const data = useMemo(
    () =>
      packages.filter((p) => {
        const kw = keyword.trim().toLowerCase()
        const matchKw = !kw || p.id.toLowerCase().includes(kw) || p.name.toLowerCase().includes(kw)
        return matchKw && matchLine(p.businessLine)
      }),
    [packages, keyword, lineSel, matchLine],
  )

  const openAdd = () => {
    setModal({ mode: 'add' })
    form.resetFields()
    form.setFieldsValue({ validityMode: 'absolute' })
  }
  const openEdit = (record: CoursePackage) => {
    setModal({ mode: 'edit', record })
    form.setFieldsValue({
      businessLine: record.businessLine,
      name: record.name,
      currency: record.currency,
      price: record.price,
      bestValue: record.bestValue ?? false,
      validityMode: record.validityMode ?? 'absolute',
      validDays: record.validDays,
      validRange: [dayjs(record.validStart), dayjs(record.validEnd)],
    })
  }

  const submit = async () => {
    const v = await form.validateFields()
    const validityMode = v.validityMode as 'absolute' | 'relative'
    const [rangeStart, rangeEnd] = (v.validRange ?? []) as [Dayjs, Dayjs]
    const validDays = v.validDays as number | undefined
    const validStart = validityMode === 'relative' ? dayjs() : rangeStart
    const validEnd = validityMode === 'relative' ? dayjs().add(validDays ?? 0, 'day') : rangeEnd
    if (modal?.mode === 'add') {
      const pkg: CoursePackage = {
        id: genPackageId(),
        businessLine: v.businessLine,
        name: v.name,
        currency: v.currency,
        price: v.price,
        bestValue: !!v.bestValue,
        validityMode,
        validDays: validityMode === 'relative' ? validDays : undefined,
        validStart: validStart.format('YYYY-MM-DD HH:mm:ss'),
        validEnd: validEnd.format('YYYY-MM-DD HH:mm:ss'),
        creator: actor,
        status: '上架',
        createdAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
      }
      setState((prev) => ({ ...prev, packages: [pkg, ...prev.packages] }))
      message.success(t('pkg.added'))
    } else if (modal?.record) {
      setState((prev) => ({
        ...prev,
        packages: prev.packages.map((p) =>
          p.id === modal.record!.id
            ? {
                ...p,
                businessLine: v.businessLine,
                name: v.name,
                currency: v.currency,
                price: v.price,
                bestValue: !!v.bestValue,
                validityMode,
                validDays: validityMode === 'relative' ? validDays : undefined,
                validStart: validStart.format('YYYY-MM-DD HH:mm:ss'),
                validEnd: validEnd.format('YYYY-MM-DD HH:mm:ss'),
              }
            : p,
        ),
      }))
      message.success(t('pkg.updated'))
    }
    setModal(null)
  }

  const toggleShelf = (record: CoursePackage) => {
    const next = record.status === '上架' ? '下架' : '上架'
    Modal.confirm({
      title: next === '下架' ? t('pkg.shelfOffTitle') : t('pkg.shelfOnTitle'),
      content: t('pkg.shelfConfirm', { action: t(`enum.pkg.${next}`), name: record.name }),
      okText: t('common.confirm'),
      cancelText: t('common.cancel'),
      okButtonProps: next === '下架' ? { danger: true } : undefined,
      onOk: () =>
        setState((prev) => ({
          ...prev,
          packages: prev.packages.map((p) => (p.id === record.id ? { ...p, status: next } : p)),
        })),
    })
  }

  const columns: ColumnsType<CoursePackage> = [
    { title: 'SKU ID', dataIndex: 'id', width: 120 },
    { title: '国家 / 业务线', dataIndex: 'businessLine', width: 120, render: (v) => <Tag color="geekblue">{v}</Tag> },
    {
      title: 'SKU 名称',
      dataIndex: 'name',
      width: 240,
      render: (v: string, r) => (
        <Space size={6}>
          <span>{v}</span>
          {r.bestValue && <BestValueTag />}
        </Space>
      ),
    },
    {
      title: '原价',
      dataIndex: 'price',
      width: 150,
      render: (v, r) => (
        <Text strong>
          {r.currency} {v.toLocaleString()}
        </Text>
      ),
    },
    {
      title: '有效期',
      key: 'valid',
      width: 340,
      render: (_, r) => (
        <Text type="secondary">{r.validityMode === 'relative' ? `相对时间：${r.validDays} 天` : `${r.validStart} ~ ${r.validEnd}`}</Text>
      ),
    },
    {
      title: t('common.action'),
      key: 'action',
      width: 100,
      fixed: 'right',
      render: (_, r) => (
        <Space size={0}>
          {canEdit && (
            <Button type="link" onClick={() => openEdit(r)}>
              {t('common.edit')}
            </Button>
          )}
        </Space>
      ),
    },
  ]

  return (
    <Card
      className="page-card"
      bordered={false}
      title={<span className="section-title">SKU 管理</span>}
      extra={
        canCreate ? (
          <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>
            新增 SKU
          </Button>
        ) : null
      }
    >
      <Space wrap style={{ marginBottom: 16 }}>
        <Input
          allowClear
          prefix={<SearchOutlined />}
          placeholder={t('pkg.searchPlaceholder')}
          style={{ width: 240 }}
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
        />
        <LineFilter value={lineSel} onChange={setLineSel} options={filterOptions(lineOptions)} disabled={lineDisabled} />
      </Space>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={data}
        scroll={{ x: 1440 }}
        pagination={{ showTotal: (n) => t('common.total', { n }), showSizeChanger: true }}
      />

      <Modal
        open={!!modal}
        title={modal?.mode === 'add' ? '新增 SKU' : '编辑 SKU'}
        onCancel={() => setModal(null)}
        onOk={submit}
        okText={t('common.confirm')}
        cancelText={t('common.cancel')}
        destroyOnClose
      >
        <Form form={form} layout="vertical" preserve={false} style={{ marginTop: 12 }}>
          <Form.Item name="businessLine" label="国家 / 业务线" rules={[{ required: true, message: '请选择国家 / 业务线' }]}>
            <Select
              placeholder={t('pkg.linePlaceholder')}
              options={BUSINESS_LINES.map((l) => ({ label: l, value: l }))}
              onChange={() => form.setFieldValue('currency', undefined)}
            />
          </Form.Item>
          <Form.Item name="name" label="SKU 名称" rules={[{ required: true, message: '请输入 SKU 名称' }]}>
            <Input autoComplete="off" placeholder="例如：1-year-KOL" />
          </Form.Item>
          <Form.Item name="currency" label={t('pkg.label.currency')} rules={[{ required: true, message: t('pkg.currencyRequired') }]}>
            <Select placeholder={t('pkg.currencyPlaceholder')} options={currencyOptions(watchLine)} />
          </Form.Item>
          <Form.Item name="price" label="原价" rules={[{ required: true, message: '请输入原价' }]}>
            <InputNumber style={{ width: '100%' }} min={0} placeholder="请输入原价" />
          </Form.Item>
          <Form.Item
            name="bestValue"
            label={t('pkg.label.bestValue')}
            tooltip={t('pkg.bestValueTip')}
            valuePropName="checked"
          >
            <Switch checkedChildren="Best Value" unCheckedChildren={t('pkg.bestValueOff')} />
          </Form.Item>
          <Form.Item name="validityMode" label="有效期" rules={[{ required: true }]}><Radio.Group options={[{ label: '绝对时间', value: 'absolute' }, { label: '相对时间', value: 'relative' }]} /></Form.Item>
          {watchValidityMode === 'relative' ? <Form.Item name="validDays" label="有效期天数" rules={[{ required: true, message: '请输入有效期天数' }]}><InputNumber style={{ width: '100%' }} min={1} addonAfter="天" /></Form.Item> : <Form.Item name="validRange" label="起止时间" rules={[{ required: true, message: '请选择起止时间' }]}><RangePicker showTime format="YYYY-MM-DD HH:mm:ss" style={{ width: '100%' }} placeholder={[t('pkg.startTime'), t('pkg.endTime')]} /></Form.Item>}
        </Form>
      </Modal>

    </Card>
  )
}
