import { centreOf, polar } from '@/domain/board';
import { applyHomography, boardPointOf, CALIBRATION_IDS, fitHomography } from '@/domain/camera';
import type { Point } from '@/domain/darts';
import type { DetectResult } from '@/services/vision';

import {
  alternatives,
  back,
  BOUNCE_OUT,
  chooseMine,
  chooseModel,
  confirmedAsRead,
  enterMyself,
  readOf,
  removeDart,
  revealRead,
  setValue,
  startBlind,
  startRead,
  canReview,
  checks,
  enter,
  labelFile,
  MISS,
  remark,
  resume,
  selectDart,
  start,
  tapBoard,
  tapTip,
  toBoard,
  toggleWire,
  toReview,
  toTips,
  undoEnter,
  visitTotal,
  type VisitState,
} from './visit';

// The board seen a little from the left, as in the snap-to-score tests.
const CAMERA = fitHomography([
  { from: { x: -170, y: 170 }, to: { x: 0.25, y: 0.1 } },
  { from: { x: 170, y: 170 }, to: { x: 0.78, y: 0.12 } },
  { from: { x: 170, y: -170 }, to: { x: 0.75, y: 0.9 } },
  { from: { x: -170, y: -170 }, to: { x: 0.28, y: 0.88 } },
])!;
const img = (p: Point) => applyHomography(CAMERA, p);
const photo = { uri: 'file:///p.jpg', width: 400, height: 300 };
const T20 = centreOf({ segment: 20, multiplier: 3 });
const S5 = centreOf({ segment: 5, multiplier: 1 });

function markBoard(s: VisitState) {
  return CALIBRATION_IDS.reduce((acc, id) => tapBoard(acc, img(boardPointOf(id))), s);
}

describe('labelling a visit', () => {
  it('goes values → board → tips → review when every tip matches', () => {
    let s = start(photo, null);
    s = enter(enter(enter(s, 'T20'), '5'), MISS);
    expect(s.entered).toEqual(['T20', '5', MISS]);
    s = toBoard(s);
    expect(s.step).toBe('board');
    s = markBoard(s);
    expect(s.fit).not.toBeNull();
    s = toTips(s);
    expect(s.selected).toBe(0);
    s = tapTip(s, img(T20));
    expect(s.selected).toBe(1);
    s = tapTip(s, img(S5));
    // The miss needs no tip.
    expect(s.selected).toBeNull();
    expect(checks(s).map((c) => [c.scored, c.ok])).toEqual([
      ['T20', true],
      ['5', true],
      [null, true],
    ]);
    expect(canReview(s)).toBe(true);
    expect(toReview(s).step).toBe('review');
  });

  it('holds a visit whose tip disagrees until it moves or is flagged on the wire', () => {
    let s = toTips(markBoard(toBoard(enter(enter(start(photo, null), 'T20'), '20'))));
    s = tapTip(tapTip(s, img(T20)), img(S5));
    expect(checks(s)[1]).toMatchObject({ entered: '20', scored: '5', match: false, ok: false });
    expect(canReview(s)).toBe(false);
    expect(toReview(s).step).toBe('tips');
    // Flag it…
    expect(canReview(toggleWire(s, 1))).toBe(true);
    // …or move it.
    s = tapTip(selectDart(s, 1), img(centreOf({ segment: 20, multiplier: 1 })));
    expect(checks(s)[1]!.match).toBe(true);
  });

  it('caps a visit at three darts and undoes the last value', () => {
    let s = start(photo, null);
    for (const v of ['1', '2', '3', '4']) s = enter(s, v);
    expect(s.entered).toEqual(['1', '2', '3']);
    expect(undoEnter(s).entered).toEqual(['1', '2']);
  });

  it('starts marking again when the points don’t make a board', () => {
    let s = toBoard(enter(start(photo, null), 'T20'));
    for (let i = 0; i < 5; i++) s = tapBoard(s, { x: 0.5, y: 0.5 });
    expect(s.markFailed).toBe(true);
    expect(s.marking).toBe(0);
    expect(s.fit).toBeNull();
  });

  it('keeps work when stepping back', () => {
    let s = toTips(markBoard(toBoard(enter(start(photo, null), 'T20'))));
    s = tapTip(s, img(T20));
    const b = back(back(s));
    expect(b.step).toBe('values');
    expect(toTips(toBoard(b)).tips[0]).toEqual(img(T20));
  });
});

