import OutboundBindingModal from '../components/OutboundBindingModal'
import { bindingsOf, providerName } from '../outbound'
import { useMemo, useState } from 'react'
import {
  Alert,
  Button,
  Card,
  Form,
  Input,
  Modal,
  Radio,
  Select,
  Space,
  Switch,
  Table,
  Tabs,
  Tag,
  Tooltip,
  Typography,
  message,
} from 'antd'
import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  SafetyOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { addLog, disableAccountAndReallocate, setState, uid, useStore } from '../store'
import { BUSINESS_LINES } from '../types'
import type { Account, AuditLog, DataScope, ModuleKey, PermLevel, Role } from '../types'
import { useI18n } from '../i18n'
import { usePerm } from '../perm'

const { Text, Paragraph } = Typography

const LEVEL_META: Record<PermLevel, { color: string }> = {
  none: { color: 'default' },
  view: { color: 'blue' },
  operate: { color: 'green' },
}

type ModuleNode = { key: ModuleKey; children?: ModuleNode[] }
type ModuleRow = { key: ModuleKey; depth: number; ancestors: ModuleKey[] }

const MODULE_HIERARCHY: ModuleNode[] = [
  { key: 'managementDashboard', children: [{ key: 'managementDashboard_export' }] },
  { key: 'appABTest' },
  { key: 'users', children: [{ key: 'users_edit' }, { key: 'users_phone_view' }, { key: 'users_export' }] },
  { key: 'sales', children: [{ key: 'sales_claim' }, { key: 'sales_dial' }, { key: 'sales_update' }, { key: 'sales_reassign' }, { key: 'sales_config' }] },
  { key: 'orders', children: [{ key: 'orders_export' }] },
  { key: 'system', children: [{ key: 'system_role_add' }, { key: 'system_role_edit' }, { key: 'system_role_delete' }, { key: 'system_acc_add' }, { key: 'system_acc_edit' }] },
  { key: 'usersV2', children: [{ key: 'usersV2_edit' }, { key: 'usersV2_phone_view' }, { key: 'usersV2_export' }, { key: 'usersV2_view_report' }, { key: 'usersV2_view_replay' }] },
  { key: 'ordersV3', children: [{ key: 'ordersV3_export' }] },
  { key: 'salesV3', children: [{ key: 'salesV5_batch_assign' }, { key: 'salesV3_claim' }, { key: 'salesV3_dial' }, { key: 'salesV3_update' }, { key: 'salesV3_reassign' }, { key: 'salesV3_config' }, { key: 'salesV3_import_leads' }, { key: 'salesV3_view_report' }, { key: 'salesV3_view_replay' }] },
  {
    key: 'marketing',
    children: [
      { key: 'channels', children: [{ key: 'channels_create' }, { key: 'channels_edit' }, { key: 'channels_delete' }, { key: 'channels_gen_code' }, { key: 'channels_params' }] },
      { key: 'landing', children: [{ key: 'landing_create' }, { key: 'landing_edit' }] },
      { key: 'packages', children: [{ key: 'packages_create' }, { key: 'packages_edit' }, { key: 'packages_status' }] },
      { key: 'coupons', children: [{ key: 'coupons_create' }, { key: 'coupons_extend' }, { key: 'coupons_revoke' }, { key: 'coupons_edit' }] },
    ],
  },
  {
    key: 'marketingV2',
    children: [
      { key: 'marketingV2_channels', children: [{ key: 'marketingV2_channels_edit' }, { key: 'marketingV2_channel_types' }] },
      { key: 'marketingV2_skus' },
      { key: 'marketingV2_offers', children: [{ key: 'marketingV2_offers_edit' }] },
      { key: 'marketingV2_landing', children: [{ key: 'marketingV2_landing_create' }, { key: 'marketingV2_landing_edit' }, { key: 'marketingV2_landing_preview' }, { key: 'marketingV2_landing_copy' }] },
    ],
  },
]

const flattenModules = (nodes: ModuleNode[], depth = 0, ancestors: ModuleKey[] = []): ModuleRow[] =>
  nodes.flatMap((node) => [
    { key: node.key, depth, ancestors },
    ...flattenModules(node.children ?? [], depth + 1, [...ancestors, node.key]),
  ])

