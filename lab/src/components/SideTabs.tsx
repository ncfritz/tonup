'use client';

import { LeftOutlined, RightOutlined } from '@ant-design/icons';
import { Button, Tabs, Tooltip, type TabsProps } from 'antd';
import { useSyncExternalStore, type ReactNode } from 'react';

import { PREF, readPref, subscribePrefs, useInitialPrefs, writePref } from './prefs';
import styles from './SideTabs.module.css';

/** The rail's width when closed: the tab icons alone. */
const RAIL = 62;

// Open or closed per panel and per browser, as Olympus's CollapsibleTabPanel remembers it: a
// cookie, so the server draws it as it was left (prefs.ts).
function read(id: string, fallback: boolean) {
  const v = readPref(PREF.side(id));
  return v === null ? fallback : v === '1';
}
const write = (id: string, open: boolean) => writePref(PREF.side(id), open ? '1' : '0');

export interface SideTab {
  key: string;
  icon: ReactNode;
  title: string;
  /** Its content runs to the panel's edges (rows divided by lines); the title keeps its padding. */
  flush?: boolean;
  children: ReactNode;
}

/**
 * Olympus's collapsible tab panel (apps/site CollapsibleTabPanel): a light panel on the right
 * with its tabs as icons down its edge. Closed, it's a rail of the icons; picking one opens it.
 * A bar across its top opens and closes it.
 */
export function SideTabs({
  id,
  tabs,
  width = 440,
  defaultOpen = true,
}: {
  id: string;
  tabs: SideTab[];
  width?: number;
  defaultOpen?: boolean;
}) {
  const initial = useInitialPrefs();
  const open = useSyncExternalStore(
    subscribePrefs,
    () => read(id, defaultOpen),
    () => initial.sides[id] ?? defaultOpen,
  );
  const items: TabsProps['items'] = tabs.map((t) => ({
    key: t.key,
    label: (
      <Tooltip title={open ? null : t.title} placement="left">
        <span aria-label={t.title} className={styles.icon}>
          {t.icon}
        </span>
      </Tooltip>
    ),
    children: (
      <div className={t.flush ? styles.paneFlush : styles.pane}>
        <div className={styles.paneTitle}>{t.title}</div>
        {t.children}
      </div>
    ),
  }));
  return (
    <aside
      className={`${styles.panel} ${open ? styles.open : styles.closed}`}
      style={{ width: open ? width : RAIL, ['--side-width' as string]: `${width}px` }}
    >
      <Button
        type="text"
        block
        className={styles.trigger}
        icon={open ? <RightOutlined /> : <LeftOutlined />}
        aria-label={open ? 'Close the side panel' : 'Open the side panel'}
        aria-expanded={open}
        onClick={() => write(id, !open)}
      />
      <Tabs
        className={styles.tabs}
        tabPlacement="end"
        items={items}
        onTabClick={() => {
          if (!open) write(id, true);
        }}
      />
    </aside>
  );
}
