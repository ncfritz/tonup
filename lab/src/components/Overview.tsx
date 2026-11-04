'use client';

import { Alert, Card, Col, Descriptions, Layout, Row, Statistic, Tag, Typography } from 'antd';

import type { LabStatus } from '~/lib/status';

/** Overview. L0 shows that Lab runs, where its data lives, and that shared scoring works. */
export function Overview({ status }: { status: LabStatus }) {
  return (
    <>
      <Layout.Header
        style={{
          background: '#fff',
          borderBottom: '1px solid #f0f0f0',
          height: 'auto',
          lineHeight: 1.4,
          padding: '12px 24px',
        }}
      >
        <Typography.Title level={4} style={{ margin: 0 }}>
          Overview
        </Typography.Title>
        <Typography.Text type="secondary">
          How close the model is to shipping, and what the dataset still needs
        </Typography.Text>
      </Layout.Header>
      <Layout.Content style={{ padding: 24, maxWidth: 1240, width: '100%' }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} md={8}>
            <Card>
              <Statistic title="Sessions" value={status.sessions} />
            </Card>
          </Col>
          <Col xs={24} md={8}>
            <Card>
              <Statistic title="Active model" value={status.activeModel ?? 'None yet'} />
            </Card>
          </Col>
          <Col xs={24} md={8}>
            <Card>
              <Statistic
                title="Shared scoring self-check"
                value={status.scoring.got}
                suffix={
                  status.scoring.ok ? (
                    <Tag color="success">matches {status.scoring.expected}</Tag>
                  ) : (
                    <Tag color="error">expected {status.scoring.expected}</Tag>
                  )
                }
              />
            </Card>
          </Col>
          <Col span={24}>
            <Card title="Lab">
              <Descriptions column={1} size="small">
                <Descriptions.Item label="Version">{status.version}</Descriptions.Item>
                <Descriptions.Item label="Data folder">{status.dataDir}</Descriptions.Item>
                <Descriptions.Item label="Health check">/api/health</Descriptions.Item>
              </Descriptions>
            </Card>
          </Col>
          <Col span={24}>
            <Alert
              type="info"
              showIcon
              title="Captures, runs and models arrive in L1 to L4"
              description="See docs/plan/capture-lab.md for the milestones."
            />
          </Col>
        </Row>
      </Layout.Content>
    </>
  );
}
