'use client';

import {
  CameraOutlined,
  CheckCircleOutlined,
  DashboardOutlined,
  DeploymentUnitOutlined,
  DesktopOutlined,
  ExperimentOutlined,
  FolderOpenOutlined,
  HomeOutlined,
  MoonOutlined,
  SunOutlined,
} from '@ant-design/icons';
import { App, Breadcrumb, ConfigProvider, Layout, Menu, Space, theme, Tooltip } from 'antd';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';

import { HeaderBoard } from './HeaderBoard';
import { setColorMode, useColorMode, useDark, type ColorMode } from './colorMode';
import { PREF, PrefsContext, type InitialPrefs } from './prefs';
import styles from './Shell.module.css';

// Ant Design's own theme (its default and dark algorithms, no colour overrides), in Olympus's
// chrome (packages/console/src/shell): a navy header across the top, Olympus's breadcrumb bar
// under it, and the pages as a navy rail of icons that never opens (their names in tooltips).
/** Olympus's chrome navy: the header and the breadcrumb bar's end; the rail is a shade off it. */
const NAVY = '#001529';
const RAIL = '#041527';
const HEADER_HEIGHT = 56;
/** The rail's width, as Olympus's. */
const PAGES_RAIL = 80;

const NAV = [
  { key: '/', icon: <DashboardOutlined />, label: 'Overview' },
  { key: '/captures', icon: <CameraOutlined />, label: 'Captures' },
  { key: '/sessions', icon: <FolderOpenOutlined />, label: 'Sessions' },
  { key: '/runs', icon: <ExperimentOutlined />, label: 'Runs' },
  { key: '/models', icon: <DeploymentUnitOutlined />, label: 'Models' },
  { key: '/verification', icon: <CheckCircleOutlined />, label: 'Verification' },
];

/** The name over the header's board (mockups › Header C). */
function Wordmark() {
  return (
    <Link href="/" className={styles.wordmark} aria-label="Ton Up Lab, Overview">
      <span className={styles.name}>Ton Up Lab</span>
      <span className={styles.tagline}>Snap to score · training</span>
    </Link>
  );
}

function Chrome({ children }: { children: ReactNode }) {
  const { token } = theme.useToken();
  const pathname = usePathname();
  const selected = NAV.find((n) => n.key !== '/' && pathname.startsWith(n.key))?.key ?? '/';

  return (
    <Layout style={{ height: '100vh', overflow: 'hidden' }}>
      <Layout.Header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          height: HEADER_HEIGHT,
          lineHeight: `${HEADER_HEIGHT}px`,
          paddingInline: 24,
          flexShrink: 0,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <HeaderBoard height={HEADER_HEIGHT} />
        <Wordmark />
        <div style={{ flex: 1 }} />
        <ModeSwitch />
      </Layout.Header>
      <Layout style={{ minHeight: 0 }}>
        <Layout.Sider
          className={styles.pages}
          width={PAGES_RAIL}
          collapsedWidth={PAGES_RAIL}
          collapsed
          collapsible={false}
          trigger={null}
          style={{ background: RAIL }}
        >
          <Menu
            theme="dark"
            mode="inline"
            selectedKeys={[selected]}
            items={NAV.map((n) => ({
              key: n.key,
              // The link fills the row, so the whole of it opens the page (as Olympus's PageLink).
              icon: (
                <Link href={n.key} aria-label={n.label} className={styles.railLink}>
                  {n.icon}
                </Link>
              ),
              title: n.label,
              label: n.label,
            }))}
            style={{ background: 'transparent', borderInlineEnd: 'none', paddingBlockStart: 0 }}
          />
        </Layout.Sider>
        {/* The breadcrumbs start beside the rail, as Olympus's do. */}
        <Layout style={{ minWidth: 0 }}>
          <Crumbs pathname={pathname} />
          <Layout.Content
            id="lab-content"
            style={{
              flex: 1,
              minWidth: 0,
              minHeight: 0,
              overflow: 'auto',
              display: 'flex',
              flexDirection: 'column',
              // Card and table colour, so panels don't sit on a subtly different shade.
              background: token.colorBgContainer,
            }}
          >
            {children}
          </Layout.Content>
        </Layout>
      </Layout>
    </Layout>
  );
}

