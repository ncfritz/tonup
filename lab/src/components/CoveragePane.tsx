import { WarningOutlined } from '@ant-design/icons';
import { Progress, Typography } from 'antd';

import type { Coverage } from '~/lib/verify';

import styles from './CoveragePane.module.css';

/** Coverage for a side panel: labelled photos in each condition's buckets, thin ones in amber. */
export function CoveragePane({
  coverage,
  heading = true,
}: {
  coverage: Coverage[];
  /** Its own "Coverage" heading; off where the panel's tab already says it. */
  heading?: boolean;
}) {
  return (
    <div className={styles.pane}>
      {heading ? <Typography.Text strong>Coverage</Typography.Text> : null}
      <Typography.Text type="secondary" className={styles.small}>
        Labelled photos in each condition, across the dataset. Thin: fewer than 30, or fewer than 10
        kept for verification.
      </Typography.Text>
      {coverage.map((c) => (
        <CoverageBlock key={c.key} c={c} />
      ))}
    </div>
  );
}

/** One condition's buckets: a bar each against the condition's largest, thin ones in amber. */
function CoverageBlock({ c }: { c: Coverage }) {
  const max = Math.max(1, ...c.buckets.map((b) => b.training + b.verify));
  return (
    <div className={styles.coverage}>
      <div className={styles.coverageHead}>
        <Typography.Text>{c.title}</Typography.Text>
        {c.unmeasured ? (
          <Typography.Text type="secondary" className={styles.small}>
            {c.unmeasured} not measured
          </Typography.Text>
        ) : null}
      </div>
      {c.buckets.map((b) => {
        const n = b.training + b.verify;
        return (
          <div key={b.bucket} className={styles.bucket}>
            <Typography.Text type={b.thin ? 'warning' : undefined} className={styles.bucketName}>
              {b.thin ? <WarningOutlined /> : null} {b.bucket}
            </Typography.Text>
            <Progress
              percent={(n / max) * 100}
              showInfo={false}
              size="small"
              status={b.thin ? 'exception' : 'normal'}
              strokeColor={b.thin ? 'var(--ant-color-warning)' : undefined}
              className={styles.bucketBar}
            />
            <span className={styles.bucketCount}>
              {n}
              <Typography.Text type="secondary" className={styles.small}>
                {' '}
                · {b.verify} verify
              </Typography.Text>
            </span>
          </div>
        );
      })}
    </div>
  );
}
