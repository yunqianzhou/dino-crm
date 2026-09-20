import { useState } from 'react'
import { Empty, Segmented, Select, Typography } from 'antd'
import type { Account } from '../types'
import { isSalesMember } from '../phase5'

type Props = {
  accounts: Account[]; owners: string[]; value?: string; onChange: (value?: string) => void
  className?: string; placeholder?: string; unassigned?: boolean
}
export default function CCSelect({ accounts, owners, value, onChange, className, placeholder = 'CC · 搜索销售姓名 / 邮箱', unassigned = true }: Props) {
  const [mode, setMode] = useState<string>('active')
  const [search, setSearch] = useState('')
  const active = accounts.filter(account => isSalesMember(account) && account.status === '启用')
  const activeIds = new Set(active.map(account => account.email))
  const historical = [...new Set(owners.filter(owner => owner && !activeIds.has(owner)))]
  const entries = mode === 'active' ? active.map(account => account.email) : historical
  const allItems = entries.map(email => {
    const account = accounts.find(item => item.email === email)
    const suffix = account?.status === '停用' ? '已停用' : !account?.isSalesMember ? '历史负责人' : account.businessLines.join(' / ') || '全部业务线'
    return { value: email, label: `${account?.name || email} · ${suffix}`, searchText: `${account?.name || ''} ${email} ${account?.businessLines.join(' ') || ''}`,
      email }
  })
  const matches = allItems.filter(item => item.searchText.toLowerCase().includes(search.trim().toLowerCase())).sort((a, b) => String(a.label).localeCompare(String(b.label)))
  const items = matches.slice(0, 20)
  const selectedAccount = accounts.find(account => account.email === value)
  return <Select className={className} style={!className ? { width: '100%' } : undefined}
    aria-label="CC筛选" allowClear showSearch placeholder={placeholder} value={value} onChange={onChange}
    searchValue={search} onSearch={setSearch} onOpenChange={open => { if (!open) setSearch('') }}
    popupMatchSelectWidth={380} filterOption={false}
    labelRender={option => option.value === '__unassigned__' ? '未分配' : selectedAccount?.name || option.label || String(option.value)}
    options={[...(unassigned && mode === 'active' && (!search || '未分配'.includes(search.trim())) ? [{ value: '__unassigned__', label: '未分配', searchText: '未分配', email: '' }] : []), ...items]}
    optionRender={option => <div><div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}><span>{option.data.label}</span></div>{option.data.email && <Typography.Text type="secondary" style={{ fontSize: 12 }}>{option.data.email}</Typography.Text>}</div>}
    notFoundContent={<Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={search ? '未找到匹配销售，试试姓名或邮箱' : mode === 'active' ? '暂无在职销售，请在成员管理中维护销售成员' : '暂无其他历史负责人'} />}
    dropdownRender={menu => <><div style={{ padding: '8px 8px 12px' }} onMouseDown={event => event.preventDefault()}>
      <Segmented block value={mode} onChange={value => setMode(String(value))} options={[{ label: `在职销售 ${active.length}`, value: 'active' }, { label: `历史负责人 ${historical.length}`, value: 'history' }]} />
      <div style={{ color: '#8c8c8c', fontSize: 12, marginTop: 8 }}>仅列出当前业务线范围；历史负责人仅用于查询</div>
    </div>{menu}{matches.length > 20 && <div style={{ padding: '8px 12px', color: '#8c8c8c', fontSize: 12 }}>展示前 20 位，共 {matches.length} 位；输入姓名或邮箱缩小范围</div>}</>}
  />
}
