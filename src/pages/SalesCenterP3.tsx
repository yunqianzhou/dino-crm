import { useState } from 'react'
import { Button, Form, Modal, Upload, message } from 'antd'
import { ImportOutlined, InboxOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import * as XLSX from 'xlsx'
import SalesCenter from './SalesCenter'
import { setState, uid, useStore } from '../store'
import type { BusinessLine, Student } from '../types'
import { usePerm } from '../perm'
import { downloadCsv } from '../export'

type LeadRow = { phone: string; areaCode?: string; channelCode?: string; followNote?: string }

const AREA_CODE_LOCATION: Record<string, { country: string; businessLine: BusinessLine }> = {
  '60': { country: '马来西亚', businessLine: '马来' },
  '62': { country: '印尼', businessLine: '印尼' },
  '66': { country: '泰国', businessLine: '泰国' },
  '65': { country: '新加坡', businessLine: '新加坡' },
  '84': { country: '越南', businessLine: '越南' },
  '82': { country: '韩国', businessLine: '韩国' },
  '966': { country: '沙特', businessLine: '沙特' },
  '852': { country: '中国香港', businessLine: '其他' },
  '886': { country: '中国台湾', businessLine: '其他' },
  '86': { country: '中国', businessLine: '其他' },
  '1': { country: '美国/加拿大', businessLine: '其他' },
}

function phoneKey(phone: string) {
  return phone.replace(/[^\d+]/g, '')
}

function locationOf(areaCode?: string) {
  const code = (areaCode ?? '').replace(/\D/g, '')
  return {
    countryCode: code ? '+' + code : '',
    ...(AREA_CODE_LOCATION[code] ?? { country: '其他', businessLine: '其他' as BusinessLine }),
  }
}

function parseLeads(raw: string): LeadRow[] {
  const rows = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split(/[,\t]/).map((value) => value.trim()))
  if (!rows.length) return []
  const normalizeHeader = (value: string) => value.replace(/^\uFEFF/, '').replace(/[\s_-]/g, '').toLowerCase()
  const header = rows[0].map(normalizeHeader)
  const hasHeader = header.includes('手机号') || header.includes('phone') || header.includes('phonenumber')
  const indexOf = (names: string[], fallback: number) => {
    const found = header.findIndex((value) => names.includes(value))
    return found >= 0 ? found : fallback
  }
  const phoneIndex = indexOf(['手机号', 'phone', 'phonenumber'], 0)
  const areaCodeIndex = indexOf(['手机区号', '区号', 'areacode', 'phonecountrycode'], 1)
  const channelCodeIndex = indexOf(['渠道code', 'channelcode'], 2)
  const followNoteIndex = indexOf(['follow备注', 'followremark', 'follow备注信息', 'follownote'], 3)
  return rows
    .slice(hasHeader ? 1 : 0)
    .map((row) => ({
      phone: row[phoneIndex] ?? '',
      areaCode: row[areaCodeIndex] ?? '',
      channelCode: row[channelCodeIndex] ?? '',
      followNote: row[followNoteIndex] ?? '',
    }))
    .filter((row) => /\d{6,}/.test(phoneKey(row.phone)))
}

