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
  Typography,
  message,
} from 'antd'
import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  SafetyOutlined,
  SearchOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { uid } from '../store'
import { updateMemberGroups6, addLog6 as addLog, disableAccount6 as disableAccountAndReallocate, setState6 as setState, useStore6 as useStore, type DataGrant6, type Account6 as Account, type Role6 as Role, type ModuleKey6 as ModuleKey } from '../phase6'
import TeamManagement6 from '../components/TeamManagement6'
import { DataGrantsEditor6 } from '../components/DataGrants6'
import { BUSINESS_LINES } from '../types'
import type { AuditLog, PermLevel } from '../types'
import { useI18n } from '../i18n'
import { usePerm6 } from '../perm6'

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
  { key: 'salesV3', children: [{ key: 'salesV5_batch_assign' }, { key: 'salesV3_claim' }, { key: 'salesV3_dial' }, { key: 'salesV3_update' }, { key: 'salesV3_reassign' }, { key: 'salesV6_handoff' }, { key: 'salesV3_config' }, { key: 'salesV6_config_line' }, { key: 'salesV6_config_members' }, { key: 'salesV3_import_leads' }, { key: 'salesV3_view_report' }, { key: 'salesV3_view_replay' }] },
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

export default function SystemConfig6() {
  const phase5 = true
  const { t, lang } = useI18n()
  const { can, actor } = usePerm6()
  const canEditRoles = can('system') === 'operate' || can('system_role_edit') === 'operate'
  const canAddRoles = can('system') === 'operate' || can('system_role_add') === 'operate'
  const canDeleteRoles = can('system') === 'operate' || can('system_role_delete') === 'operate'

  const canEditAcc = can('system') === 'operate' || can('system_acc_edit') === 'operate'
  const canAddAcc = can('system') === 'operate' || can('system_acc_add') === 'operate'
  const roles = useStore((s) => s.roles)
  const accounts = useStore((s) => s.accounts)
  const logs = useStore((s) => s.logs)
  const teams = useStore(s => s.teams)

  const moduleLabel = (m: ModuleKey) => {
    if (m === 'salesV3_config') return '查看分配与掉库设置'
    if (m === 'salesV6_config_line') return '修改业务线分配与掉库规则'
    if (m === 'salesV6_config_members') return '修改授权组内成员权重及休息日'
    if (m === 'salesV6_handoff') return lang === 'en' ? 'TMK handoff to sales (own leads)' : 'TMK 转交销售（本人线索）'
    if (m === 'managementDashboard_export') return lang === 'en' ? 'Export dashboard data' : '下载看板数据'
    if (m === 'managementDashboard') return lang === 'en' ? 'Management Dashboard (Phase 5)' : '管理看板（五期）'
    if (m === 'salesV5_batch_assign') return lang === 'en' ? 'Batch assign leads' : '批量分配线索'
    if (m === 'appABTest') return lang === 'en' ? 'APP A/B test (Archived)' : 'APP A/B test配置（已归档）'
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
    if (m === 'salesV3') return phase5 ? `${t('app.nav.sales')}（${lang === 'en' ? 'Phase 6' : '六期'}）` : t('app.nav.sales')
    return m.includes('_') ? t(`perm.${m}`) : t(`app.nav.${m}`)
  }
  const levelLabel = (lv: PermLevel) => t(`sys.level.${lv}`)
  const roleName = (id: string) => roles.find((r) => r.id === id)?.name ?? id

  // ---------- 角色权限新增 / 编辑 ----------
  const [roleModal, setRoleModal] = useState<RoleModal>(null)
  const [draftName, setDraftName] = useState('')
  const [draftDesc, setDraftDesc] = useState('')
  const [draftPerms, setDraftPerms] = useState<Record<ModuleKey, PermLevel>>(EMPTY_PERMS())

  const openCreateRole = () => {
    setDraftName('')
    setDraftDesc('')
    setDraftPerms(EMPTY_PERMS())
    setRoleModal({ mode: 'create' })
  }
  const openEditRole = (r: Role) => {
    setDraftName(r.name)
    setDraftDesc(r.desc)
    setDraftPerms({ ...r.perms })
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
            ? { ...r, name: draftName.trim(), desc: draftDesc.trim(), perms: draftPerms }
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
  const emptyAccountFilters = { keyword: '', line: undefined as string | undefined, groupId: undefined as string | undefined, roleId: undefined as string | undefined, status: undefined as Account['status'] | undefined }
  const [accountDraft, setAccountDraft] = useState(emptyAccountFilters)
  const [accountFilters, setAccountFilters] = useState(emptyAccountFilters)
  const [accountPage, setAccountPage] = useState(1)
  const [accountPageSize, setAccountPageSize] = useState(10)
  const filteredAccounts = useMemo(() => {
    const keyword = accountFilters.keyword.trim().toLocaleLowerCase()
    return accounts.filter(a =>
      (!keyword || a.email.toLocaleLowerCase().includes(keyword) || a.name.toLocaleLowerCase().includes(keyword)) &&
      (!accountFilters.line || a.dataGrants.some(g => g.line === accountFilters.line)) &&
      (!accountFilters.groupId || teams.some(group => group.id === accountFilters.groupId && group.line === accountFilters.line && group.memberIds.includes(a.id))) &&
      (!accountFilters.roleId || a.roleId === accountFilters.roleId) &&
      (!accountFilters.status || a.status === accountFilters.status),
    )
  }, [accounts, teams, accountFilters])
  const searchAccounts = () => { setAccountFilters({ ...accountDraft }); setAccountPage(1) }
  const resetAccountFilters = () => { setAccountDraft(emptyAccountFilters); setAccountFilters(emptyAccountFilters); setAccountPage(1) }
  const [accEditing, setAccEditing] = useState<Account | null>(null)
  const [accOpen, setAccOpen] = useState(false)
  const [form] = Form.useForm()

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
        staffKind: a.staffKind,
        dataGrants: structuredClone(a.dataGrants),
        memberGroupIds: teams.filter(group => group.memberIds.includes(a.id)).map(group => group.id),
        ...(!phase5 ? { status: a.status === '启用' } : {}),
      })
    } else {
      form.setFieldsValue({ staffKind: 'other', memberGroupIds: [], dataGrants: [{ line: '', scope: 'self', teamIds: [] }], ...(!phase5 ? { status: true } : {}) })
    }
  }
  const submitAcc = async () => {
    const v = await form.validateFields()
    if (!canEditAcc && accEditing || !canAddAcc && !accEditing) return
    if (accounts.some(a => a.id !== accEditing?.id && a.email.toLowerCase() === v.email.trim().toLowerCase())) { message.error('邮箱已存在'); return }
    const grants: DataGrant6[] = (v.dataGrants || []).map((g: DataGrant6) => ({ ...g, teamIds: g.scope === 'teams' ? g.teamIds || [] : [] }))
    if (!grants.length || new Set(grants.map(g => g.line)).size !== grants.length) { message.error('每条业务线只能配置一次数据范围'); return }
    for (const grant of grants) {
      if (!['self', 'teams', 'line'].includes(grant.scope)) { message.error('请选择数据范围'); return }
      if (grant.scope === 'teams' && (!grant.teamIds.length || grant.teamIds.some(id => !teams.some(t => t.id === id && t.line === grant.line)))) { message.error(`${grant.line}：请选择该业务线内可访问的组`); return }
    }


    const next: Account = {
      id: accEditing?.id ?? uid('acc_'),
      email: v.email,
      name: v.name,
      roleId: v.roleId,
      businessLines: grants.map(g => g.line),
      dataGrants: grants,
      status: phase5 ? accEditing?.status ?? '启用' : v.status ? '启用' : '停用',
      isSalesMember: v.staffKind === 'CC',
      staffKind: v.staffKind,
      salesLead: accEditing?.salesLead,
      lastLogin: accEditing?.lastLogin,
      outboundSeatBound: accEditing?.outboundSeatBound || false,
      outboundBindings: accEditing?.outboundBindings,
    }
    let nextTeams
    try { nextTeams = updateMemberGroups6(teams, next.id, v.memberGroupIds || [], next.businessLines) }
    catch (error) { message.error((error as Error).message); return }
    setState((prev) => ({
      ...prev,
      teams: nextTeams,
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
              <li>六期原型保留已有客户归属，请先安排交接。</li>
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
  const [expandedAccountScopes, setExpandedAccountScopes] = useState<string[]>([])
  const toggleOutboundBound = (a: Account) => setBindingAccount(a)

  const accColumns: ColumnsType<Account> = [
    { title: t('sys.acc.col.name'), dataIndex: 'name', width: 140 },
    { title: t('sys.acc.col.email'), dataIndex: 'email', width: 220 },
    { title: '人员类型', dataIndex: 'staffKind', width: 110, render: (v: string) => <Tag color={v === 'CC' ? 'blue' : v === 'TMK' ? 'purple' : 'default'}>{v === 'other' ? '其他' : v}</Tag> },
    { title: lang === 'en' ? 'Business lines / Data access' : '业务线 / 数据权限', key: 'dataAccess', width: 280, render: (_, account) => {
      const expanded = expandedAccountScopes.includes(account.id)
      // Keep the selected business line visible even when the account spans many lines.
      const grants = [...account.dataGrants].sort((a, b) => Number(b.line === accountFilters.line) - Number(a.line === accountFilters.line))
      if (!grants.length) return <Text type="secondary">—</Text>
      return <Space direction="vertical" size={8}>
        {(expanded ? grants : grants.slice(0, 2)).map(grant => {
          const memberGroups = teams.filter(group => group.line === grant.line && group.memberIds.includes(account.id))
          const accessMatchesMembership = grant.teamIds.length > 0 && grant.teamIds.length === memberGroups.length && memberGroups.every(group => grant.teamIds.includes(group.id))
          const scope = grant.scope === 'self' ? (lang === 'en' ? 'Own data only' : '仅本人数据') : grant.scope === 'line' ? (lang === 'en' ? 'All data' : '全部数据') : (lang === 'en' ? 'Specified groups' : '指定组数据')
          const groupNames = (ids: string[]) => ids.map(id => {
            const group = teams.find(item => item.id === id && item.line === grant.line)
            return group ? `${group.name}${group.enabled ? '' : lang === 'en' ? ' (Disabled)' : '（停用）'}` : lang === 'en' ? 'Unavailable group' : '已失效组'
          }).join('、')
          return <div key={grant.line}>
            <div>{grant.line} · {scope}</div>
            {grant.scope === 'teams' && !accessMatchesMembership && <Text type="secondary" style={{ display: 'block', fontSize: 12 }}>{lang === 'en' ? 'Access: ' : '可查看：'}{groupNames(grant.teamIds) || (lang === 'en' ? 'No groups selected' : '未指定组')}</Text>}
            {!!memberGroups.length && <Text type="secondary" style={{ display: 'block', fontSize: 12 }}>{lang === 'en' ? 'Member of: ' : '所属组：'}{groupNames(memberGroups.map(group => group.id))}</Text>}
          </div>
        })}
        {grants.length > 2 && <Button type="link" size="small" style={{ padding: 0, height: 'auto' }} onClick={() => setExpandedAccountScopes(ids => expanded ? ids.filter(id => id !== account.id) : [...ids, account.id])}>{expanded ? (lang === 'en' ? 'Collapse' : '收起') : (lang === 'en' ? `Show ${grants.length - 2} more lines` : `展开其余 ${grants.length - 2} 条业务线`)}</Button>}
      </Space>
    } },
    {
      title: lang === 'en' ? 'Function role' : '功能角色',
      dataIndex: 'roleId',
      width: 170,
      render: (v) => <Tag color="geekblue">{roleName(v)}</Tag>,
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
          {t('sys.title')}{phase5 ? (lang === 'en' ? ' · Phase 6' : ' · 六期') : ''}
        </span>
      }
    >
      <div style={{ marginBottom: 12 }}>
        <Text type="secondary">{phase5 ? (lang === 'en' ? 'Roles control permissions. Mark frontline sales (CC) in member accounts; CCs may add up to 3 membership days per operation in both centers.' : '成员按业务线配置可访问的数据范围；角色仅配置功能权限，授权不依赖岗位或职级。六期配置独立保存，供设计评审。') : t('sys.intro')}</Text>
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
                        {lv === 'view' ? (lang === 'en' ? 'View only' : '仅查看') : t(`sys.level.${lv}.hint`)}
                      </span>
                    ))}
                  </Space>
                </Paragraph>
                <Paragraph type="secondary">{lang === 'en' ? 'Dashboard read-only access allows viewing only. Export dashboard data requires separate permission.' : '功能权限与成员数据范围共同生效；只读不包含导出，导出需单独授权。'}</Paragraph>
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
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: 16, marginBottom: 16, border: '1px solid #e5e7eb', borderRadius: 8 }}>
                  <Space wrap size={12}>
                    <Input allowClear prefix={<SearchOutlined style={{ color: '#9ca3af' }} />} style={{ width: 300, maxWidth: '100%' }} aria-label={lang === 'en' ? 'Search email or nickname' : '按邮箱 / 昵称搜索'} placeholder={lang === 'en' ? 'Search email / nickname' : '按邮箱 / 昵称搜索'} value={accountDraft.keyword} onChange={e => setAccountDraft(prev => ({ ...prev, keyword: e.target.value }))} onPressEnter={searchAccounts} />
                    <Select allowClear showSearch optionFilterProp="label" style={{ width: 160 }} aria-label={lang === 'en' ? 'Filter by business line' : '筛选业务线'} placeholder={lang === 'en' ? 'All business lines' : '全部业务线'} value={accountDraft.line} onChange={line => setAccountDraft(prev => ({ ...prev, line, groupId: undefined }))} options={BUSINESS_LINES.map(line => ({ value: line, label: line }))} />
                    <Select allowClear showSearch optionFilterProp="label" style={{ width: 200 }} aria-label={lang === 'en' ? 'Filter by data group' : '筛选数据分组'} placeholder={!accountDraft.line ? (lang === 'en' ? 'Select a business line first' : '请先选择业务线') : (lang === 'en' ? 'All data groups' : '全部数据分组')} disabled={!accountDraft.line} value={accountDraft.groupId} onChange={groupId => setAccountDraft(prev => ({ ...prev, groupId }))} options={teams.filter(group => group.line === accountDraft.line).map(group => ({ value: group.id, label: `${group.name}${group.enabled ? '' : lang === 'en' ? ' (Disabled)' : '（停用）'}` }))} />
                    <Select allowClear showSearch optionFilterProp="label" style={{ width: 200 }} aria-label={lang === 'en' ? 'Filter by role' : '筛选角色'} placeholder={lang === 'en' ? 'All roles' : '全部角色'} value={accountDraft.roleId} onChange={roleId => setAccountDraft(prev => ({ ...prev, roleId }))} options={roles.map(role => ({ value: role.id, label: role.name }))} />
                    <Select allowClear style={{ width: 160 }} aria-label={lang === 'en' ? 'Filter by status' : '筛选状态'} placeholder={lang === 'en' ? 'All statuses' : '全部状态'} value={accountDraft.status} onChange={status => setAccountDraft(prev => ({ ...prev, status }))} options={(['启用', '停用'] as const).map(status => ({ value: status, label: lang === 'en' ? (status === '启用' ? 'Enabled' : 'Disabled') : status }))} />
                    <Button type="primary" icon={<SearchOutlined />} onClick={searchAccounts}>{lang === 'en' ? 'Search' : '搜索'}</Button>
                    <Button onClick={resetAccountFilters}>{lang === 'en' ? 'Reset' : '重置'}</Button>
                  </Space>
                  {canAddAcc && <Button type="primary" icon={<PlusOutlined />} onClick={() => openAcc()}>{t('sys.acc.add')}</Button>}
                </div>
                <Table
                  rowKey="id"
                  columns={accColumns}
                  dataSource={filteredAccounts}
                  locale={{ emptyText: lang === 'en' ? 'No matching members. Try different filters.' : '暂无匹配成员，请调整搜索条件' }}
                  scroll={{ x: 1200 }}
                  pagination={{
                    showTotal: (n) => t('common.total', { n }),
                    showSizeChanger: true,
                    current: Math.min(accountPage, Math.max(1, Math.ceil(filteredAccounts.length / accountPageSize))),
                    pageSize: accountPageSize,
                    onChange: (page, pageSize) => { setAccountPage(pageSize === accountPageSize ? page : 1); setAccountPageSize(pageSize) },
                    pageSizeOptions: ['10', '20', '50', '100']
                  }}
                />
              </div>
            ),
          },
          { key: 'teams', label: '数据分组', children: <TeamManagement6 editable={canEditAcc} actor={actor} /> },
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
            <Paragraph type="secondary" style={{ marginTop: 16 }}>角色仅配置可用功能；数据范围由成员账号中的业务线及数据范围决定。</Paragraph>
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
        width={760}
        styles={{ body: { maxHeight: '72vh', overflowY: 'auto', paddingRight: 8 } }}
        afterOpenChange={populateAcc}
        title={accEditing ? t('sys.acc.edit') : t('sys.acc.add')}
        onCancel={() => setAccOpen(false)}
        onOk={submitAcc}
        okText={t('common.save')}
        cancelText={t('common.cancel')}
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
          <Typography.Title level={5}>基本信息</Typography.Title>
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
          <Form.Item name="staffKind" label="人员类型" rules={[{ required: true }]}><Radio.Group options={[{ value: 'CC', label: '一线销售（CC）' }, { value: 'TMK', label: 'TMK' }, { value: 'other', label: '其他' }]} /></Form.Item>
          <Typography.Title level={5}>权限配置</Typography.Title>
          <Form.Item name="roleId" label="功能角色" rules={[{ required: true, message: '请选择功能角色' }]}><Select placeholder="请选择功能角色" options={roles.map(r => ({ label: r.name, value: r.id }))} /></Form.Item>
          <div style={{ marginBottom: 8 }}><Text strong>业务线 / 数据范围</Text></div>
          <DataGrantsEditor6 teams={teams} />
          <Form.Item noStyle shouldUpdate={(previous, current) => previous.dataGrants !== current.dataGrants || previous.memberGroupIds !== current.memberGroupIds}>
            {() => {
              const lines = (form.getFieldValue('dataGrants') || []).map((g: DataGrant6) => g.line)
              const selected: string[] = form.getFieldValue('memberGroupIds') || []
              return <Form.Item name="memberGroupIds" label="所属组" style={{ marginTop: 16 }} extra="用于成员归属；可查看的数据按上方数据范围配置。" rules={[{ validator: async (_, ids: string[]) => { updateMemberGroups6(teams, accEditing?.id || '', ids || [], lines) } }]}>
                <Select mode="multiple" placeholder="选择所属组，可多选" disabled={!lines.some(Boolean) && !selected.length} options={teams.filter(group => lines.includes(group.line) || selected.includes(group.id)).map(group => ({ value: group.id, label: `${group.line} · ${group.name}${group.enabled ? '' : '（停用）'}`, disabled: !lines.includes(group.line) || (!group.enabled && !group.memberIds.includes(accEditing?.id || '')) }))} />
              </Form.Item>
            }}
          </Form.Item>
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