/** Most crumbs the bar's colours are worked out for; a deeper trail repeats the last. */
const MAX_DEPTH = 8;

/**
 * Where you are, as Olympus's bar below the header shows it (ControlBreadcrumbs): Lab, the page,
 * then what it has open, as chevrons stepping from slate to navy. Read off the path.
 */
function Crumbs({ pathname }: { pathname: string }) {
  const [section, id] = pathname.split('/').filter(Boolean);
  const page = NAV.find((n) => n.key === `/${section ?? ''}`);
  const trail: { title: ReactNode; href?: string }[] = [
    {
      title: (
        <Space size={6}>
          <HomeOutlined />
          Lab
        </Space>
      ),
      href: page && page.key !== '/' ? '/' : undefined,
    },
  ];
  if (page && page.key !== '/') {
    trail.push({
      title: (
        <Space size={6}>
          {page.icon}
          {page.label}
        </Space>
      ),
      href: id ? page.key : undefined,
    });
  }
  if (id) {
    const name = decodeURIComponent(id);
    trail.push({ title: section === 'captures' || section === 'sessions' ? name : `#${name}` });
  }
  const n = Math.min(trail.length, MAX_DEPTH);
  return (
    <nav className={styles.crumbs} aria-label="Breadcrumb">
      <Breadcrumb
        className={styles[`n${n}`]}
        separator=""
        items={trail.map((c, i) => ({
          title: c.href ? <Link href={c.href}>{c.title}</Link> : c.title,
          className: [
            styles.level,
            styles[`k${Math.max(1, Math.min(trail.length - i, MAX_DEPTH))}`],
            i === 0 ? styles.root : undefined,
          ]
            .filter(Boolean)
            .join(' '),
        }))}
      />
    </nav>
  );
}

const MODES: { key: ColorMode; label: string; icon: ReactNode }[] = [
  { key: 'system', label: 'Match the system', icon: <DesktopOutlined /> },
  { key: 'light', label: 'Light', icon: <SunOutlined /> },
  { key: 'dark', label: 'Dark', icon: <MoonOutlined /> },
];

/** Light, dark or the system's: a pill of three on the header's right. */
function ModeSwitch() {
  const mode = useColorMode();
  return (
    <div role="radiogroup" aria-label="Colour theme" className={styles.modePill}>
      {MODES.map((m) => (
        <Tooltip key={m.key} title={m.label} placement="bottom">
          <button
            type="button"
            role="radio"
            aria-checked={mode === m.key}
            aria-label={m.label}
            className={`${styles.modeButton} ${mode === m.key ? styles.modeOn : ''}`}
            onClick={() => setColorMode(m.key)}
          >
            {m.icon}
          </button>
        </Tooltip>
      ))}
    </div>
  );
}

export function Shell({ children, initial }: { children: ReactNode; initial: InitialPrefs }) {
  return (
    <PrefsContext value={initial}>
      <Themed>{children}</Themed>
    </PrefsContext>
  );
}

function Themed({ children }: { children: ReactNode }) {
  const dark = useDark();
  // The page behind the app, and the browser's own controls (scrollbars, inputs), follow too.
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
    // For the server's next draw of "system" (prefs.ts); quietly, nothing listens for it.
    document.cookie = `${PREF.dark}=${dark ? 1 : 0}; path=/; max-age=31536000; samesite=lax`;
  }, [dark]);
  return (
    <ConfigProvider
      theme={{
        algorithm: dark ? theme.darkAlgorithm : theme.defaultAlgorithm,
        components: { Layout: { headerBg: NAVY, siderBg: NAVY } },
      }}
    >
      <App>
        <Chrome>{children}</Chrome>
      </App>
    </ConfigProvider>
  );
}
