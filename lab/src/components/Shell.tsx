'use client';

import {
  CameraOutlined,
  CheckCircleOutlined,
  DashboardOutlined,
  DeploymentUnitOutlined,
  DesktopOutlined,
  ExperimentOutlined,
  FolderOpenOutlined,
  LeftOutlined,
  MoonOutlined,
  RightOutlined,
  SunOutlined,
} from '@ant-design/icons';
import { App, Button, ConfigProvider, Layout, Menu, theme, Tooltip } from 'antd';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';

import { setColorMode, useColorMode, useDark, type ColorMode } from './colorMode';
import {
  PREF,
  PrefsContext,
  readPref,
  subscribePrefs,
  useInitialPrefs,
  writePref,
  type InitialPrefs,
} from './prefs';
import styles from './Shell.module.css';

// Ant Design with Ton Up's teal (the Training theme's light accent) as the primary colour, in
// Olympus's chrome (packages/console/src/shell): a navy header across the top, the pages in a
// sider beside the content that folds to a rail.
const PRIMARY = '#0F766E';
/**
 * Dark mode: buttons keep a teal white text reads on; links and the selection use the Training
 * theme's bright dark-mode teal, which reads on the dark panels.
 */
const PRIMARY_DARK = '#0F8A7E';
const LINK_DARK = '#2DD4BF';
/** Olympus's chrome colours: the header's navy and the collapsed rail's slate. */
const NAVY = '#001529';
const RAIL_BG = '#324354';
const HEADER_HEIGHT = 56;
/** Open, and the rail it collapses to. */
const PAGES_WIDTH = 220;
const PAGES_RAIL = 80;
const TRIGGER_SIZE = 24;

const NAV = [
  { key: '/', icon: <DashboardOutlined />, label: 'Overview' },
  { key: '/captures', icon: <CameraOutlined />, label: 'Captures' },
  { key: '/sessions', icon: <FolderOpenOutlined />, label: 'Sessions' },
  { key: '/runs', icon: <ExperimentOutlined />, label: 'Runs' },
  { key: '/models', icon: <DeploymentUnitOutlined />, label: 'Models' },
  { key: '/verification', icon: <CheckCircleOutlined />, label: 'Verification' },
];

// Per browser: a sider that springs open on every visit is not a choice. A cookie, so the
// server draws it as it was left (prefs.ts).
const readCollapsed = () => readPref(PREF.collapsed) === '1';
const writeCollapsed = (collapsed: boolean) => writePref(PREF.collapsed, collapsed ? '1' : '0');

// Narrow screens (a phone): the menu starts folded whatever was saved, and opening it there is
// for this visit only.
const NARROW = '(max-width: 767px)';
function subscribeNarrow(l: () => void) {
  const q = window.matchMedia(NARROW);
  q.addEventListener('change', l);
  return () => q.removeEventListener('change', l);
}
const readNarrow = () => window.matchMedia(NARROW).matches;

function Wordmark() {
  return (
    <Link
      href="/"
      style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#fff' }}
      aria-label="Ton Up Lab, Overview"
    >
      <span
        aria-hidden
        style={{
          width: 26,
          height: 26,
          borderRadius: 13,
          background: PRIMARY,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span style={{ width: 9, height: 9, borderRadius: 5, background: '#fff' }} />
      </span>
      <span style={{ fontSize: 16, fontWeight: 600, letterSpacing: 0.2 }}>Ton Up Lab</span>
    </Link>
  );
}

function Chrome({ children }: { children: ReactNode }) {
  const { token } = theme.useToken();
  const pathname = usePathname();
  const selected = NAV.find((n) => n.key !== '/' && pathname.startsWith(n.key))?.key ?? '/';
  const initial = useInitialPrefs();
  const saved = useSyncExternalStore(subscribePrefs, readCollapsed, () => initial.collapsed);
  const narrow = useSyncExternalStore(subscribeNarrow, readNarrow, () => false);
  const [openNarrow, setOpenNarrow] = useState(false);
  const collapsed = narrow ? !openNarrow : saved;
  const collapse = (next: boolean) => (narrow ? setOpenNarrow(!next) : writeCollapsed(next));

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
        }}
      >
        <Wordmark />
        <div style={{ flex: 1 }} />
        <ModeSwitch />
      </Layout.Header>
      <Layout style={{ minHeight: 0 }}>
        <Layout.Sider
          className={`${styles.pages} ${collapsed ? styles.collapsed : ''}`}
          width={PAGES_WIDTH}
          collapsedWidth={PAGES_RAIL}
          collapsed={collapsed}
          trigger={null}
          style={{
            position: 'relative',
            background: collapsed ? RAIL_BG : token.colorBgContainer,
            // Open, the panel is the page's colour, so it needs an edge; collapsed it is its own.
            borderInlineEnd: collapsed ? undefined : `1px solid ${token.colorBorderSecondary}`,
          }}
        >
          <Menu
            theme={collapsed ? 'dark' : 'light'}
            mode="inline"
            selectedKeys={[selected]}
            items={NAV.map((n) => ({
              key: n.key,
              icon: n.icon,
              title: n.label,
              label: <Link href={n.key}>{n.label}</Link>,
            }))}
            style={{ background: 'transparent', borderInlineEnd: 'none', paddingBlockStart: 8 }}
          />
          <Button
            className={`${styles.pill} ${collapsed ? styles.pillCollapsed : styles.pillExpanded}`}
            shape="circle"
            size="small"
            icon={collapsed ? <RightOutlined /> : <LeftOutlined />}
            onClick={() => collapse(!collapsed)}
            aria-label={collapsed ? 'Expand the menu' : 'Collapse the menu'}
            aria-expanded={!collapsed}
            style={{
              position: 'absolute',
              top: '50%',
              right: -TRIGGER_SIZE / 2,
              width: TRIGGER_SIZE,
              height: TRIGGER_SIZE,
              minWidth: TRIGGER_SIZE,
              transform: 'translateY(-50%)',
              zIndex: 3,
            }}
          />
        </Layout.Sider>
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
        token: dark
          ? { colorPrimary: PRIMARY_DARK, colorLink: LINK_DARK }
          : { colorPrimary: PRIMARY, colorLink: PRIMARY },
        components: {
          Layout: { headerBg: NAVY, siderBg: NAVY },
          // The open sider's selection: a clean tint of the teal, not antd's derived grey-green.
          Menu: dark
            ? {
                itemSelectedBg: 'rgba(45, 212, 191, 0.14)',
                itemSelectedColor: LINK_DARK,
                itemHoverBg: 'rgba(255, 255, 255, 0.06)',
              }
            : { itemSelectedBg: '#E3F1EF', itemSelectedColor: PRIMARY, itemHoverBg: '#F2F7F6' },
        },
      }}
    >
      <App>
        <Chrome>{children}</Chrome>
      </App>
    </ConfigProvider>
  );
}
