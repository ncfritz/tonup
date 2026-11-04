'use client';

import { Flex, Layout, Typography } from 'antd';
import type { ReactNode } from 'react';

export function PageHeader({
  title,
  subtitle,
  breadcrumb,
  extra,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  breadcrumb?: ReactNode;
  extra?: ReactNode;
}) {
  return (
    <Layout.Header
      style={{
        background: '#fff',
        borderBottom: '1px solid #f0f0f0',
        height: 'auto',
        lineHeight: 1.4,
        padding: '12px 24px',
      }}
    >
      <Flex wrap justify="space-between" align="center" gap={12}>
        <div>
          {breadcrumb ? <Typography.Text type="secondary">{breadcrumb}</Typography.Text> : null}
          <Typography.Title level={4} style={{ margin: 0 }}>
            {title}
          </Typography.Title>
          {subtitle ? <Typography.Text type="secondary">{subtitle}</Typography.Text> : null}
        </div>
        {extra}
      </Flex>
    </Layout.Header>
  );
}

export function PageBody({ children }: { children: ReactNode }) {
  return (
    <Layout.Content style={{ padding: 24, maxWidth: 1240, width: '100%', boxSizing: 'border-box' }}>
      {children}
    </Layout.Content>
  );
}
