'use client';

import {
  CameraOutlined,
  CheckCircleOutlined,
  DashboardOutlined,
  ExperimentOutlined,
  FolderOpenOutlined,
  DeploymentUnitOutlined,
} from '@ant-design/icons';
import { App, ConfigProvider, Layout, Menu, Typography } from 'antd';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

// Ant Design with Ton Up's teal (the Training theme's light accent) as the primary colour, and
// the classic dark sider (the mockups on the "Ton Up Lab — Mockups" canvas).
const PRIMARY = '#0F766E';

const NAV = [
  { key: '/', icon: <DashboardOutlined />, label: 'Overview', ready: true },
  { key: '/captures', icon: <CameraOutlined />, label: 'Captures', ready: true },
  { key: '/sessions', icon: <FolderOpenOutlined />, label: 'Sessions', ready: true },
  { key: '/runs', icon: <ExperimentOutlined />, label: 'Runs', ready: true },
  { key: '/models', icon: <DeploymentUnitOutlined />, label: 'Models', ready: true },
  { key: '/verification', icon: <CheckCircleOutlined />, label: 'Verification', ready: true },
];

export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const selected = NAV.find((n) => n.key !== '/' && pathname.startsWith(n.key))?.key ?? '/';
  return (
    <ConfigProvider theme={{ token: { colorPrimary: PRIMARY, colorLink: PRIMARY } }}>
      <App>
        <Layout style={{ minHeight: '100vh' }}>
          <Layout.Sider
            breakpoint="md"
            collapsedWidth={0}
            width={216}
            zeroWidthTriggerStyle={{ top: 104 }}
          >
            <div
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '24px 24px 20px' }}
            >
              <span
                aria-hidden
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  background: PRIMARY,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <span style={{ width: 10, height: 10, borderRadius: 5, background: '#fff' }} />
              </span>
              <Typography.Text strong style={{ color: '#fff', fontSize: 16 }}>
                Ton Up Lab
              </Typography.Text>
            </div>
            <Menu
              theme="dark"
              mode="inline"
              selectedKeys={[selected]}
              items={NAV.map((n) => ({
                key: n.key,
                icon: n.icon,
                disabled: !n.ready,
                label: n.ready ? <Link href={n.key}>{n.label}</Link> : n.label,
              }))}
            />
          </Layout.Sider>
          <Layout>{children}</Layout>
        </Layout>
      </App>
    </ConfigProvider>
  );
}
