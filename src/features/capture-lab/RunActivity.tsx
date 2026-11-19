// The Lab run's Live Activity (docs/plan/capture-lab.md › Live Activity): the Lock Screen card
// and the Dynamic Island while a training or verification run goes on the Mac. Lab starts,
// updates and ends it over APNs; the app only registers this layout and sends Lab its tokens.
//
// The layout runs in the widget's own JavaScript runtime ('widget' below): no hooks, imports
// or module-level values inside it, so everything it needs comes in its props, colours too
// (the app's theme tokens, sent to Lab with the tokens).
import { Gauge, HStack, Image, ProgressView, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import {
  activityBackgroundTint,
  font,
  foregroundStyle,
  gaugeStyle,
  lineLimit,
  monospacedDigit,
  opacity,
  padding,
  tint,
} from '@expo/ui/swift-ui/modifiers';
import { createLiveActivity, type LiveActivityEnvironment } from 'expo-widgets';

import { RUN_ACTIVITY, type RunActivityProps } from '@/domain/lab/runActivity';

function RunActivityLayout(p: RunActivityProps, env: LiveActivityEnvironment) {
  'widget';
  // The app's theme tokens; the system's own styles if the phone hadn't sent them yet.
  const primary = { type: 'hierarchical' as const, style: 'primary' as const };
  const secondary = { type: 'hierarchical' as const, style: 'secondary' as const };
  const c = {
    accent: p.colors?.accent ?? primary,
    text: p.colors?.text ?? primary,
    muted: p.colors?.muted ?? secondary,
    danger: p.colors?.danger ?? primary,
    ok: p.colors?.ok ?? primary,
  };
  const going = p.status === 'running' || p.status === 'queued';
  const icon =
    p.status === 'done'
      ? 'checkmark.circle.fill'
      : p.status === 'failed'
        ? 'exclamationmark.triangle.fill'
        : p.status === 'cancelled'
          ? 'xmark.circle.fill'
          : p.kind === 'train'
            ? 'brain'
            : 'checkmark.seal';
  const iconColor = p.status === 'failed' ? c.danger : p.status === 'done' ? c.ok : c.accent;
  const value = p.progress === null ? 0 : Math.max(0, Math.min(1, p.progress));
  const percent = `${Math.round(value * 100)}%`;
  const now = new Date();
  const ends = p.endsAt && p.endsAt > now.getTime() ? new Date(p.endsAt) : null;
  const started = p.startedAt ? new Date(p.startedAt) : null;
  // Faded when Lab has gone quiet (its updates carry a stale date).
  const fade = env.isStale ? [opacity(0.6)] : [];

  // Time left while training (the pace so far); time so far otherwise.
  const clock = ends ? (
    <Text
      timerInterval={{ lower: now, upper: ends }}
      countsDown
      modifiers={[
        monospacedDigit(),
        font({ size: 15, weight: 'semibold' }),
        foregroundStyle(c.text),
      ]}
    />
  ) : started && going ? (
    <Text
      timerInterval={{ lower: started, upper: new Date(started.getTime() + 24 * 3600 * 1000) }}
      countsDown={false}
      modifiers={[
        monospacedDigit(),
        font({ size: 15, weight: 'semibold' }),
        foregroundStyle(c.muted),
      ]}
    />
  ) : null;

  const bar = going ? <ProgressView value={value} modifiers={[tint(c.accent)]} /> : null;

  return {
    banner: (
      <VStack
        alignment="leading"
        spacing={8}
        modifiers={[
          padding({ all: 16 }),
          activityBackgroundTint(p.colors?.surface ?? null),
          ...fade,
        ]}
      >
        <HStack spacing={10}>
          <Image systemName={icon} modifiers={[foregroundStyle(iconColor), font({ size: 22 })]} />
          <VStack alignment="leading" spacing={2}>
            <Text
              modifiers={[
                font({ size: 16, weight: 'bold' }),
                foregroundStyle(c.text),
                lineLimit(1),
              ]}
            >
              {p.title}
            </Text>
            <Text modifiers={[font({ size: 13 }), foregroundStyle(c.muted), lineLimit(1)]}>
              {p.line}
            </Text>
          </VStack>
          <Spacer />
          {going ? (
            <VStack alignment="trailing" spacing={2}>
              {clock}
              <Text modifiers={[font({ size: 12 }), foregroundStyle(c.muted), monospacedDigit()]}>
                {percent}
              </Text>
            </VStack>
          ) : null}
        </HStack>
        {bar}
        {p.result ? (
          <Text
            modifiers={[
              font({ size: 13, weight: 'medium' }),
              foregroundStyle(c.text),
              lineLimit(1),
            ]}
          >
            {p.result}
          </Text>
        ) : null}
      </VStack>
    ),
    compactLeading: <Image systemName={icon} modifiers={[foregroundStyle(iconColor)]} />,
    compactTrailing: going ? (
      <Text
        modifiers={[
          monospacedDigit(),
          foregroundStyle(c.accent),
          font({ size: 14, weight: 'semibold' }),
        ]}
      >
        {percent}
      </Text>
    ) : (
      <Image systemName={icon} modifiers={[foregroundStyle(iconColor)]} />
    ),
    minimal: going ? (
      <Gauge value={value} modifiers={[gaugeStyle('circularCapacity'), tint(c.accent)]}>
        <Image systemName={icon} />
      </Gauge>
    ) : (
      <Image systemName={icon} modifiers={[foregroundStyle(iconColor)]} />
    ),
    expandedLeading: (
      <HStack spacing={6} modifiers={[padding({ leading: 4 })]}>
        <Image systemName={icon} modifiers={[foregroundStyle(iconColor)]} />
        <Text modifiers={[font({ size: 14, weight: 'semibold' }), lineLimit(1)]}>
          {`#${p.runId}`}
        </Text>
      </HStack>
    ),
    expandedTrailing: going ? (
      <VStack alignment="trailing" modifiers={[padding({ trailing: 4 })]}>
        {clock}
      </VStack>
    ) : (
      <Text modifiers={[font({ size: 14, weight: 'semibold' }), foregroundStyle(iconColor)]}>
        {percent}
      </Text>
    ),
    expandedBottom: (
      <VStack alignment="leading" spacing={6} modifiers={[padding({ horizontal: 4 })]}>
        <Text modifiers={[font({ size: 15, weight: 'bold' }), lineLimit(1)]}>{p.title}</Text>
        <Text modifiers={[font({ size: 13 }), foregroundStyle(c.muted), lineLimit(1)]}>
          {p.line}
        </Text>
        {bar}
        {p.result ? <Text modifiers={[font({ size: 13 }), lineLimit(1)]}>{p.result}</Text> : null}
      </VStack>
    ),
  };
}

/** The run Live Activity; created when Capture starts so the widget knows its layout. */
export const RunActivity = createLiveActivity<RunActivityProps>(RUN_ACTIVITY, RunActivityLayout);
