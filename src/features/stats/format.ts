// Small formatting helpers for the stats screens.
import { rangeBounds, type StatsRange } from '@/domain/stats';

/** "12 Oct". */
export const shortDate = (t: number, locale = 'en') =>
  new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(t);

/** "October 2026". */
export const monthTitle = (t: number, locale = 'en') =>
  new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(t);

/** "12 Oct 2026". */
export const longDate = (t: number, locale = 'en') =>
  new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(t);

/** The range's dates, for a custom range's label. */
export function rangeText(r: StatsRange, now: number): { from: string; to: string } {
  const b = rangeBounds(r, now);
  return { from: shortDate(b.from), to: shortDate(b.to) };
}

export const pct = (x: number) => Math.round(x * 100);

/** A number for a chart label: one decimal under 100, whole above. */
export const fmt1 = (v: number) => (Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(1));
