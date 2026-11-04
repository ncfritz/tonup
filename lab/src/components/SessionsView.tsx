'use client';

import { DeleteOutlined } from '@ant-design/icons';
import {
  App,
  Alert,
  Button,
  Card,
  Flex,
  Input,
  Popconfirm,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import type { DeepdartsSummary } from '~/lib/deepdarts';
import type { ImportResult } from '~/lib/ingest';
import type { SessionRow } from '~/lib/queries';

import { SplitTag } from './CaptureBits';
import { PageBody, PageHeader } from './PageHeader';

/** Sessions, importing a captures folder, and where the DeepDarts download is. */
export function SessionsView({
  sessions,
  deepdarts,
}: {
  sessions: SessionRow[];
  deepdarts: DeepdartsSummary | null;
}) {
  const { message } = App.useApp();
  const router = useRouter();
  const [folder, setFolder] = useState('');
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [ddPath, setDdPath] = useState(deepdarts?.path ?? '');

  const deleteSession = async (sess: SessionRow) => {
    const res = await fetch(`/api/sessions/${encodeURIComponent(sess.id)}`, { method: 'DELETE' });
    const body = await res.json().catch(() => null);
    if (!res.ok) return message.error(body?.error ?? 'Couldn’t delete the session');
    message.success(
      `Deleted the session and ${body.captures} ${body.captures === 1 ? 'photo' : 'photos'}`,
    );
    router.refresh();
  };

  const runImport = async () => {
    setImporting(true);
    setResult(null);
    const res = await fetch('/api/import', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ folder }),
    });
    setImporting(false);
    const body = await res.json().catch(() => null);
    if (!res.ok) return message.error(body?.error ?? 'Import failed');
    setResult(body as ImportResult);
    router.refresh();
  };
  const saveDeepdarts = async () => {
    const res = await fetch('/api/settings/deepdarts', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ path: ddPath }),
    });
    if (!res.ok) return message.error('Couldn’t save the folder');
    router.refresh();
  };

  return (
    <>
      <PageHeader
        title="Sessions"
        subtitle="Each session’s set is chosen when Lab first sees it, and never changes"
      />
      <PageBody>
        <Flex vertical gap={16}>
          <Flex wrap gap={16}>
            <Card size="small" title="Import a captures folder" style={{ flex: '1 1 420px' }}>
              <Typography.Paragraph type="secondary">
                Ton Up’s kept photos: copy Files › On My iPhone › Ton Up › captures to this Mac,
                then give its path. Photos Lab already has are skipped.
              </Typography.Paragraph>
              <Space.Compact style={{ width: '100%' }}>
                <Input
                  placeholder="~/Downloads/captures"
                  value={folder}
                  onChange={(e) => setFolder(e.target.value)}
                  onPressEnter={runImport}
                  aria-label="Folder to import"
                />
                <Button type="primary" loading={importing} disabled={!folder} onClick={runImport}>
                  Import
                </Button>
              </Space.Compact>
              {result ? (
                <Alert
                  style={{ marginTop: 12 }}
                  type={result.failed.length ? 'warning' : 'success'}
                  showIcon
                  title={`Imported ${result.imported}, skipped ${result.skipped} already here${
                    result.failed.length ? `, ${result.failed.length} failed` : ''
                  }`}
                  description={
                    result.failed.length ? (
                      <ul style={{ margin: 0, paddingLeft: 18 }}>
                        {result.failed.slice(0, 8).map((f) => (
                          <li key={f.file}>
                            {f.file}: {f.error}
                          </li>
                        ))}
                      </ul>
                    ) : null
                  }
                />
              ) : null}
            </Card>

            <Card size="small" title="DeepDarts" style={{ flex: '1 1 420px' }}>
              <Typography.Paragraph type="secondary">
                The folder holding labels.pkl and cropped_images/800 (ml/README.md). Training reads
                it from there; Lab doesn’t copy it.
              </Typography.Paragraph>
              <Space.Compact style={{ width: '100%' }}>
                <Input
                  placeholder="~/Workplace/tonup/ml/data/deepdarts"
                  value={ddPath}
                  onChange={(e) => setDdPath(e.target.value)}
                  aria-label="DeepDarts folder"
                />
                <Button onClick={saveDeepdarts} disabled={!ddPath}>
                  Save
                </Button>
              </Space.Compact>
              {deepdarts ? (
                <div style={{ marginTop: 12 }}>
                  {deepdarts.ok ? (
                    <Tag color="success">
                      {deepdarts.photos.toLocaleString()} photos in {deepdarts.folders} folders
                    </Tag>
                  ) : (
                    <Tag color="warning">{deepdarts.problem}</Tag>
                  )}
                </div>
              ) : null}
            </Card>
          </Flex>

          <Card size="small" title={`Sessions · ${sessions.length}`}>
            <Table
              size="small"
              rowKey="id"
              dataSource={sessions}
              pagination={{ pageSize: 20, hideOnSinglePage: true }}
              scroll={{ x: 640 }}
              columns={[
                {
                  title: 'Started',
                  render: (_, s) => new Date(s.startedAt).toLocaleString(),
                  sorter: (a, b) => a.startedAt - b.startedAt,
                },
                { title: 'Set', render: (_, s) => <SplitTag split={s.split} /> },
                {
                  title: 'Photos',
                  render: (_, s) => <Link href={`/captures?session=${s.id}`}>{s.captures}</Link>,
                },
                {
                  title: 'To review',
                  render: (_, s) =>
                    s.toReview ? (
                      <Link href={`/captures?session=${s.id}&review=1`}>{s.toReview}</Link>
                    ) : (
                      0
                    ),
                },
                { title: 'Tags', render: (_, s) => s.tags.join(' · ') || '—' },
                {
                  title: 'From',
                  render: (_, s) =>
                    s.source === 'import' ? 'Ton Up import' : (s.device ?? 'TU Capture'),
                },
                {
                  title: 'ID',
                  dataIndex: 'id',
                  render: (id: string) => <Typography.Text code>{id}</Typography.Text>,
                },
                {
                  key: 'delete',
                  width: 48,
                  render: (_, s) => (
                    <Popconfirm
                      title="Delete this session?"
                      description={`Its ${s.captures} ${s.captures === 1 ? 'photo' : 'photos'} and their labels go too. This can’t be undone.`}
                      okText="Delete"
                      okButtonProps={{ danger: true }}
                      onConfirm={() => deleteSession(s)}
                    >
                      <Button
                        size="small"
                        type="text"
                        danger
                        icon={<DeleteOutlined />}
                        aria-label={`Delete session ${s.id}`}
                      />
                    </Popconfirm>
                  ),
                },
              ]}
            />
          </Card>
        </Flex>
      </PageBody>
    </>
  );
}