describe('with a model', () => {
  const detected: DetectResult = {
    width: 400,
    height: 300,
    sharpness: 1,
    modelVersion: 'v3',
    keypoints: Object.fromEntries(
      CALIBRATION_IDS.map((id) => [id, { ...img(boardPointOf(id)), c: 0.9 }]),
    ),
    tips: [
      { ...img(S5), c: 0.8 },
      { ...img(T20), c: 0.95 },
    ],
  };

  it('pre-fills the board and matches the model’s tips to the values entered', () => {
    let s = start(photo, detected);
    expect(s.boardFromModel).toBe(true);
    s = toTips(toBoard(enter(enter(s, '5'), 'T20')));
    expect(s.tips).toEqual([img(S5), img(T20)].map((p) => ({ x: p.x, y: p.y })));
    expect(s.tipsFromModel).toBe(2);
    expect(canReview(s)).toBe(true);
    expect(labelFile(s, meta).prefillModel).toBe('v3');
  });

  it('drops the model’s board when re-marked, but still sends what it proposed', () => {
    const s = remark(toBoard(enter(start(photo, detected), '5')));
    expect(s.boardFromModel).toBe(false);
    expect(s.marking).toBe(0);
    const f = labelFile(s, meta);
    expect(f.prefillModel).toBe('v3');
    expect(f.prefill?.calibration.every((p) => p !== null)).toBe(true);
  });

  it('sends the model’s proposal as placed, after the player moves a tip', () => {
    let s = toTips(toBoard(enter(enter(start(photo, detected), '5'), 'T20')));
    const placed = s.tips[0]!;
    s = tapTip(selectDart(s, 0), img(polar(60, 72)));
    const f = labelFile(s, meta);
    expect(f.darts[0]).toMatchObject({ x: expect.any(Number) });
    expect(f.darts[0]!.x).not.toBe(placed.x);
    expect(f.prefill?.tips[0]?.x).toBeCloseTo(placed.x, 4);
    expect(f.prefill?.tips[0]?.y).toBeCloseTo(placed.y, 4);
    expect(f.prefill?.tips).toHaveLength(2);
  });

  it('sends no proposal without a model', () => {
    const s = toTips(markBoard(toBoard(enter(start(photo, null), 'T20'))));
    expect(labelFile(s, meta)).not.toHaveProperty('prefill');
    expect(labelFile(s, meta).prefillModel).toBeNull();
  });
});

const meta = {
  id: 'cap-1',
  createdAt: '2026-11-04T05:10:00.000Z',
  session: { id: 'sess-1', startedAt: '2026-11-04T05:00:00.000Z', tags: ['light on'] },
  zoom: 1,
};

describe('labelFile', () => {
  it('writes Lab’s format: DeepDarts point order, one entry per dart, flags', () => {
    let s = toTips(
      markBoard(toBoard(enter(enter(enter(start(photo, null), 'T20'), '20'), BOUNCE_OUT))),
    );
    s = toggleWire(tapTip(tapTip(s, img(T20)), img(S5)), 1);
    const f = labelFile(s, meta);
    expect(f).toMatchObject({
      id: 'cap-1',
      image: 'cap-1.jpg',
      width: 400,
      height: 300,
      sessionId: 'sess-1',
      tags: ['light on'],
      valuesOnly: false,
      prefillModel: null,
      zoom: 1,
    });
    expect(f.calibration).toHaveLength(5);
    expect(f.calibration.every((p) => p !== null)).toBe(true);
    expect(f.darts.map((d) => [d.value, d.x !== null, d.onWire ?? false])).toEqual([
      ['T20', true, false],
      ['20', true, true],
      [BOUNCE_OUT, false, false],
    ]);
  });

  it('drops the tips for a values-only save', () => {
    const s = toTips(markBoard(toBoard(enter(start(photo, null), 'T20'))));
    const f = labelFile(tapTip(s, img(T20)), meta, true);
    expect(f.valuesOnly).toBe(true);
    expect(f.darts).toEqual([{ x: null, y: null, value: 'T20' }]);
  });
});

it('picks up a values-only visit with its values and board, to add the tips', () => {
  const saved = labelFile(
    markBoard(toBoard(enter(enter(start(photo, null), 'T20'), '5'))),
    meta,
    true,
  );
  const s = resume(photo, saved);
  expect(s.step).toBe('values');
  expect(s.entered).toEqual(['T20', '5']);
  expect(s.fit).not.toBeNull();
  // Straight past the board it already has, to tap the tips.
  const tips = toTips(toBoard(s));
  expect(tips.step).toBe('tips');
  const done = toReview(tapTip(tapTip(tips, img(T20)), img(S5)));
  expect(done.step).toBe('review');
  expect(labelFile(done, meta).darts.every((d) => d.x !== null)).toBe(true);
  // Without a board it starts marking from the first point.
  expect(resume(photo, { ...saved, calibration: [null, null, null, null, null] }).marking).toBe(0);
});

it('adds up a visit from its values', () => {
  expect(visitTotal(['T20', '5', MISS])).toBe(65);
  expect(visitTotal(['Bull', '25', 'D16'])).toBe(107);
});

