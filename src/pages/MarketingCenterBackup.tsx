import { Button, Card, Col, Divider, Row, Table, Tag, Typography } from 'antd'
import { HistoryOutlined, SafetyCertificateOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useI18n } from '../i18n'

const { Title, Paragraph, Text } = Typography

export default function MarketingCenterBackup() {
  const navigate = useNavigate()
  const { lang } = useI18n()
  const en = lang === 'en'
  const roleSnapshot = [
    { id: 'role_growth', zh: '市场投放 / 增长', en: 'Growth / Acquisition', scope: 'line', permission: 'operate' },
    { id: 'role_ops', zh: '运营 / 商业化', en: 'Operations / Monetization', scope: 'line', permission: 'operate' },
    { id: 'role_support', zh: '客服 / 用户支持', en: 'Customer Support', scope: 'line', permission: 'none' },
    { id: 'role_admin', zh: '超级管理员', en: 'Super Administrator', scope: 'all', permission: 'operate' },
    { id: 'role_sales_leader', zh: '销售组长', en: 'Sales Lead', scope: 'line', permission: 'none' },
  ]
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
        dataSource={roleSnapshot}
        columns={[
          { title: en ? 'Role' : '角色', render: (_, r) => en ? r.en : r.zh },
          { title: en ? 'Data scope' : '数据范围', dataIndex: 'scope', render: (v) => <Tag>{v === 'all' ? (en ? 'All lines' : '全部业务线') : (en ? 'Assigned lines' : '指定业务线')}</Tag> },
          { title: en ? 'Legacy marketing center' : '旧营销中心', dataIndex: 'permission', render: (v) => <Tag color={v === 'operate' ? 'green' : 'default'}>{v === 'operate' ? (en ? 'Operate' : '可操作') : (en ? 'No access' : '无权限')}</Tag> },
        ]}
      />
    </Card>
  )
}
