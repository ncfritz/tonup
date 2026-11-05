'use client';

import { LeftOutlined, RightOutlined } from '@ant-design/icons';
import { Button, Tabs, Tooltip, type TabsProps } from 'antd';
import { useSyncExternalStore, type ReactNode } from 'react';

import styles from './SideTabs.module.css';

/** The rail's width when closed: the tab icons alone. */
const RAIL = 62;

// Open or closed per panel and per browser, as Olympus's CollapsibleTabPanel remembers it.
const listeners = new Set<() => void>();
const keyOf = (id: string) => `tonup-lab.side.${id}`;
function read(id: string, fallback: boolean) {
  try {
    const v = window.localStorage.getItem(keyOf(id));
    return v === null ? fallback : v === '1';
  } catch {
    return fallback;
  }
}
function write(id: string, open: boolean) {
  try {
    window.localStorage.setItem(keyOf(id), open ? '1' : '0');
  } catch {
    // Storage blocked: it just won't be remembered.
  }
  listeners.forEach((l) => l());
}
function subscribe(l: () => void) {
  listeners.add(l);
  window.addEventListener('storage', l);
  return () => {
    listeners.delete(l);
    window.removeEventListener('storage', l);
  };
}

export interface SideTab {
  key: string;
  icon: ReactNode;
  title: string;
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
  width = 340,
  defaultOpen = true,
}: {
  id: string;
  tabs: SideTab[];
  width?: number;
  defaultOpen?: boolean;
}) {
  const open = useSyncExternalStore(
    subscribe,
    () => read(id, defaultOpen),
    () => defaultOpen,
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
      <div className={styles.pane}>
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
