import React, { useState } from 'react'
import { Card, Table, Typography, Space, Input } from 'antd'
import { useStore } from '../store'
import { useI18n } from '../i18n'
import { businessLineOf } from '../channel'
import { useLineScope } from '../useLineScope'
import LineFilter from '../components/LineFilter'

const { Text } = Typography
const { Search } = Input

export const LeadsList: React.FC = () => {
  const students = useStore((s) => s.students)
  const channels = useStore((s) => s.channels)
  const { t } = useI18n()
  const [searchText, setSearchText] = useState('')
  const { selected: lineSel, setSelected: setLineSel, matchLine, disabled: lineDisabled, filterOptions } = useLineScope()

  const lineOptions = ['马来', '印尼', '泰国', '新加坡', '越南', '韩国', '沙特', '其他']

  const filtered = students.filter((s) => {
    if (!matchLine(businessLineOf(channels, s))) return false
    
    if (searchText) {
      const q = searchText.toLowerCase()
      const text = `${s.phone || ''} ${s.countryCode || ''} ${s.country || ''} ${s.channelCode || ''} ${s.registerChannel || ''}`.toLowerCase()
      if (!text.includes(q)) return false
    }
    
    return true
  }).sort((a, b) => new Date(b.registerTime || 0).getTime() - new Date(a.registerTime || 0).getTime())

  const columns = [
    {
      title: t('leads.col.countryCode'),
      dataIndex: 'countryCode',
      width: 100,
      render: (v: string | undefined) => v || <Text type="secondary">—</Text>,
    },
    {
      title: t('leads.col.phone'),
      dataIndex: 'phone',
      width: 150,
      render: (v: string | undefined) => v || <Text type="secondary">—</Text>,
    },
    {
      title: t('leads.col.country'),
      dataIndex: 'country',
      width: 120,
      render: (v: string | undefined) => v || <Text type="secondary">—</Text>,
    },
    {
      title: t('leads.col.channelName'),
      dataIndex: 'channelName',
      width: 150,
      render: (_: any, r: any) => {
        let name = ''
        if (r.channelCode) {
          let found = ''
          const findIn = (nodes: any[]) => {
            for (const n of nodes) {
              if (n.code === r.channelCode) {
                found = n.name
                return
              }
              if (n.children) findIn(n.children)
            }
          }
          findIn(channels)
          name = found
        }
        name = name || r.registerChannel || r.adChannel || ''
        return name || <Text type="secondary">—</Text>
      },
    },
    {
      title: t('leads.col.channelCode'),
      dataIndex: 'channelCode',
      width: 120,
      render: (v: string | undefined) => (v ? <Text code>{v}</Text> : <Text type="secondary">—</Text>),
    },
  ]

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <Space style={{ marginBottom: 16 }} size="middle">
        <LineFilter value={lineSel} onChange={setLineSel} options={filterOptions(lineOptions)} disabled={lineDisabled} />
        <Search
          placeholder={t('leads.search')}
          allowClear
          onSearch={setSearchText}
          style={{ width: 280 }}
        />
      </Space>
      <Card bodyStyle={{ padding: 0 }}>
        <Table
          dataSource={filtered}
          columns={columns}
          rowKey="studentId"
          pagination={{
            showTotal: (n) => t('common.total', { n }),
            showSizeChanger: true,
            defaultPageSize: 10,
            pageSizeOptions: ['10', '20', '50', '100']
          }}
          scroll={{ x: 800 }}
        />
      </Card>
    </div>
  )
}
