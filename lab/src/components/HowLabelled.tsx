'use client';

import { Descriptions, Tag, Typography } from 'antd';

import type { HowLabelled } from '~/lib/queries';

/** One line for how the phone's label was made (capture-lab.md › Model reads). */
export function HowLabelledTag({ how }: { how: HowLabelled | null }) {
  if (!how?.read) return null;
  if (how.mode === 'blind' && how.blind) {
    return how.blind.agreed ? (
      <Tag color="purple">Blind check · agreed</Tag>
    ) : (
      <Tag color="volcano">Blind check · disagreed</Tag>
    );
  }
  return how.read.outcome === 'confirmed' ? (
    <Tag color="blue">Read by {how.read.model} · confirmed</Tag>
  ) : (
    <Tag color="orange">Read by {how.read.model} · fixed</Tag>
  );
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** The label history's head: how the phone's label was made, the model's read and what changed. */
export function HowLabelledBlock({ how }: { how: HowLabelled | null }) {
  if (!how) return null;
  const { read, blind } = how;
  const fixes = read
    ? [
        read.valuesChanged && plural(read.valuesChanged, 'value changed', 'values changed'),
        read.tipsMoved && plural(read.tipsMoved, 'tip moved', 'tips moved'),
        read.wiresMarked &&
          plural(read.wiresMarked, 'dart marked on the wire', 'darts marked on the wire'),
        read.dartsAdded && plural(read.dartsAdded, 'dart added', 'darts added'),
        read.dartsRemoved && plural(read.dartsRemoved, 'dart removed', 'darts removed'),
        !read.boardKept && 'board re-marked',
      ].filter(Boolean)
    : [];
  const mode =
    how.mode === 'entered'
      ? 'Values entered first'
      : how.mode === 'blind'
        ? 'Blind check: values entered first, the read shown after'
        : `The model’s read, ${read?.outcome === 'confirmed' ? 'confirmed as read' : 'fixed'}`;
  return (
    <div style={{ marginBottom: 16 }}>
      <Typography.Text strong>How it was labelled</Typography.Text>
      <Descriptions
        size="small"
        column={1}
        style={{ marginTop: 8 }}
        items={[
          { label: 'On the phone', children: mode },
          ...(read
            ? [
                {
                  label: `${read.model} read`,
                  children: read.darts
                    .map((d) => (d.sure ? d.value : `${d.value} (unsure)`))
                    .join(' · '),
                },
              ]
            : []),
          ...(blind
            ? [
                { label: 'Entered first', children: blind.values.join(' · ') },
                {
                  label: 'Blind check',
                  children: blind.agreed
                    ? 'Agreed with the read'
                    : `Disagreed; kept ${blind.chose === 'mine' ? 'the values entered' : blind.chose === 'model' ? 'the read' : 'a fix'}`,
                },
              ]
            : []),
          ...(read && read.outcome === 'fixed'
            ? [{ label: 'Fixed', children: fixes.join(', ') || '—' }]
            : []),
          ...(how.seconds !== null ? [{ label: 'Time', children: `${how.seconds} s` }] : []),
        ]}
      />
    </div>
  );
}
