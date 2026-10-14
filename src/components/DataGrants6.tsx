import { Button, Form, Select } from 'antd'
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import { scopes6, type Scope6, type DataGrant6, type Team6 } from '../phase6'
import { BUSINESS_LINES } from '../types'

function TeamGrantRow6({ value, onChange, teams, usedLines, index, defaultScope }: { value?: DataGrant6; onChange?: (value: DataGrant6) => void; teams: Team6[]; usedLines: string[]; index: number; defaultScope: Scope6 }) {
  const grant = value || { line: '', scope: 'self', teamIds: [] }
  const lineTeams = teams.filter(t => t.line === grant.line)
  return <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
    <Select aria-label={`业务线${index + 1}`} value={grant.line || undefined} placeholder="选择业务线" style={{ width: 140 }} options={BUSINESS_LINES.map(line => ({ value: line, label: line, disabled: usedLines.includes(line) }))} onChange={line => onChange?.({ line, scope: defaultScope, teamIds: [] })} />
    <Select aria-label={`数据范围${index + 1}`} value={grant.line ? grant.scope : undefined} disabled={!grant.line} placeholder="选择数据范围" style={{ width: 170 }} options={Object.entries(scopes6).filter(([value]) => value !== 'teams' || lineTeams.some(t => t.enabled)).map(([value, label]) => ({ value, label }))} onChange={(scope: Scope6) => onChange?.({ ...grant, scope, teamIds: scope === 'teams' ? grant.teamIds : [] })} />
    {grant.scope === 'teams' && <Select aria-label={`指定组${index + 1}`} mode="multiple" value={grant.teamIds} disabled={!grant.line} placeholder="选择可访问的组，可多选" style={{ flex: 1, minWidth: 210 }} options={lineTeams.map(t => ({ value: t.id, label: t.name, disabled: !t.enabled }))} onChange={teamIds => onChange?.({ ...grant, teamIds })} />}

  </div>
}

export function DataGrantsEditor6({ teams }: { teams: Team6[] }) {
  const form = Form.useFormInstance()
  const grants = Form.useWatch('dataGrants', form) as DataGrant6[] | undefined
  const staffKind = Form.useWatch('staffKind', form)
  // Only new business-line selections use this default. Existing grants stay untouched.
  const defaultScope: Scope6 = staffKind === 'other' ? 'line' : 'self'
  return <Form.List name="dataGrants" rules={[{ validator: async (_, values) => { if (!values?.length) throw new Error('请至少配置一条业务线及数据范围') } }]}>
    {(fields, { add, remove }, { errors }) => <>
      {fields.map(field => <div key={field.key} style={{ display: 'flex', gap: 8, alignItems: 'start' }}>
        <Form.Item name={[field.name]} style={{ flex: 1, minWidth: 0, marginBottom: 12 }} rules={[{ validator: async (_, grant?: DataGrant6) => {
          if (!grant?.line) throw new Error('请选择业务线')
          if (!['self', 'teams', 'line'].includes(grant.scope)) throw new Error('请选择数据范围')
          if (grant.scope === 'teams' && !grant.teamIds?.length) throw new Error('请选择可访问的组')
          if (grant.scope === 'teams' && grant.teamIds.some(id => !teams.some(t => t.id === id && t.line === grant.line))) throw new Error('请重新选择该业务线内可访问的组')
        } }]}>
          <TeamGrantRow6 teams={teams} defaultScope={defaultScope} index={field.name} usedLines={(grants || []).filter((_, i) => i !== field.name).map(g => g.line)} />
        </Form.Item>
        <Button aria-label={`移除业务线${field.name + 1}`} icon={<DeleteOutlined />} onClick={() => remove(field.name)} />
      </div>)}
      <Button type="dashed" icon={<PlusOutlined />} onClick={() => add({ line: '', scope: defaultScope, teamIds: [] })} disabled={fields.length >= BUSINESS_LINES.length}>添加业务线</Button>
      <Form.ErrorList errors={errors} />
    </>}
  </Form.List>
}
