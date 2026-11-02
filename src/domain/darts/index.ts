// Darts and hits (ADR 0006, docs/architecture/data-model.md). Every dart is one event; games,
// stats and replay are derived from the ordered list of events.

/** Board types (ADR 0003). Steel tip in v1; soft tip changes the ring sizes later. */
export type BoardType = 'steel';

/** A point in board space: millimetres from the bull, x to the right, y up (the 20 is up). */
export interface Point {
  x: number;
  y: number;
}

/** Where on the board a dart landed. */
export type Ring =
  'miss' | 'innerSingle' | 'treble' | 'outerSingle' | 'double' | 'outerBull' | 'innerBull';

/** Segment 1–20, 25 for both bulls, 0 for a miss. */
export type Segment = number;

export const BULL = 25;

export interface Hit {
  segment: Segment;
  ring: Ring;
  /** 0 for a miss, 1 single and outer bull, 2 double and inner bull, 3 treble. */
  multiplier: 0 | 1 | 2 | 3;
  score: number;
  /** Doubles and the inner bull: what finishes a double-out leg. */
  isDouble: boolean;
}

/** Something to aim at: "T20", "D16", "S5", the bulls. Singles have no ring preference. */
export interface Target {
  segment: Segment;
  multiplier: 1 | 2 | 3;
}

export type DartSource = 'tap' | 'keypad' | 'bot';

export interface PlayerRef {
  id: string;
  name: string;
  /** A bot's level (1–5); undefined for people. */
  botLevel?: number;
}

export interface DartEvent {
  id: string;
  sessionId: string;
  playerId: string;
  /** Order within the session, from 0. The fold sorts by this. */
  seq: number;
  /** Where it landed; null for a keypad dart or a miss off the board with no position. */
  point: Point | null;
  hit: Hit;
  /** What the thrower was aiming at, when known (checkout route, drill target, bot aim). */
  intended?: Target;
  source: DartSource;
  /** Tap-on-board darts are exact; keypad darts are placed at the segment centre. */
  precision: 'exact' | 'segment';
  corrected: boolean;
  /** Epoch milliseconds, UTC. */
  at: number;
}

const MISS: Hit = { segment: 0, ring: 'miss', multiplier: 0, score: 0, isDouble: false };

export const miss = (): Hit => ({ ...MISS });

/** A hit from a keypad entry: segment 1–20 or 25, multiplier 1–3 (2 on 25 is the inner bull). */
export function hitOf(segment: Segment, multiplier: 1 | 2 | 3): Hit {
  if (segment === BULL) {
    if (multiplier === 3) throw new RangeError('There is no treble bull');
    return multiplier === 2
      ? { segment, ring: 'innerBull', multiplier: 2, score: 50, isDouble: true }
      : { segment, ring: 'outerBull', multiplier: 1, score: 25, isDouble: false };
  }
  if (!Number.isInteger(segment) || segment < 1 || segment > 20) {
    throw new RangeError(`No segment ${segment} on the board`);
  }
  const ring = multiplier === 3 ? 'treble' : multiplier === 2 ? 'double' : 'outerSingle';
  return { segment, ring, multiplier, score: segment * multiplier, isDouble: multiplier === 2 };
}

export const hitOfTarget = (t: Target): Hit => hitOf(t.segment, t.multiplier);

/** Short label: "T20", "D16", "5", "25", "Bull", "Miss". */
export function label(h: Hit | Target): string {
  if ('ring' in h && h.ring === 'miss') return 'Miss';
  if (h.segment === BULL) return h.multiplier === 2 ? 'Bull' : '25';
  if (h.multiplier === 3) return `T${h.segment}`;
  if (h.multiplier === 2) return `D${h.segment}`;
  return `${h.segment}`;
}

export const sameTarget = (a: Target, b: Target) =>
  a.segment === b.segment && a.multiplier === b.multiplier;
