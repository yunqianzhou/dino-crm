import { Card, Empty, Table } from 'antd'
import type { CohortRow } from '../dashboardData'
import { useDashboardText } from '../dashboardText'

type Props = {
  title: string
  help: string
  rowTitle: string
  rows: CohortRow[]
  sources: string[]
  rowName: (row: CohortRow) => string
  sourceName: (source: string) => string
  onOpen: (row: CohortRow) => void
}

export default function DashboardCohortMatrix({ title, help, rowTitle, rows, sources, rowName, sourceName, onOpen }: Props) {
  const d = useDashboardText()
  const cell = (row?: CohortRow) => row
    ? <button className="dashboard-count" onClick={() => onOpen(row)} aria-label={`${title} · ${rowName(row)} · ${row.metrics.leads.length}`}>{row.metrics.leads.length}</button>
    : <span className="dashboard-zero">0</span>
  return <Card title={title} className="dashboard-source-matrix">
    <p className="dashboard-help">{help}</p>
    <Table rowKey="id" size="small" dataSource={rows} expandable={{ childrenColumnName: '__matrixChildren' }} scroll={{ x: 250 + sources.length * 125 }} pagination={rows.length > 7 ? { pageSize: 7, showSizeChanger: false } : false} locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={d('noRows')} /> }} columns={[
      { title: rowTitle, width: 150, fixed: 'left', render: (_, row) => rowName(row) },
      { title: d('currentTotal'), width: 100, render: (_, row) => cell(row) },
      ...sources.map(source => ({ title: <span title={sourceName(source)}>{sourceName(source)}</span>, key: source, width: 125, ellipsis: true, render: (_: unknown, row: CohortRow) => cell(row.children?.find(child => child.value === source)) })),
    ]} summary={() => rows.length ? <Table.Summary.Row>
      <Table.Summary.Cell index={0}><strong>{d('currentTotal')}</strong></Table.Summary.Cell>
      <Table.Summary.Cell index={1}>{rows.reduce((sum, row) => sum + row.metrics.leads.length, 0)}</Table.Summary.Cell>
      {sources.map((source, index) => <Table.Summary.Cell key={source} index={index + 2}>{rows.reduce((sum, row) => sum + (row.children?.find(child => child.value === source)?.metrics.leads.length || 0), 0)}</Table.Summary.Cell>)}
    </Table.Summary.Row> : null} />
  </Card>
}
