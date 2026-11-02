import type { DartEvent, Ring } from '@/domain/darts';

import type { darts } from './schema';

type DartRow = typeof darts.$inferSelect;

/** A dart row from the database as a domain event. */
export function dartFromRow(r: DartRow): DartEvent {
  return {
    id: r.id,
    sessionId: r.sessionId,
    playerId: r.playerId,
    seq: r.seq,
    point: r.x === null || r.y === null ? null : { x: r.x, y: r.y },
    hit: {
      segment: r.segment,
      ring: r.ring as Ring,
      multiplier: r.multiplier as 0 | 1 | 2 | 3,
      score: r.score,
      isDouble: r.isDouble,
    },
    intended:
      r.intendedSegment === null || r.intendedMultiplier === null
        ? undefined
        : { segment: r.intendedSegment, multiplier: r.intendedMultiplier as 1 | 2 | 3 },
    source: r.source,
    precision: r.precision,
    corrected: r.corrected,
    at: r.at,
  };
}

export function rowFromDart(d: DartEvent): DartRow {
  return {
    id: d.id,
    sessionId: d.sessionId,
    seq: d.seq,
    playerId: d.playerId,
    x: d.point?.x ?? null,
    y: d.point?.y ?? null,
    segment: d.hit.segment,
    ring: d.hit.ring,
    multiplier: d.hit.multiplier,
    score: d.hit.score,
    isDouble: d.hit.isDouble,
    intendedSegment: d.intended?.segment ?? null,
    intendedMultiplier: d.intended?.multiplier ?? null,
    source: d.source,
    precision: d.precision,
    corrected: d.corrected,
    at: d.at,
  };
}
