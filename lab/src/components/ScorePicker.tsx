'use client';

import { AppstoreOutlined } from '@ant-design/icons';
import { Button, Popover, Segmented } from 'antd';
import { useState } from 'react';

import styles from './ScorePicker.module.css';

type Ring = '' | 'D' | 'T';

/**
 * Picks a dart's value as Capture's keypad does: the ring (single, double, treble), then the
 * number; or 25, Bull, Miss, Bounce-out. Opens from a button beside the value.
 */
export function ScorePicker({
  value,
  onPick,
  label,
}: {
  value: string | null;
  onPick: (v: string) => void;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  // Opens on the ring of the value it has (T20 → Treble).
  const [ring, setRing] = useState<Ring>(() => ringOf(value));
  const pick = (v: string) => {
    onPick(v);
    setOpen(false);
  };
  const content = (
    // Clicks here bubble (through the portal, in React) to the darts row: they stop here.
    <div className={styles.picker} onClick={(e) => e.stopPropagation()}>
      <Segmented
        block
        value={ring}
        onChange={(v) => setRing(v as Ring)}
        options={[
          { label: 'Single', value: '' },
          { label: 'Double', value: 'D' },
          { label: 'Treble', value: 'T' },
        ]}
      />
      <div className={styles.numbers}>
        {Array.from({ length: 20 }, (_, i) => {
          const v = `${ring}${i + 1}`;
          return (
            <Button
              key={v}
              type={value === v ? 'primary' : 'default'}
              onClick={() => pick(v)}
              aria-label={v}
            >
              {i + 1}
            </Button>
          );
        })}
      </div>
      <div className={styles.extras}>
        {['25', 'Bull', 'Miss', 'Bounce-out'].map((v) => (
          <Button key={v} type={value === v ? 'primary' : 'default'} onClick={() => pick(v)}>
            {v}
          </Button>
        ))}
      </div>
    </div>
  );
  return (
    <Popover
      trigger="click"
      placement="bottomLeft"
      open={open}
      onOpenChange={(o) => {
        if (o) setRing(ringOf(value));
        setOpen(o);
      }}
      content={content}
    >
      <Button icon={<AppstoreOutlined />} aria-label={label} onClick={(e) => e.stopPropagation()} />
    </Popover>
  );
}

function ringOf(value: string | null): Ring {
  const m = /^([DT])\d/.exec(value ?? '');
  return (m?.[1] as Ring | undefined) ?? '';
}
