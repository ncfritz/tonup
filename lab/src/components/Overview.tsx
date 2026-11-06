'use client';

import { Descriptions, Tag, Typography } from 'antd';
import Link from 'next/link';

import type { DeepdartsSummary } from '~/lib/deepdarts';
import type { OverviewCounts, PrefillStats, WeekCount } from '~/lib/queries';
import type { LabStatus } from '~/lib/status';
import type { Coverage, CoverageGrid, ModelProgress } from '~/lib/verify';

import { Count, CountStrip, EdgePage, Panel, Panels, Section, TitleBar } from './Page';
import { pct as percent } from './RunBits';
import { CoverageHeatmap, MeasureChart, measureNote, WeeklyChart } from './OverviewCharts';
import { CoverageChart, MEASURES, PrefillChart, ThinNote } from './VerifyCharts';

/**
 * Overview: how close the model is to the bar, and where the dataset is thin. Edge to edge as
 * Olympus's pages are: the title and the counts stay at the top, the rest scrolls under them.
 */
export function Overview({
  status,
  counts,
  deepdarts,
  progress,
  coverage,
  prefill,
  weeks,
  grid,
  gridThin,
}: {
  status: LabStatus;
  counts: OverviewCounts;
  deepdarts: DeepdartsSummary | null;
  progress: ModelProgress;
  coverage: Coverage[];
  prefill: PrefillStats[];
  weeks: WeekCount[];
  grid: CoverageGrid;
  gridThin: number;
}) {
  const active = progress.find((m) => m.status === 'active');
  const inUse = counts.bySplit.train + counts.bySplit.val + counts.bySplit.test;
  const share = (n: number) => (inUse ? `${Math.round((n / inUse) * 100)}% of photos` : '—');

  return (
    <EdgePage
      head={
        <>
          <TitleBar
            title="Overview"
            subtitle="How close the model is to shipping, and what the dataset still needs"
          />
          <CountStrip>
            <Count
              title="Captures"
              value={counts.captures}
              note={`${counts.valuesOnly} values only · ${counts.unlabelled ? `${counts.unlabelled} to label · ` : ''}${counts.rejected} left out`}
            />
            <Count
              title="Sessions"
              value={counts.sessions}
              note={<Link href="/sessions?import=1">Import a folder</Link>}
            />
            <Count
              title="To review"
              value={counts.toReview}
              note={<Link href="/captures?review=1">Open the review queue</Link>}
            />
            <Count
              title="Train"
              value={counts.bySplit.train}
              note={<Link href="/captures?split=train">{share(counts.bySplit.train)}</Link>}
            />
            <Count
              title="Val"
              value={counts.bySplit.val}
              note={<Link href="/captures?split=val">{share(counts.bySplit.val)}</Link>}
            />
            <Count
              title="Verify"
              value={counts.bySplit.test}
              note={<Link href="/captures?split=test">never trained on</Link>}
            />
            <Count
              title="Active model"
              value={status.activeModel ?? 'None yet'}
              note={
                active ? (
                  `visit ${percent(active.visitCorrect)} on ${active.samples} verify photos`
                ) : (
                  <Link href="/models">
                    {status.activeModel ? 'not verified yet' : 'pick one on Models'}
                  </Link>
                )
              }
            />
          </CountStrip>
        </>
      }
    >
      <Section title="Lab">
        <Descriptions
          size="small"
          column={{ xs: 1, md: 2, xl: 4 }}
          items={[
            { label: 'Version', children: status.version },
            { label: 'Data folder', children: status.dataDir },
            {
              label: 'DeepDarts',
              children: deepdarts ? (
                deepdarts.ok ? (
                  `${deepdarts.photos.toLocaleString()} photos`
                ) : (
                  <Tag color="warning">{deepdarts.problem}</Tag>
                )
              ) : (
                <Link href="/sessions?import=1">Not set</Link>
              ),
            },
            {
              label: 'Shared scoring',
              children: status.scoring.ok ? (
                <Tag color="success">self-check {status.scoring.got}</Tag>
              ) : (
                <Tag color="error">
                  expected {status.scoring.expected}, got {status.scoring.got}
                </Tag>
              ),
            },
          ]}
        />
        <Typography.Paragraph type="secondary" style={{ margin: '8px 0 0' }}>
          Sets are chosen by session, 80/10/10. Verify is never trained on.
        </Typography.Paragraph>
      </Section>

      {/* Each measure across the models, on our verify photos, against its shipping bar. */}
      <Panels min={320}>
        {MEASURES.map((m) => (
          <Panel
            key={m.key}
            title={`${m.label} correct`.replace('found correct', 'found')}
            extra={measureNote(progress, m.key)}
          >
            <MeasureChart models={progress} measure={m.key} />
          </Panel>
        ))}
      </Panels>

      <Panels min={420}>
        <Panel title="Labelled photos per week" extra={<Link href="/captures">Captures</Link>}>
          <WeeklyChart weeks={weeks} />
        </Panel>
        <Panel
          title={`Coverage: ${grid.rows.title.toLowerCase()} by ${grid.cols.title.toLowerCase()}`}
        >
          <CoverageHeatmap grid={grid} thin={gridThin} />
        </Panel>
        <Panel
          title="Labelling with the model: how much of its pre-fill was kept"
          extra={<Link href="/captures?review=1">Corrected labels</Link>}
        >
          <PrefillChart stats={prefill} />
        </Panel>
      </Panels>

      <Section title="Coverage by condition" extra={<ThinNote />} flush>
        <Panels min={420} edge={false}>
          {coverage.map((c) => (
            <Panel
              key={c.key}
              title={c.title}
              extra={
                c.unmeasured ? (
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    {c.unmeasured} not measured
                  </Typography.Text>
                ) : null
              }
            >
              <CoverageChart coverage={c} />
            </Panel>
          ))}
        </Panels>
      </Section>
    </EdgePage>
  );
}