describe('the model reads the visit', () => {
  const S1 = centreOf({ segment: 1, multiplier: 1 });
  // On the wire between the 5 and the 20, just in the 5.
  const WIRE = polar(130, -9.6);
  const detected: DetectResult = {
    width: 400,
    height: 300,
    sharpness: 1,
    modelVersion: 'v6',
    keypoints: Object.fromEntries(
      CALIBRATION_IDS.map((id) => [id, { ...img(boardPointOf(id)), c: 0.9 }]),
    ),
    tips: [
      { ...img(S1), c: 0.5 },
      { ...img(T20), c: 0.95 },
      { ...img(WIRE), c: 0.9 },
      { ...img(S5), c: 0.1 },
    ],
  };
  const meta = {
    id: 'v1',
    createdAt: '2026-11-06T20:00:10.000Z',
    session: { id: 's', startedAt: '2026-11-06T20:00:00.000Z', tags: [] },
  };

  it('reads up to three darts, most confident first, saying which it is unsure of', () => {
    const read = readOf(start(photo, detected))!;
    expect(read.map((r) => [r.value, r.sure, r.doubt])).toEqual([
      ['T20', true, null],
      ['5', false, 'nearWire'],
      ['1', false, 'faint'],
    ]);
    expect(readOf(start(photo, null))).toBeNull();
  });

  it('confirms a read as it is, and sends it with the label', () => {
    const s = startRead(start(photo, detected, 0));
    expect(s.step).toBe('read');
    expect(s.entered).toEqual(['T20', '5', '1']);
    expect(canReview(s)).toBe(true);
    expect(confirmedAsRead(s)).toBe(true);
    const f = labelFile(s, { ...meta, now: 9000 });
    expect(f.labelMode).toBe('read');
    expect(f.read!.model).toBe('v6');
    expect(f.read!.darts.map((d) => [d.value, d.sure])).toEqual([
      ['T20', true],
      ['5', false],
      ['1', false],
    ]);
    expect(f.seconds).toBe(9);
    expect(f.prefill!.tips).toHaveLength(3);
  });

  it('fixes a dart: another value, its tip moved, or not a dart at all', () => {
    let s = startRead(start(photo, detected));
    expect(alternatives(s, 1)).toContain('20');
    s = setValue(s, 1, '20');
    // The tip still scores the 5: it has to move, or be flagged on the wire.
    expect(canReview(s)).toBe(false);
    s = toggleWire(s, 1);
    expect(canReview(s)).toBe(true);
    expect(confirmedAsRead(s)).toBe(false);
    s = removeDart(selectDart(s, 2), 2);
    expect(s.entered).toEqual(['T20', '20']);
    expect(s.proposal!.tips).toHaveLength(2);
    // A bounce-out loses its tip.
    s = setValue(s, 1, BOUNCE_OUT);
    expect(s.tips[1]).toBeNull();
    expect(canReview(s)).toBe(true);
  });

  it('moves a tip on the read, keeping the dart picked', () => {
    let s = selectDart(startRead(start(photo, detected)), 1);
    s = tapTip(s, img(S5));
    expect(s.selected).toBe(1);
    expect(checks(s)[1]!.scored).toBe('5');
    expect(s.edited).toBe(true);
  });

  it('enters it the usual way from the read, keeping the read to start from', () => {
    const s = enterMyself(startRead(start(photo, detected)));
    expect(s.step).toBe('values');
    expect(s.entered).toEqual(['T20', '5', '1']);
    expect(labelFile(s, meta).labelMode).toBe('read');
  });

  it('a blind check that agrees goes on to the read', () => {
    let s = startBlind(start(photo, detected));
    expect(s.mode).toBe('blind');
    expect(s.step).toBe('values');
    s = revealRead(enter(enter(enter(s, '1'), 'T20'), '5'));
    expect(s.step).toBe('read');
    expect(s.blind).toEqual({ values: ['1', 'T20', '5'], agreed: true });
    expect(labelFile(s, meta).blind).toEqual({ values: ['1', 'T20', '5'], agreed: true });
  });

  it('a blind check that disagrees asks whose values are right', () => {
    const entered = revealRead(
      enter(enter(enter(startBlind(start(photo, detected)), 'T20'), '20'), '1'),
    );
    expect(entered.step).toBe('disagree');
    expect(entered.blind!.agreed).toBe(false);
    const mine = chooseMine(entered);
    expect(mine.step).toBe('board');
    expect(mine.entered).toEqual(['T20', '20', '1']);
    expect(mine.blind!.chose).toBe('mine');
    const model = chooseModel(entered);
    expect(model.step).toBe('read');
    expect(model.entered).toEqual(['T20', '5', '1']);
    expect(labelFile(model, meta)).toMatchObject({
      labelMode: 'blind',
      blind: { values: ['T20', '20', '1'], agreed: false, chose: 'model' },
    });
    expect(back(entered).step).toBe('values');
  });

  it("without the model's board there is no read: the values are entered", () => {
    const s = startRead(start(photo, null));
    expect(s.step).toBe('values');
    expect(s.mode).toBe('entered');
    expect(startBlind(start(photo, null)).mode).toBe('entered');
  });
});
