import { describe, expect, it } from 'vitest';

import { CALIBRATION_IDS } from '@domain/camera';

import { alignGuess, defaultPoints, medianPoints, nearest } from './guess';

describe('medianPoints', () => {
  it('takes each point across the photos that have it', () => {
    const m = medianPoints([
      { bull: { x: 0.5, y: 0.5 }, cal20: { x: 0.5, y: 0.1 } },
      { bull: { x: 0.52, y: 0.5 } },
      { bull: { x: 0.9, y: 0.5 } },
    ]);
    expect(m.bull).toEqual({ x: 0.52, y: 0.5 });
    expect(m.cal20).toEqual({ x: 0.5, y: 0.1 });
    expect(m.cal6).toBeUndefined();
  });
});

describe('defaultPoints', () => {
  it('puts the bull in the middle and the 20 straight above it', () => {
    const p = defaultPoints(400, 300);
    expect(p.bull).toEqual({ x: 0.5, y: 0.5 });
    expect(p.cal20!.y).toBeLessThan(0.5);
    expect(CALIBRATION_IDS.every((id) => p[id])).toBe(true);
  });
});

describe('alignGuess', () => {
  const guess = defaultPoints(400, 400);
  it('shifts, scales and turns the guess onto the placed points, returning the rest', () => {
    // The real board: the guess moved right by 40 px and half the size.
    const move = (p: { x: number; y: number }) => ({
      x: 0.5 + (p.x - 0.5) / 2 + 0.1,
      y: 0.5 + (p.y - 0.5) / 2,
    });
    const placed = { bull: move(guess.bull!), cal20: move(guess.cal20!) };
    const out = alignGuess(guess, placed, 400, 400);
    expect(Object.keys(out).sort()).toEqual(['cal11', 'cal3', 'cal6']);
    expect(out.cal6!.x).toBeCloseTo(move(guess.cal6!).x, 6);
    expect(out.cal6!.y).toBeCloseTo(move(guess.cal6!).y, 6);
  });
  it('with one placed point, only shifts', () => {
    const out = alignGuess(guess, { bull: { x: 0.6, y: 0.5 } }, 400, 400);
    expect(out.cal20!.x).toBeCloseTo(guess.cal20!.x + 0.1, 6);
    expect(out.cal20!.y).toBeCloseTo(guess.cal20!.y, 6);
  });
  it('with none placed, is the guess', () => {
    expect(alignGuess(guess, {}, 400, 400)).toEqual(guess);
  });
});

describe('nearest', () => {
  it('keeps the photos closest in time', () => {
    const photos = Array.from({ length: 20 }, (_, i) => ({ takenAt: i * 10 }));
    expect(nearest(photos, 100).map((p) => p.takenAt)).toEqual([
      100, 90, 110, 80, 120, 70, 130, 60, 140,
    ]);
  });
});
