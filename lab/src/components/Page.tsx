'use client';

import { Statistic, Typography } from 'antd';
import type { CSSProperties, ReactNode } from 'react';

import styles from './Page.module.css';

/** A page to the content area's edges (Page.module.css): what's sticky goes in `head`. */
export function EdgePage({ head, children }: { head: ReactNode; children: ReactNode }) {
  return (
    <div>
      <div className={styles.sticky}>{head}</div>
      {children}
    </div>
  );
}

/** The page's title bar. */
export function TitleBar({
  title,
  subtitle,
  extra,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  extra?: ReactNode;
}) {
  return (
    <div className={styles.bar}>
      <div>
        <Typography.Title level={4} className={styles.title}>
          {title}
        </Typography.Title>
        {subtitle ? <Typography.Text type="secondary">{subtitle}</Typography.Text> : null}
      </div>
      {extra}
    </div>
  );
}

/** A page's headline counts, in a strip across it. */
export function CountStrip({ children }: { children: ReactNode }) {
  return <div className={styles.strip}>{children}</div>;
}

/** One count in the strip, and a line beneath it saying what it holds. */
export function Count({
  title,
  value,
  suffix,
  note,
}: {
  title: string;
  value: number | string;
  suffix?: ReactNode;
  note?: ReactNode;
}) {
  return (
    <div className={styles.cell}>
      <Statistic title={title} value={value} suffix={suffix} />
      {typeof note === 'string' ? (
        <Typography.Text type="secondary" className={styles.note} ellipsis={{ tooltip: note }}>
          {note}
        </Typography.Text>
      ) : (
        <span className={styles.note}>{note}</span>
      )}
    </div>
  );
}

/** A titled part of the page, edge to edge with a border under it. */
export function Section({
  title,
  extra,
  children,
  flush,
}: {
  title: ReactNode;
  extra?: ReactNode;
  children: ReactNode;
  /** The body brings its own layout (panels) and padding. */
  flush?: boolean;
}) {
  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <Typography.Title level={5} className={styles.title}>
          {title}
        </Typography.Title>
        {extra}
      </div>
      {flush ? children : <div className={styles.sectionBody}>{children}</div>}
    </section>
  );
}

/** Panels side by side across the page, each at least `min` wide. */
export function Panels({
  children,
  min,
  edge = true,
}: {
  children: ReactNode;
  min?: number;
  /** A border under the row; off inside a Section, which has its own. */
  edge?: boolean;
}) {
  return (
    <div
      className={`${styles.panels} ${edge ? styles.panelsEdge : ''}`}
      style={min ? ({ '--panel-min': `${min}px` } as CSSProperties) : undefined}
    >
      {children}
    </div>
  );
}

/** One panel: a small head and its content, divided from its neighbours. */
export function Panel({
  title,
  extra,
  children,
}: {
  title: ReactNode;
  extra?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className={styles.panel}>
      <div className={styles.sectionHead}>
        <Typography.Text strong>{title}</Typography.Text>
        {extra}
      </div>
      <div className={styles.sectionBody}>{children}</div>
    </div>
  );
}
