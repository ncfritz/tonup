'use client';

import { App, Button, Modal, Select, Typography } from 'antd';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export interface ModelOption {
  id: number;
  name: string;
  status: string;
}

/** Queues a verification of the given models and opens it. */
export function useStartVerification() {
  const { message } = App.useApp();
  const router = useRouter();
  return async (modelIds: number[]) => {
    const res = await fetch('/api/runs', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kind: 'verify', modelIds }),
    });
    const body = (await res.json().catch(() => ({}))) as { id?: number; error?: string };
    if (!res.ok || !body.id) {
      message.error(body.error ?? 'Couldn’t start the verification');
      return false;
    }
    router.push(`/verification/${body.id}`);
    return true;
  };
}

/** The active model and the newest other one: the comparison usually wanted. */
export function defaultPick(models: ModelOption[]) {
  const active = models.find((m) => m.status === 'active');
  const newest = [...models].sort((a, b) => b.id - a.id).find((m) => m.id !== active?.id);
  return [active?.id, newest?.id].filter((x): x is number => x != null);
}

export function NewVerificationButton({
  models,
  testPhotos,
}: {
  models: ModelOption[];
  testPhotos: number;
}) {
  const start = useStartVerification();
  const [open, setOpen] = useState(false);
  const [pick, setPick] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <Button
        type="primary"
        disabled={!models.length}
        onClick={() => {
          setPick(defaultPick(models));
          setOpen(true);
        }}
      >
        New verification
      </Button>
      <Modal
        title="Verify models"
        open={open}
        onCancel={() => setOpen(false)}
        okText="Start"
        okButtonProps={{ disabled: !pick.length || !testPhotos, loading: busy }}
        onOk={async () => {
          setBusy(true);
          if (await start(pick)) setOpen(false);
          setBusy(false);
        }}
      >
        <Typography.Paragraph type="secondary">
          Each model is checked on the same fresh snapshot of the verify set (
          {testPhotos.toLocaleString()} photos now), so their numbers compare directly. Up to four.
        </Typography.Paragraph>
        <Select
          mode="multiple"
          style={{ width: '100%' }}
          value={pick}
          onChange={(v) => setPick(v.slice(0, 4))}
          options={[...models]
            .sort((a, b) => b.id - a.id)
            .map((m) => ({
              value: m.id,
              label: `${m.name}${m.status === 'active' ? ' (active)' : m.status === 'retired' ? ' (retired)' : ''}`,
            }))}
        />
        {!testPhotos ? (
          <Typography.Paragraph type="warning" style={{ marginTop: 12, marginBottom: 0 }}>
            The verify set is empty: label visits from a session in it first.
          </Typography.Paragraph>
        ) : null}
      </Modal>
    </>
  );
}