function LeadImportButton() {
  const students = useStore((s) => s.students)
  const { can, actor } = usePerm()
  const canImport = can('salesV3_import_leads') === 'operate'
  const [open, setOpen] = useState(false)
  const [form] = Form.useForm()
  const [fileName, setFileName] = useState('')

  const readFile = async (file: File) => {
    const isExcel = /\.(xlsx|xls)$/i.test(file.name)
    const isCsv = /\.csv$/i.test(file.name)
    if (!isExcel && !isCsv) {
      message.error('仅支持 CSV 或 Excel（.xlsx/.xls）文件。')
      return
    }
    let content = ''
    if (isExcel) {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' })
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
      content = firstSheet ? XLSX.utils.sheet_to_csv(firstSheet) : ''
    } else {
      content = await file.text()
    }
    if (!content.trim()) {
      message.warning('文件中没有可导入的数据。')
      return
    }
    form.setFieldValue('content', content)
    setFileName(file.name)
  }

  const downloadTemplate = () =>
    downloadCsv(
      'Leads导入模板.csv',
      ['Phone Number', 'Phone Country Code', 'Channel Code', 'FOLLOW Remark'],
      [['0012313331115', '852', 'HK000Fq', 'follow备注信息']],
    )

  const submit = async () => {
    const value = await form.validateFields()
    const rows = parseLeads(value.content)
    if (!rows.length) {
      message.warning('未识别到有效手机号，请检查导入内容。')
      return
    }
    const displayPhone = (row: LeadRow) => {
      if (!row.areaCode) return row.phone
      const code = row.areaCode.startsWith('+') ? row.areaCode : '+' + row.areaCode
      return code + ' ' + row.phone
    }
    const existing = new Set(students.map((student) => phoneKey(student.phone ?? '')).filter(Boolean))
    const uniqueRows = rows.filter((row) => {
      const key = phoneKey(displayPhone(row))
      if (existing.has(key)) return false
      existing.add(key)
      return true
    })
    if (!uniqueRows.length) {
      message.warning('所有手机号已存在，未创建新 Leads。')
      return
    }
    const now = dayjs.utc().format('YYYY-MM-DD HH:mm:ss')
    const created: Student[] = uniqueRows.map((row) => {
      const phone = displayPhone(row)
      const note = row.followNote || '【静默注册】通过 Leads 导入创建'
      const location = locationOf(row.areaCode)
      return {
        studentId: uid('lead_'),
        name: '导入 Leads',
        userType: '正式用户',
        loginMethod: '手机号',
        account: phone,
        phone,
        businessLine: location.businessLine,
        registerChannel: '导入 Leads（静默注册）',
        countryCode: location.countryCode,
        country: location.country,
        channelCode: row.channelCode || 'IMPORTED_LEAD',
        channelSource: '线索导入',
        registerTime: now,
        status: '未付费-未体验',
        salesProgress: '待领取',
        salesLatestNote: note,
        salesUpdatedAt: now,
        salesHistory: [{ progress: '待领取', note, time: now, owner: actor }],
      }
    })
    setState((prev) => ({ ...prev, students: [...created, ...prev.students] }))
    message.success('已静默注册 ' + created.length + ' 条 Leads；跳过 ' + (rows.length - created.length) + ' 条重复数据。')
    setOpen(false)
  }

  if (!canImport) return null
  return (
    <>
      <Button icon={<ImportOutlined />} onClick={() => { form.resetFields(); setFileName(''); setOpen(true) }}>导入 Leads</Button>
      <Modal
        open={open}
        title={<span>上传 Leads <Button type="link" size="small" style={{ padding: 0, marginLeft: 6, color: '#ff4d4f' }} onClick={downloadTemplate}>下载模板</Button></span>}
        onCancel={() => setOpen(false)}
        footer={<><Button onClick={() => setOpen(false)}>取消</Button><Button type="primary" onClick={submit}>上传</Button></>}
        width={720}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item name="content" hidden rules={[{ required: true, message: '请上传 Leads 文件' }]}><input /></Form.Item>
          <Form.Item label="上传 leads" required>
            <Upload.Dragger
              accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              maxCount={1}
              showUploadList={false}
              beforeUpload={(file) => { void readFile(file); return false }}
              style={{ width: 360 }}
            >
              <p className="ant-upload-drag-icon"><InboxOutlined style={{ color: '#bfc7d5' }} /></p>
              <p className="ant-upload-text">拖动至此处 <span style={{ color: '#ff4d4f' }}>点击上传</span></p>
              <p className="ant-upload-hint">支持 CSV 或 Excel（.xlsx / .xls）</p>
            </Upload.Dragger>
            <div style={{ color: '#8c8c8c', fontSize: 12, marginTop: 8 }}>表头：Phone Number、Phone Country Code、Channel Code、FOLLOW Remark；系统将按手机区号自动映射国家与业务线，重复手机号会自动跳过。{fileName ? '已读取：' + fileName : ''}</div>
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}

export default function SalesCenterP3() {
  return <SalesCenter phase3 detailPath="/sales-v3" importAction={<LeadImportButton />} />
}