const MODULE_ROWS = flattenModules(MODULE_HIERARCHY)
const descendantsOf = (key: ModuleKey) => MODULE_ROWS.filter((row) => row.ancestors.includes(key)).map((row) => row.key)

const EMPTY_PERMS = (): Record<ModuleKey, PermLevel> =>
  MODULE_ROWS.map((m) => m.key).reduce(
    (acc, m) => ({ ...acc, [m]: 'none' }),
    {} as Record<ModuleKey, PermLevel>,
  )

type RoleModal = { mode: 'create' } | { mode: 'edit'; role: Role } | null

export default function SystemConfig({ phase5 = false }: { phase5?: boolean }) {
  const { t, lang } = useI18n()
  const { can, actor } = usePerm()
  const canEditRoles = can('system') === 'operate' || can('system_role_edit') === 'operate'
  const canAddRoles = can('system') === 'operate' || can('system_role_add') === 'operate'
  const canDeleteRoles = can('system') === 'operate' || can('system_role_delete') === 'operate'

  const canEditAcc = can('system') === 'operate' || can('system_acc_edit') === 'operate'
  const canAddAcc = can('system') === 'operate' || can('system_acc_add') === 'operate'
  const roles = useStore((s) => s.roles)
  const accounts = useStore((s) => s.accounts)
  const channels = useStore((s) => s.channels)
  const logs = useStore((s) => s.logs)
  const lines = BUSINESS_LINES

  const moduleLabel = (m: ModuleKey) => {
    if (m === 'managementDashboard_export') return lang === 'en' ? 'Export dashboard data' : '下载看板数据'
    if (m === 'managementDashboard') return lang === 'en' ? 'Management Dashboard (Phase 5)' : '管理看板（五期）'
    if (m === 'salesV5_batch_assign') return lang === 'en' ? 'Batch assign leads' : '批量分配线索'
    if (m === 'appABTest') return lang === 'en' ? 'APP A/B test (Phase 6)' : 'APP A/B test配置（六期）'
    if (m === 'marketingV2_channel_types') return lang === 'en' ? 'Manage channel types' : '维护渠道类型（独立授权）'
    const marketingV2Labels: Partial<Record<ModuleKey, string>> = lang === 'en' ? {
      marketingV2: 'Marketing Center', marketingV2_channels: 'Channel management', marketingV2_channels_edit: 'Create and edit channels', marketingV2_channels_status: 'Enable / disable channels', marketingV2_skus: 'SKU catalog (view only)',
      marketingV2_offers: 'Offer plans', marketingV2_offers_edit: 'Create and edit offer plans', marketingV2_offers_status: 'Enable / end offer plans',
      marketingV2_landing: 'Landing page management', marketingV2_landing_create: 'Create landing pages', marketingV2_landing_edit: 'Edit landing pages', marketingV2_landing_preview: 'Generate preview links', marketingV2_landing_copy: 'Copy landing page links', marketingV2_landing_status: 'Publish / unpublish landing pages',
    } : {
      marketingV2: '营销中心', marketingV2_channels: '渠道管理', marketingV2_channels_edit: '新建及编辑渠道', marketingV2_channels_status: '启用/停用渠道', marketingV2_skus: 'SKU 管理（仅查看）',
      marketingV2_offers: '优惠方案', marketingV2_offers_edit: '新建及编辑优惠方案', marketingV2_offers_status: '启用/结束优惠方案',
      marketingV2_landing: '落地页管理', marketingV2_landing_create: '新建落地页', marketingV2_landing_edit: '编辑落地页', marketingV2_landing_preview: '生成预览链接', marketingV2_landing_copy: '复制落地页链接', marketingV2_landing_status: '落地页上下架',
    }
    if (marketingV2Labels[m]) return marketingV2Labels[m]!
    if (m === 'usersV2') return t('app.nav.users')
    if (m === 'ordersV3') return t('app.nav.orders')
    if (m === 'salesV3') return phase5 ? `${t('app.nav.sales')}（${lang === 'en' ? 'Phase 5' : '五期'}）` : t('app.nav.sales')
    return m.includes('_') ? t(`perm.${m}`) : t(`app.nav.${m}`)
  }
  const levelLabel = (lv: PermLevel) => t(`sys.level.${lv}`)
  const scopeLabel = (sc: DataScope) => t(`sys.scope.${sc}`)
  const roleName = (id: string) => roles.find((r) => r.id === id)?.name ?? id

  // ---------- 角色权限新增 / 编辑 ----------
  const [roleModal, setRoleModal] = useState<RoleModal>(null)
  const [draftName, setDraftName] = useState('')
  const [draftDesc, setDraftDesc] = useState('')
  const [draftPerms, setDraftPerms] = useState<Record<ModuleKey, PermLevel>>(EMPTY_PERMS())
  const [draftScope, setDraftScope] = useState<DataScope>('line')

  const openCreateRole = () => {
    setDraftName('')
    setDraftDesc('')
    setDraftPerms(EMPTY_PERMS())
    setDraftScope('line')
    setRoleModal({ mode: 'create' })
  }
  const openEditRole = (r: Role) => {
    setDraftName(r.name)
    setDraftDesc(r.desc)
    setDraftPerms({ ...r.perms })
    setDraftScope(r.dataScope)
    setRoleModal({ mode: 'edit', role: r })
  }
  const saveRole = () => {
    if (!roleModal) return
    if (!draftName.trim()) {
      message.error(t('sys.role.nameRequired'))
      return
    }
    if (roleModal.mode === 'create') {
      const role: Role = {
        id: uid('role_'),
        name: draftName.trim(),
        desc: draftDesc.trim(),
        builtin: false,
        dataScope: draftScope,
        perms: draftPerms,
      }
      setState((prev) => ({ ...prev, roles: [...prev.roles, role] }))
      addLog({ actor, module: 'system', action: 'sys.log.addRole', target: role.name })
      message.success(t('sys.addRoleOk'))
    } else {
      const id = roleModal.role.id
      setState((prev) => ({
        ...prev,
        roles: prev.roles.map((r) =>
          r.id === id
            ? { ...r, name: draftName.trim(), desc: draftDesc.trim(), perms: draftPerms, dataScope: draftScope }
            : r,
        ),
      }))
      addLog({ actor, module: 'system', action: 'sys.log.editRole', target: draftName.trim() })
      message.success(t('sys.saveRoleOk'))
    }
    setRoleModal(null)
  }
  const deleteRole = (r: Role) => {
    const used = accounts.filter((a) => a.roleId === r.id).length
    if (used > 0) {
      message.error(t('sys.role.inUse', { n: used }))
      return
    }
    Modal.confirm({
      title: t('sys.role.delTitle'),
      content: t('sys.role.delContent', { name: r.name }),
      okText: t('common.confirm'),
      cancelText: t('common.cancel'),
      okButtonProps: { danger: true },
      onOk: () => {
        setState((prev) => ({ ...prev, roles: prev.roles.filter((x) => x.id !== r.id) }))
        addLog({ actor, module: 'system', action: 'sys.log.delRole', target: r.name })
      },
    })
  }

  const roleColumns: ColumnsType<Role> = [
    {
      title: t('sys.role.col.name'),
      dataIndex: 'name',
      width: 200,
      render: (v, r) => (
        <Space size={6}>
          <Text strong>{v}</Text>
          {r.builtin && <Tag color="geekblue">{t('sys.builtin')}</Tag>}
          {r.planned && <Tag color="orange">{t('sys.planned')}</Tag>}
        </Space>
      ),
    },
    { title: t('sys.role.col.desc'), dataIndex: 'desc', render: (v) => <Text type="secondary">{v}</Text> },
    {
      title: t('sys.scopeLabel'),
      dataIndex: 'dataScope',
      width: 140,
      render: (v: DataScope) => <Tag color={v === 'all' ? 'purple' : 'cyan'}>{scopeLabel(v)}</Tag>,
    },
    {
      title: t('sys.role.col.members'),
      key: 'members',
      width: 80,
      align: 'center',
      render: (_, r) => accounts.filter((a) => a.roleId === r.id).length,
    },
    ...(canEditRoles || canDeleteRoles
      ? [
          {
            title: t('common.action'),
            key: 'op',
            width: 160,
            render: (_: unknown, r: Role) => (
              <Space size={0}>
                {canEditRoles && (
                  <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEditRole(r)}>
                    {t('sys.editRole')}
                  </Button>
                )}
                {canDeleteRoles && !r.builtin && (
                  <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => deleteRole(r)}>
                    {t('common.delete')}
                  </Button>
                )}
              </Space>
            ),
          },
        ]
      : []),
  ]

  const PHASE3_MODULES = ['usersV2', 'ordersV3', 'salesV3']
  const isPhase3 = (m: string) => PHASE3_MODULES.filter(p => !phase5 || p !== 'salesV3').some(p => m === p || m.startsWith(p + '_'))

  // 权限矩阵：行=模块（主模块+子模块平铺），列=角色
  const isCurrentSales = (row: ModuleRow) => row.key === 'salesV3' || row.ancestors.includes('salesV3')
  const matrixData = phase5
    ? [...MODULE_ROWS.filter(isCurrentSales), ...MODULE_ROWS.filter(row => !isCurrentSales(row))]
    : MODULE_ROWS

  const matrixColumns: ColumnsType<ModuleRow> = [
    {
      title: t('sys.module'),
      dataIndex: 'key',
      fixed: 'left',
      width: 150,
      render: (m: ModuleKey, row) => {
        const isSub = row.depth > 0
        const p3 = isPhase3(m)
        return (
          <Text strong={!isSub} style={{ marginLeft: isSub ? 16 : 0, color: p3 ? '#bfbfbf' : undefined }}>
            {moduleLabel(m)}
            {p3 && !isSub && <Tag color="default" style={{ marginLeft: 6, transform: 'scale(0.8)', color: '#8c8c8c' }}>{t('app.phase3')}</Tag>}
          </Text>
        )
      },
    },
    ...roles.map((r) => ({
      title: r.name,
      key: r.id,
      width: 130,
      align: 'center' as const,
      render: (_: unknown, row: ModuleRow) => {
        const lv = r.perms[row.key] ?? 'none'
        return <Tag color={LEVEL_META[lv].color}>{levelLabel(lv)}</Tag>
      },
    })),
  ]
  // ---------- 成员账号 ----------
  const [accEditing, setAccEditing] = useState<Account | null>(null)
  const [accOpen, setAccOpen] = useState(false)
  const [form] = Form.useForm()
  const watchRole = Form.useWatch('roleId', form) as string | undefined
  const watchRoleScope = roles.find((r) => r.id === watchRole)?.dataScope

  const openAcc = (a?: Account) => {
    setAccEditing(a ?? null)
    setAccOpen(true)
  }
  const populateAcc = (open: boolean) => {
    if (!open) return
    const a = accEditing
    form.resetFields()
    if (a) {
      form.setFieldsValue({
        email: a.email,
        name: a.name,
        roleId: a.roleId,
        isSalesMember: a.isSalesMember === true,
        businessLines: a.businessLines,
        ...(!phase5 ? { status: a.status === '启用' } : {}),
      })
    } else {
      form.setFieldsValue({ isSalesMember: false, ...(!phase5 ? { status: true } : {}) })
    }
  }
  const submitAcc = async () => {
    const v = await form.validateFields()
    const scope = roles.find((r) => r.id === v.roleId)?.dataScope
    const next: Account = {
      id: accEditing?.id ?? uid('acc_'),
      email: v.email,
      name: v.name,
      roleId: v.roleId,
      businessLines: scope === 'all' ? [] : v.businessLines ?? [],
      status: phase5 ? accEditing?.status ?? '启用' : v.status ? '启用' : '停用',
      isSalesMember: v.isSalesMember === true,
      salesLead: accEditing?.salesLead,
      lastLogin: accEditing?.lastLogin,
      outboundSeatBound: accEditing?.outboundSeatBound || false,
      outboundBindings: accEditing?.outboundBindings,
    }
    setState((prev) => ({
      ...prev,
      accounts: accEditing
        ? prev.accounts.map((a) => (a.id === next.id ? { ...next, ...(phase5 ? { status: a.status } : {}) } : a))
        : [next, ...prev.accounts],
    }))
    addLog({
      actor,
      module: 'system',
      action: accEditing ? 'sys.log.editAcc' : 'sys.log.addAcc',
      target: next.email,
    })
    message.success(t(accEditing ? 'sys.acc.updateOk' : 'sys.acc.addOk'))
    setAccOpen(false)
  }
  const toggleAcc = (a: Account) => {
    const isDisabling = a.status === '启用'
    
    if (isDisabling) {
      Modal.confirm({
        title: 'Tips',
        content: (
          <div>
            <div style={{ marginBottom: 12 }}>停用员工操作的影响：</div>
            <ul style={{ paddingLeft: 20 }}>
              <li>该员工名下的所有 Leads ，将根据分配规则重新分配给其他员工。</li>
              <li>该员工将不再接收新的 Leads 分配。</li>
            </ul>
            <div style={{ marginTop: 12 }}>如需修改信息，请点击「编辑」。</div>
          </div>
        ),
        onOk: () => {
          setState((prev) => disableAccountAndReallocate(prev, a.id))
          addLog({
            actor,
            module: 'system',
            action: 'sys.log.disableAcc',
            target: a.email,
          })
          message.success('已停用')
        }
      })
    } else {
      setState((prev) => ({
        ...prev,
        accounts: prev.accounts.map((x) =>
          x.id === a.id ? { ...x, status: '启用' } : x,
        ),
      }))
      addLog({
        actor,
        module: 'system',
        action: 'sys.log.enableAcc',
        target: a.email,
      })
      message.success('已启用')
    }
  }

  const [bindingAccount, setBindingAccount] = useState<Account | null>(null)
  const toggleOutboundBound = (a: Account) => setBindingAccount(a)

  const accColumns: ColumnsType<Account> = [
    { title: t('sys.acc.col.name'), dataIndex: 'name', width: 140 },
    { title: t('sys.acc.col.email'), dataIndex: 'email', width: 220 },
    { title: phase5 ? (lang === 'en' ? 'Frontline sales (CC)' : '一线销售（CC）') : '销售成员', key: 'salesMember', width: 140, render: (_: unknown, account: Account) => account.isSalesMember ? <Tag color="blue">{phase5 ? 'CC' : '销售'}</Tag> : <Text type="secondary">—</Text> },
    {
      title: t('sys.acc.col.role'),
      dataIndex: 'roleId',
      width: 170,
      render: (v) => <Tag color="geekblue">{roleName(v)}</Tag>,
    },
    {
      title: t('sys.acc.col.scope'),
      dataIndex: 'businessLines',
      width: 180,
      render: (v: string[], r) => {
        const scope = roles.find((x) => x.id === r.roleId)?.dataScope
        if (scope === 'all') return <Tag color="purple">{scopeLabel('all')}</Tag>
        if (!v.length) return <Text type="secondary">—</Text>
        return (
          <Space size={4} wrap>
            {v.map((l) => (
              <Tag key={l} color="cyan">{l}</Tag>
            ))}
          </Space>
        )
      },
    },
    {
      title: t('sys.acc.col.status'),
      dataIndex: 'status',
      width: 110,
      render: (v: string, r) => (
        <Switch
          size="small"
          disabled={!canEditAcc}
          checked={v === '启用'}
          onChange={() => toggleAcc(r)}
          checkedChildren={t('sys.status.enabled')}
          unCheckedChildren={t('sys.status.disabled')}
        />
      ),
    },
    {
      title: t('sys.acc.col.lastLogin'),
      dataIndex: 'lastLogin',
      width: 170,
      render: (v) => v || <Text type="secondary">—</Text>,
    },
    { title: lang === 'en' ? 'Calling capability' : '外呼能力', key: 'outbound', width: 200, render: (_, r) => <Space wrap size={4}>{bindingsOf(r).length ? bindingsOf(r).map(b => <Tag key={b.provider} color={b.provider === 'omicall' ? 'blue' : 'default'}>{providerName(b.provider, lang === 'en')}</Tag>) : <Text type="secondary">—</Text>}</Space> },
    ...(canEditAcc
      ? [
          {
            title: t('common.action'),
            key: 'op',
            width: 200,
            fixed: 'right' as const,
            render: (_: unknown, r: Account) => (
              <Space size="small" wrap split={<span style={{ color: '#e8e8e8' }}>|</span>}>
                <Button type="link" size="small" style={{ padding: 0 }} onClick={() => toggleAcc(r)}>
                  <span style={{ color: r.status === '启用' ? '#ff4d4f' : '#2F6BFF' }}>
                    {r.status === '启用' ? '停用' : '启用'}
                  </span>
                </Button>
                <Button type="link" size="small" style={{ padding: 0 }} onClick={() => openAcc(r)}>
                  {t('common.edit')}
                </Button>
                <Button type="link" size="small" style={{ padding: 0 }} onClick={() => toggleOutboundBound(r)}>
                  {lang === 'en' ? (bindingsOf(r).length ? 'Manage calling' : 'Bind calling') : (bindingsOf(r).length ? '管理外呼' : '绑定外呼')}
                </Button>
              </Space>
            ),
          },
        ]
      : []),
  ]

  // ---------- 操作日志 ----------
  const logColumns: ColumnsType<AuditLog> = [
    { title: t('sys.log.col.time'), dataIndex: 'time', width: 180 },
    { title: t('sys.log.col.actor'), dataIndex: 'actor', width: 220 },
    {
      title: t('sys.log.col.action'),
      dataIndex: 'action',
      width: 200,
      render: (v: string) => t(v),
    },
    { title: t('sys.log.col.target'), dataIndex: 'target', render: (v) => v || <Text type="secondary">—</Text> },
  ]

  return (
    <Card
      className="page-card"
      bordered={false}
      title={
        <span className="section-title">
          <SafetyOutlined style={{ marginRight: 8 }} />
          {t('sys.title')}{phase5 ? (lang === 'en' ? ' · Phase 5' : ' · 五期') : ''}
        </span>
      }
    >
      <div style={{ marginBottom: 12 }}>
        <Text type="secondary">{phase5 ? (lang === 'en' ? 'Roles control permissions. Mark frontline sales (CC) in member accounts; CCs may add up to 3 membership days per operation in both centers.' : '角色管理操作权限；在成员账号中标记一线销售（CC）。CC 在用户中心和销售中心每次添加会员时长均最多 3 天。') : t('sys.intro')}</Text>
      </div>

      <OutboundBindingModal account={bindingAccount} onCancel={() => setBindingAccount(null)} onSave={bindings => {
        if (!bindingAccount || !canEditAcc) return
        const target = bindingAccount
        setState(prev => ({ ...prev, accounts: prev.accounts.map(a => a.id === target.id ? { ...a, outboundBindings: bindings, outboundSeatBound: bindings.length > 0 } : a) }))
        addLog({ actor, module: 'system', action: bindings.length ? 'sys.log.bindOutbound' : 'sys.log.unbindOutbound', target: `${target.email} · ${bindings.map(b => providerName(b.provider)).join('；') || '全部解绑'}` })
        setBindingAccount(null)
        message.success(lang === 'en' ? 'Calling bindings saved' : '外呼绑定已保存')
      }} />
      <Tabs
        items={[
          {
            key: 'roles',
            label: t('sys.tab.roles'),
            children: (
              <div>
                {canEditAcc && (
                  <div style={{ marginBottom: 12, textAlign: 'right' }}>
                    <Button type="primary" icon={<PlusOutlined />} onClick={openCreateRole}>
                      {t('sys.addRole')}
                    </Button>
                  </div>
                )}
                <Table
                  rowKey="id"
                  columns={roleColumns}
                  dataSource={roles}
                  pagination={{
                    showTotal: (n) => t('common.total', { n }),
                    showSizeChanger: true,
                    defaultPageSize: 10,
                    pageSizeOptions: ['10', '20', '50', '100']
                  }}
                  style={{ marginBottom: 24 }}
                />
                <Paragraph strong style={{ marginBottom: 8 }}>
                  {t('sys.matrix.title')}
                </Paragraph>
                <Paragraph type="secondary" style={{ marginTop: 0 }}>
                  <Space size={12} wrap>
                    {(['operate', 'view', 'none'] as PermLevel[]).map((lv) => (
                      <span key={lv}>
                        <Tag color={LEVEL_META[lv].color}>{levelLabel(lv)}</Tag>
                        {t(`sys.level.${lv}.hint`)}
                      </span>
                    ))}
                  </Space>
                </Paragraph>
                <Paragraph type="secondary">{lang === 'en' ? 'Dashboard read-only access allows viewing only. Export dashboard data requires separate permission.' : '管理看板只读仅允许查看，下载看板数据需单独授权。'}</Paragraph>
                <Table
                  rowKey="key"
                  size="small"
                  columns={matrixColumns}
                  dataSource={matrixData}
                  pagination={{
                    showTotal: (n) => t('common.total', { n }),
                    showSizeChanger: true,
                    defaultPageSize: 20,
                    pageSizeOptions: ['20', '50', '100']
                  }}
                  bordered
                  scroll={{ x: 150 + roles.length * 130 }}
                />
              </div>
            ),
          },
          {
            key: 'accounts',
            label: t('sys.tab.accounts'),
            children: (
              <div>
                {canEditAcc && (
                  <div style={{ marginBottom: 12, textAlign: 'right' }}>
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => openAcc()}>
                      {t('sys.acc.add')}
                    </Button>
                  </div>
                )}
                <Table
                  rowKey="id"
                  columns={accColumns}
                  dataSource={accounts}
                  scroll={{ x: 1200 }}
                  pagination={{
                    showTotal: (n) => t('common.total', { n }),
                    showSizeChanger: true,
                    defaultPageSize: 10,
                    pageSizeOptions: ['10', '20', '50', '100']
                  }}
                />
              </div>
            ),
          },
          {
            key: 'logs',
            label: t('sys.tab.logs'),
            children: (
              <Table
                rowKey="id"
                size="small"
                columns={logColumns}
                dataSource={logs}
                scroll={{ x: 900 }}
                pagination={{
                  showTotal: (n) => t('common.total', { n }),
                  showSizeChanger: true,
                  defaultPageSize: 10,
                  pageSizeOptions: ['10', '20', '50', '100']
                }}
              />
            ),
          },
        ]}
      />

      {/* 新增 / 编辑角色权限 */}
      <Modal
        open={!!roleModal}
        title={roleModal?.mode === 'create' ? t('sys.addRole') : `${t('sys.editRole')} · ${draftName}`}
        onCancel={() => setRoleModal(null)}
        onOk={saveRole}
        okText={t('common.save')}
        cancelText={t('common.cancel')}
        width={580}
        destroyOnClose
      >
        {roleModal && (
            <div style={{ marginTop: 8 }}>
            <div style={{ marginBottom: 8 }}>
              <Text strong><span style={{ color: '#ff4d4f', marginRight: 4 }}>*</span>{t('sys.role.col.name')}</Text>
            </div>
            <Input
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              placeholder={t('sys.role.namePlaceholder')}
              maxLength={20}
            />
            <div style={{ margin: '12px 0 8px' }}>
              <Text strong>{t('sys.role.col.desc')}</Text>
            </div>
            <Input
              value={draftDesc}
              onChange={(e) => setDraftDesc(e.target.value)}
              placeholder={t('sys.role.descPlaceholder')}
            />
            <div style={{ margin: '16px 0 8px' }}>
              <Text strong>{t('sys.scopeLabel')}</Text>
              <Tooltip title={t('sys.scopeTip')}>
                <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>?</Text>
              </Tooltip>
            </div>
            <Radio.Group
              value={draftScope}
              onChange={(e) => setDraftScope(e.target.value)}
              options={(['all', 'line'] as DataScope[]).map((sc) => ({ label: scopeLabel(sc), value: sc }))}
              optionType="button"
            />
            <Table
              style={{ marginTop: 16 }}
              size="small"
              rowKey="key"
              scroll={{ y: 400 }}
              pagination={{
                showTotal: (n) => t('common.total', { n }),
                showSizeChanger: true,
                defaultPageSize: 10,
                pageSizeOptions: ['10', '20', '50']
              }}
              dataSource={matrixData.filter((m) => {
                return m.ancestors.every((parent) => parent === 'managementDashboard' ? ['view','operate'].includes(draftPerms[parent]) : draftPerms[parent] === 'operate')
              })}
              columns={[
                { title: t('sys.module'), dataIndex: 'key', render: (m: ModuleKey, row: ModuleRow) => {
                  const isSub = row.depth > 0
                  const p3 = isPhase3(m)
                  return (
                    <span style={{ marginLeft: row.depth * 16, color: p3 ? '#bfbfbf' : (isSub ? '#8c8c8c' : 'inherit') }}>
                    {isSub ? `└ ${moduleLabel(m)}` : moduleLabel(m)}
                      {p3 && !isSub && <Tag color="default" style={{ marginLeft: 6, transform: 'scale(0.8)', color: '#8c8c8c' }}>{t('app.phase3')}</Tag>}
                    </span>
                  )
                } },
                {
                  title: t('sys.permission'),
                  key: 'lv',
                  width: 280,
                  render: (_, row: ModuleRow) => {
                    const isAction = row.key.includes('_')
                    return (
                      <Radio.Group
                        size="small"
                        value={draftPerms[row.key] ?? 'none'}
                        onChange={(e) => {
                          const val = e.target.value
                          setDraftPerms((prev) => {
                            const next = { ...prev, [row.key]: val }
                            // 模块未处于可操作状态时，其下所有层级的权限均不可见且重置。
                            if (!isAction && (row.key === 'managementDashboard' ? val === 'none' : val !== 'operate')) {
                              descendantsOf(row.key).forEach((child) => (next[child] = 'none'))
                            }
                            return next
                          })
                        }}
                        optionType="button"
                        options={(row.key === 'managementDashboard' ? ['none', 'view'] : isAction ? ['none', 'operate'] : ['none', 'view', 'operate'] as PermLevel[]).map((lv) => ({
                          label: levelLabel(lv as PermLevel),
                          value: lv,
                        }))}
                      />
                    )
                  },
                },
              ]}
            />
          </div>
        )}
      </Modal>

      {/* 新增 / 编辑成员 */}
      <Modal
        open={accOpen}
        afterOpenChange={populateAcc}
        title={accEditing ? t('sys.acc.edit') : t('sys.acc.add')}
        onCancel={() => setAccOpen(false)}
        onOk={submitAcc}
        okText={t('common.save')}
        cancelText={t('common.cancel')}
        destroyOnClose
      >
        <Form form={form} layout="vertical" preserve={false} style={{ marginTop: 12 }}>
          <Form.Item
            name="name"
            label={t('sys.acc.col.name')}
            rules={[{ required: true, message: t('common.pleaseSelect') }]}
          >
            <Input placeholder={t('sys.acc.namePlaceholder')} />
          </Form.Item>
          <Form.Item
            name="email"
            label={t('sys.acc.col.email')}
            rules={[
              { required: true, message: t('common.pleaseSelect') },
              { type: 'email', message: t('sys.acc.emailInvalid') },
            ]}
          >
            <Input placeholder="name@dinoai.ai" />
          </Form.Item>
          <Form.Item
            name="roleId"
            label={t('sys.acc.col.role')}
            rules={[{ required: true, message: t('common.pleaseSelect') }]}
          >
            <Select
              placeholder={t('common.pleaseSelect')}
              onChange={() => form.setFieldsValue({ businessLines: undefined })}
              options={roles.map((r) => ({ label: r.name, value: r.id }))}
            />
          </Form.Item>
          <Form.Item
            name="businessLines"
            label={t('sys.acc.col.scope')}
            tooltip={t('sys.scopeTip')}
            rules={
              watchRoleScope === 'line'
                ? [{ required: true, message: t('common.pleaseSelect') }]
                : []
            }
          >
            <Select
              mode="multiple"
              allowClear
              disabled={watchRoleScope === 'all'}
              placeholder={watchRoleScope === 'all' ? t('sys.scope.all') : t('common.pleaseSelect')}
              options={lines.map((l) => ({ label: l, value: l }))}
            />
          </Form.Item>
          <Form.Item name="isSalesMember" label={phase5 ? (lang === 'en' ? 'Frontline sales (CC)' : '是否为一线销售（CC）') : '销售成员'} valuePropName="checked" extra={phase5 ? undefined : '开启后纳入五期 CC 筛选的在职销售列表；接收分配还需启用账号、销售操作权限及对应业务线权限。'}><Switch checkedChildren={lang === 'en' ? 'Yes' : '是'} unCheckedChildren={lang === 'en' ? 'No' : '否'} /></Form.Item>
          {!phase5 && <Form.Item name="status" label={t('sys.acc.col.status')} valuePropName="checked">
            <Switch
              checkedChildren={t('sys.status.enabled')}
              unCheckedChildren={t('sys.status.disabled')}
            />
          </Form.Item>}
        </Form>
      </Modal>
    </Card>
  )
}
