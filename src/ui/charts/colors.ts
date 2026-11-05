// Chart colours, all derived from the theme's tokens (docs/design/themes.md): you in the
// accent, everyone else in muted greys told apart by lightness and dash, never hue alone.
import type { AppTheme } from '@/theme/themes';

const hex = (c: string) => {
  const h = c.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
};

/** `a` mixed toward `b` by t (0 = a, 1 = b). */
export function mix(a: string, b: string, t: number): string {
  const x = hex(a);
  const y = hex(b);
  return (
    '#' +
    x
      .map((v, i) => Math.round(v + (y[i]! - v) * Math.min(1, Math.max(0, t))))
      .map((v) => v.toString(16).padStart(2, '0'))
      .join('')
  );
}

/** A shade for a level 0–1: from the empty cell colour up to the accent. */
export const ramp = (theme: AppTheme, level: number) =>
  mix(theme.colors.surface2, theme.colors.accent, 0.15 + 0.85 * level);

/** Five steps of the ramp, for legends and cells that bucket a rate. */
export const RAMP_STEPS = [0, 0.25, 0.5, 0.75, 1] as const;

export type SeriesTone = 'you' | 'other' | 'third' | 'fourth';

export const TONES: SeriesTone[] = ['you', 'other', 'third', 'fourth'];

/** Line and bar styles per series. */
export function toneStyle(theme: AppTheme, tone: SeriesTone) {
  const { accent, muted, line, text } = theme.colors;
  switch (tone) {
    case 'you':
      return { color: accent, width: 3, dash: undefined };
    case 'other':
      return { color: muted, width: 2.5, dash: '6 4' };
    case 'third':
      return { color: mix(muted, line, 0.45), width: 2.5, dash: '2 4' };
    case 'fourth':
      return { color: mix(muted, text, 0.5), width: 2, dash: '10 4' };
  }
}

/** Tones for a line-up: you first when you're playing, others in order. */
export function tonesFor(players: number, youIndex: number): SeriesTone[] {
  const others = TONES.slice(1);
  let k = 0;
  return Array.from({ length: players }, (_, i) =>
    i === youIndex ? 'you' : (others[k++ % others.length] ?? 'other'),
  );
}
