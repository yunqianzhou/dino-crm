import { Button, Card, Col, Divider, Row, Table, Tag, Typography } from 'antd'
import { HistoryOutlined, SafetyCertificateOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store'
import { useI18n } from '../i18n'

const { Title, Paragraph, Text } = Typography

export default function MarketingCenterBackup() {
  const navigate = useNavigate()
  const roles = useStore((s) => s.roles)
  const { lang } = useI18n()
  const en = lang === 'en'
  const legacyPages = [
    { path: '/channels', zh: '渠道管理', en: 'Channel management' },
    { path: '/landing', zh: '落地页管理', en: 'Landing page management' },
    { path: '/packages', zh: 'SKU 管理', en: 'SKU management' },
    { path: '/coupons', zh: '优惠券 / PromoCode', en: 'Coupons / PromoCode' },
  ]
  return (
    <Card>
      <Title level={4}><HistoryOutlined /> {en ? 'Marketing Center Backup' : '营销中心备份'}</Title>
      <Paragraph type="secondary">
        {en ? 'This is a read-only archive of the legacy marketing-center prototype and its role-permission setup. The source snapshot is tagged marketing-center-legacy-2026-09-02.' : '此处只读留存旧营销中心原型及当时的角色权限配置。代码快照已标记为 marketing-center-legacy-2026-09-02。'}
      </Paragraph>
      <Row gutter={[16, 16]}>
        {legacyPages.map((page) => (
          <Col xs={24} md={12} key={page.path}>
            <Card size="small" title={en ? page.en : page.zh} extra={<Tag>{en ? 'Legacy' : '旧版'}</Tag>}>
              <Text type="secondary">{en ? 'Open the preserved legacy page.' : '打开已保留的旧版页面。'}</Text>
              <br /><Button type="link" style={{ paddingLeft: 0 }} onClick={() => navigate(page.path)}>{en ? 'Open backup page' : '打开备份页面'}</Button>
            </Card>
          </Col>
        ))}
      </Row>
      <Divider />
      <Title level={5}><SafetyCertificateOutlined /> {en ? 'Role-permission snapshot' : '角色权限快照'}</Title>
      <Table
        size="small" rowKey="id" pagination={false}
        dataSource={roles}
        columns={[
          { title: en ? 'Role' : '角色', dataIndex: 'name' },
          { title: en ? 'Data scope' : '数据范围', dataIndex: 'dataScope', render: (v) => <Tag>{v === 'all' ? (en ? 'All lines' : '全部业务线') : (en ? 'Assigned lines' : '指定业务线')}</Tag> },
          { title: en ? 'Legacy marketing center' : '旧营销中心', render: (_, r) => <Tag color={r.perms.marketing === 'operate' ? 'green' : r.perms.marketing === 'view' ? 'blue' : 'default'}>{r.perms.marketing === 'operate' ? (en ? 'Operate' : '可操作') : r.perms.marketing === 'view' ? (en ? 'View' : '只读') : (en ? 'No access' : '无权限')}</Tag> },
        ]}
      />
    </Card>
  )
}
