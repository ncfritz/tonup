'use client';

import { Typography } from 'antd';
import type { ReactNode } from 'react';

import styles from './Page.module.css';

/**
 * A page's title bar, as Olympus's: edge to edge with a border under it, and sticky, so the
 * page scrolls under it (Page.module.css).
 */
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
    <div className={styles.sticky}>
      <div className={styles.bar}>
        <div>
          {breadcrumb ? <Typography.Text type="secondary">{breadcrumb}</Typography.Text> : null}
          <Typography.Title level={4} className={styles.title}>
            {title}
          </Typography.Title>
          {subtitle ? <Typography.Text type="secondary">{subtitle}</Typography.Text> : null}
        </div>
        {extra}
      </div>
    </div>
  );
}

/** The page below its title bar: to the content area's edges; its parts carry the padding. */
export function PageBody({ children }: { children: ReactNode }) {
  return <div>{children}</div>;
}
