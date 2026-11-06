import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { centreOf } from '@/domain/board';
import { applyHomography, boardPointOf, CALIBRATION_IDS, fitHomography } from '@/domain/camera';
import type { Point } from '@/domain/darts';
import i18next from '@/i18n';
import capture from '@/i18n/locales/en/capture.json';

import CaptureHome from '../../capture-app/(tabs)/(home)';
import LabelVisit from '../../capture-app/label';
import type { Draft, OutboxItem, SentItem, UploadOutcome } from './outbox';
import { addTips, startLabelling } from './queue';
import { useCapture, useLabelRun, useLaterNote, useShot } from './store';
import type { LabelFile } from './visit';

// Capture's strings are added by its layout at runtime.
i18next.addResourceBundle('en', 'capture', capture);

jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual<typeof import('react')>('react');
  return {
    router: { back: jest.fn(), push: jest.fn(), canGoBack: () => true },
    Redirect: () => null,
    useFocusEffect: (cb: () => void | (() => void)) => useEffect(cb, [cb]),
  };
});
const router = jest.requireMock<{ router: { back: jest.Mock; push: jest.Mock } }>(
  'expo-router',
).router;

// The outbox and drafts in memory instead of Documents.
const mockBox = new Map<string, SentItem & { done: boolean }>();
const mockDrafts = new Map<string, Draft>();
jest.mock('./outboxFiles', () => ({
  fileDrafts: {
    list: () => [...mockDrafts.values()],
    put: (d: Draft) => mockDrafts.set(d.id, d),
    photoUri: (id: string) => `file:///drafts/${id}.jpg`,
    remove: (id: string) => mockDrafts.delete(id),
    mark: (id: string, patch: Partial<Draft>) =>
      mockDrafts.set(id, { ...mockDrafts.get(id)!, ...patch }),
  },
  fileOutbox: {
    pending: () => [...mockBox.values()].filter((i) => !i.done),
    sent: () => [...mockBox.values()].filter((i) => i.done),
    put: (label: LabelFile) => mockBox.set(label.id, { id: label.id, label, done: false }),
    photoUri: (id: string) => `file:///outbox/${id}.jpg`,
    sentPhotoUri: () => null,
    markSent: (id: string, split?: SentItem['split']) =>
      mockBox.set(id, { ...mockBox.get(id)!, done: true, split }),
    sentPhotoCount: () => 0,
    clearSent: () => 0,
    forgetSent: () => 0,
  },
}));

// Lab: up, and taking every upload into the verify set.
const mockUploads: OutboxItem[] = [];
jest.mock('./lab', () => ({
  ...jest.requireActual('./lab'),
  checkLab: async () => ({ ok: true, version: '0.1.0', activeModel: null, sessions: 1 }),
  uploader:
    () =>
    async (item: OutboxItem): Promise<UploadOutcome> => {
      mockUploads.push(item);
      return { kind: 'sent', split: 'test' };
    },
}));
// The sessions Lab has (Lab's Sessions page): null leaves the list unknown.
let mockLabIds: string[] | null = null;
// What Lab says of the photos it was sent to label.
let mockLabStates: Record<string, string> = {};
jest.mock('./labData', () => ({
  ...jest.requireActual('./labData'),
  fetchLabSessions: async () =>
    mockLabIds ? { ok: true, data: { ids: mockLabIds } } : { ok: false, error: 'down' },
  fetchCaptureStates: async (_url: string, ids: string[]) => ({
    ok: true,
    data: { states: Object.fromEntries(ids.map((id) => [id, mockLabStates[id] ?? 'unlabelled'])) },
  }),
}));
// Gesture Handler 3's gestures need Reanimated, which doesn't run under Jest: the photo's pinch
// is inert here (its zoom buttons still work).
jest.mock('react-native-gesture-handler', () => ({
  ...jest.requireActual('react-native-gesture-handler'),
  GestureDetector: ({ children }: { children: unknown }) => children,
  usePinchGesture: () => ({}),
}));
// No model on the phone: nothing is pre-filled.
jest.mock('@/services/vision', () => ({
  detect: async () => ({ modelVersion: null, keypoints: {}, tips: [] }),
}));
jest.mock('expo-file-system', () => ({
  File: class {},
  Directory: class {},
  Paths: {},
  UploadType: {},
}));

const CAMERA = fitHomography([
  { from: { x: -170, y: 170 }, to: { x: 0.25, y: 0.1 } },
  { from: { x: 170, y: 170 }, to: { x: 0.78, y: 0.12 } },
  { from: { x: 170, y: -170 }, to: { x: 0.75, y: 0.9 } },
  { from: { x: -170, y: -170 }, to: { x: 0.28, y: 0.88 } },
])!;
const W = 400;
const H = 300;
const showPhoto = async () =>
  fireEvent(screen.getByTestId('snap-photo-frame'), 'layout', {
    nativeEvent: { layout: { width: W, height: H } },
  });
const tapAt = async (p: Point) => {
  const q = applyHomography(CAMERA, p);
  await fireEvent(screen.getByTestId('snap-photo'), 'responderRelease', {
    nativeEvent: { locationX: q.x * W, locationY: q.y * H },
  });
};

beforeEach(() => {
  mockBox.clear();
  mockDrafts.clear();
  useLabelRun.getState().setRun(null);
  mockUploads.length = 0;
  mockLabIds = null;
  mockLabStates = {};
  router.back.mockClear();
  router.push.mockClear();
  useCapture.setState({
    labUrl: 'my-mac.local:3100',
    prefill: true,
    visits: 0,
    valuesInput: 'keypad',
    session: { id: 'sess-1', startedAt: '2026-11-04T05:00:00.000Z', tags: ['Board light on'] },
  });
  useShot.getState().setShot({
    photo: { uri: 'file:///shot.jpg', width: W, height: H },
    detected: null,
  });
});

async function enterValues(values: ('T20' | '20' | '5' | 'Miss')[]) {
  for (const v of values) {
    if (v === 'Miss') {
      await fireEvent.press(screen.getByTestId('value-miss'));
    } else if (v.startsWith('T')) {
      await fireEvent.press(screen.getByRole('radio', { name: 'Treble' }));
      await fireEvent.press(screen.getByTestId(`key-${v}`));
    } else {
      await fireEvent.press(screen.getByTestId(`key-${v}`));
    }
  }
}

async function markBoard() {
  await fireEvent.press(screen.getByTestId('to-board'));
  await showPhoto();
  for (const k of CALIBRATION_IDS) await tapAt(boardPointOf(k));
  expect(screen.getByTestId('label-board-done')).toBeOnTheScreen();
  await fireEvent.press(screen.getByTestId('to-tips'));
  await showPhoto();
}

it('labels a visit: values, board, tips, then saves it to the outbox and sends it', async () => {
  await render(<LabelVisit />);
  await enterValues(['T20', '5', 'Miss']);
  await markBoard();
  await tapAt(centreOf({ segment: 20, multiplier: 3 }));
  await tapAt(centreOf({ segment: 5, multiplier: 1 }));
  expect(screen.getByTestId('tip-status-0')).toHaveTextContent('Match');
  expect(screen.getByTestId('tip-status-2')).toHaveTextContent('No tip needed');
  await fireEvent.press(screen.getByTestId('to-review'));
  expect(screen.getByTestId('review-total')).toHaveTextContent('65');
  await act(async () => {
    fireEvent.press(screen.getByTestId('save'));
  });

  const [saved] = [...mockBox.values()];
  expect(saved!.label).toMatchObject({
    sessionId: 'sess-1',
    tags: ['Board light on'],
    width: W,
    height: H,
    valuesOnly: false,
  });
  expect(saved!.label.darts.map((d) => [d.value, d.x !== null])).toEqual([
    ['T20', true],
    ['5', true],
    ['Miss', false],
  ]);
  expect(saved!.label.calibration.every((p) => p !== null)).toBe(true);
  // Sent straight away, and Lab's set noted.
  expect(mockUploads).toHaveLength(1);
  expect(saved!.done).toBe(true);
  expect(saved!.split).toBe('test');
  expect(useCapture.getState().visits).toBe(1);
  expect(router.back).toHaveBeenCalled();
});

it('won’t review a tip that disagrees with its value until it’s flagged on the wire', async () => {
  await render(<LabelVisit />);
  await enterValues(['T20', '20']);
  await markBoard();
  await tapAt(centreOf({ segment: 20, multiplier: 3 }));
  await tapAt(centreOf({ segment: 5, multiplier: 1 }));
  expect(screen.getByTestId('tip-status-1')).toHaveTextContent(/Scores 5/);
  expect(screen.getByTestId('to-review')).toBeDisabled();
  await fireEvent.press(screen.getByTestId('tip-wire-1'));
  expect(screen.getByTestId('to-review')).toBeEnabled();
  await fireEvent.press(screen.getByTestId('to-review'));
  await act(async () => {
    fireEvent.press(screen.getByTestId('save'));
  });
  expect([...mockBox.values()][0]!.label.darts[1]).toMatchObject({ value: '20', onWire: true });
});

it('zooms the photo with the buttons and still marks where tapped', async () => {
  await render(<LabelVisit />);
  await enterValues(['T20']);
  await fireEvent.press(screen.getByTestId('to-board'));
  await showPhoto();
  expect(screen.queryByTestId('zoom-fit')).toBeNull();
  await fireEvent.press(screen.getByTestId('zoom-in'));
  expect(screen.getByTestId('zoom-fit')).toHaveTextContent('1.8×');
  // Taps arrive in the photo's own coordinates, zoomed or not.
  for (const k of CALIBRATION_IDS) await tapAt(boardPointOf(k));
  expect(screen.getByTestId('label-board-done')).toBeOnTheScreen();
  await fireEvent.press(screen.getByTestId('zoom-fit'));
  expect(screen.queryByTestId('zoom-fit')).toBeNull();
});

const visitIn = (
  id: string,
  sessionId: string,
  valuesOnly: boolean,
): SentItem & { done: boolean } => ({
  id,
  label: {
    id,
    image: `${id}.jpg`,
    width: W,
    height: H,
    createdAt: '2026-11-04T05:10:00.000Z',
    sessionId,
    sessionStartedAt:
      sessionId === 'sess-1' ? '2026-11-04T05:00:00.000Z' : '2026-11-02T05:00:00.000Z',
    tags: [],
    calibration: [],
    darts: [{ x: null, y: null, value: 'T20' }],
    valuesOnly,
    prefillModel: null,
  },
  done: false,
});
const draftIn = (id: string, sessionId: string, at: string): Draft => ({
  id,
  createdAt: at,
  session: {
    id: sessionId,
    startedAt: sessionId === 'sess-1' ? '2026-11-04T05:00:00.000Z' : '2026-11-02T05:00:00.000Z',
    tags: [],
  },
  width: W,
  height: H,
});

it('shows Lab’s status, sends what’s waiting, and counts each session’s photos', async () => {
  mockBox.set('a', visitIn('a', 'sess-1', true));
  mockBox.set('b', visitIn('b', 'sess-old', false));
  mockDrafts.set('d1', draftIn('d1', 'sess-1', '2026-11-04T05:20:00.000Z'));
  mockDrafts.set('d2', draftIn('d2', 'sess-old', '2026-11-02T05:20:00.000Z'));
  await act(async () => {
    await render(<CaptureHome />);
  });
  expect(screen.getByTestId('capture-lab-status')).toHaveTextContent(/Lab connected/);
  // The visits, and the Label later photos as photos to label in Lab.
  expect(mockUploads.map((u) => u.id).sort()).toEqual(['a', 'b', 'd1', 'd2']);
  expect(
    mockUploads
      .filter((u) => u.label.unlabelled)
      .map((u) => u.id)
      .sort(),
  ).toEqual(['d1', 'd2']);
  expect(screen.getByTestId('capture-pending')).toHaveTextContent('outbox empty');
  // The session being shot: its set, counts, and labelling what's left.
  const current = screen.getByTestId('capture-current');
  expect(current).toHaveTextContent(/VERIFY/);
  expect(current).toHaveTextContent(/2 photos/);
  expect(screen.getByTestId('capture-start')).toHaveTextContent('Keep snapping');
  expect(screen.getByTestId('capture-label-current')).toHaveTextContent('Label 1');
  // Past sessions, each with its counts; Label all leaves the current session alone.
  expect(screen.getByTestId('capture-session-sess-old')).toHaveTextContent(
    /1 labelled.*0 values only.*1 to label/,
  );
  expect(screen.getByTestId('capture-label-all')).toHaveTextContent('Label all 1');
  expect(screen.getByTestId('capture-totals')).toHaveTextContent(
    /4.*Photos.*50%.*Labelled.*2.*To label/,
  );
});

it('says which sessions on the phone Lab hasn’t got, and why', async () => {
  mockLabIds = ['sess-1', 'sess-new'];
  const gone = visitIn('g', 'sess-gone', true);
  mockBox.set('g', { ...gone, done: true });
  mockDrafts.set('n1', draftIn('n1', 'sess-new', '2026-11-03T05:20:00.000Z'));
  await act(async () => {
    await render(<CaptureHome />);
  });
  expect(screen.getByTestId('standing-sess-gone')).toHaveTextContent(
    'Deleted in Lab: 1 sent photo is still on this phone',
  );
  // Its Label later photo went to Lab to be labelled there: nothing to say.
  expect(screen.queryByTestId('standing-sess-new')).toBeNull();
});

it('syncs with Lab when nothing is waiting, and counts photos labelled in Lab', async () => {
  mockDrafts.set('d1', {
    ...draftIn('d1', 'sess-old', '2026-11-02T05:20:00.000Z'),
    sentToLab: true,
  });
  await act(async () => {
    await render(<CaptureHome />);
  });
  expect(screen.getByTestId('capture-session-sess-old')).toHaveTextContent(/1 to label/);
  // Labelled in Lab since: Sync with Lab picks it up.
  mockLabStates = { d1: 'labelled' };
  expect(screen.getByTestId('capture-sync')).not.toBeDisabled();
  await act(async () => {
    await fireEvent.press(screen.getByTestId('capture-sync'));
  });
  expect(screen.getByTestId('capture-sync-note')).toHaveTextContent('1 labelled in Lab');
  expect(screen.getByTestId('capture-session-sess-old')).toHaveTextContent(/1 labelled.*All done/);
  expect(mockUploads).toEqual([]);
});

it('takes the values from taps on a board, and remembers picking it', async () => {
  await render(<LabelVisit />);
  await fireEvent.press(screen.getByRole('radio', { name: 'Board' }));
  expect(useCapture.getState().valuesInput).toBe('board');
  await fireEvent(screen.getByTestId('values-board-area'), 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width: 400, height: 400 } },
  });
  // On a 400 pt board, 1 pt is 1 mm: the treble 20 is 103 mm above the centre.
  const tap = async (x: number, y: number) => {
    const board = screen.getByTestId('board');
    const at = { nativeEvent: { locationX: x, locationY: y } };
    await fireEvent(board, 'responderGrant', at);
    await fireEvent(board, 'responderRelease', at);
  };
  await tap(200, 97);
  await fireEvent.press(screen.getByTestId('value-miss'));
  await tap(200, 200);
  await act(async () => {
    fireEvent.press(screen.getByTestId('values-save-values-only'));
  });
  const [item] = [...mockBox.values()];
  expect(item!.label.darts.map((d) => d.value)).toEqual(['T20', 'Miss', 'Bull']);
});

it('saves a photo to label later and goes back to the camera', async () => {
  await render(<LabelVisit />);
  await fireEvent.press(screen.getByTestId('label-later'));
  const [draft] = [...mockDrafts.values()];
  expect(draft).toMatchObject({ session: { id: 'sess-1' }, width: W, height: H });
  expect(mockBox.size).toBe(0);
  expect(useCapture.getState().visits).toBe(1);
  // The camera's note can take it back.
  expect(useLaterNote.getState().draftId).toBe(draft!.id);
  expect(router.back).toHaveBeenCalled();
});

it('saves the values alone, from the values step or the board step, to add the rest later', async () => {
  await render(<LabelVisit />);
  expect(screen.getByTestId('values-save-values-only')).toBeDisabled();
  await enterValues(['T20', '5']);
  await act(async () => {
    fireEvent.press(screen.getByTestId('values-save-values-only'));
  });
  const [first] = [...mockBox.values()];
  expect(first!.label).toMatchObject({
    valuesOnly: true,
    calibration: [null, null, null, null, null],
  });
  expect(first!.label.darts.map((d) => [d.value, d.x])).toEqual([
    ['T20', null],
    ['5', null],
  ]);
  // From the board step, before any point is placed.
  mockBox.clear();
  useShot
    .getState()
    .setShot({ photo: { uri: 'file:///p.jpg', width: W, height: H }, detected: null });
  await act(async () => {
    await render(<LabelVisit />);
  });
  await enterValues(['20']);
  await fireEvent.press(screen.getByTestId('to-board'));
  await act(async () => {
    fireEvent.press(screen.getByTestId('board-save-values-only'));
  });
  expect([...mockBox.values()][0]!.label).toMatchObject({ valuesOnly: true });
});

it('labels drafts one after another: values only, skip, then done', async () => {
  mockDrafts.set('d1', draftIn('d1', 'sess-old', '2026-11-02T05:10:00.000Z'));
  mockDrafts.set('d2', draftIn('d2', 'sess-old', '2026-11-02T05:20:00.000Z'));
  await act(async () => {
    await startLabelling(['d1', 'd2']);
  });
  expect(router.push).toHaveBeenCalledWith('/label');
  await render(<LabelVisit />);
  expect(screen.getByTestId('label-run')).toHaveTextContent(/Photo 1 of 2 to label/);
  // A draft has nothing to retake, and no Label later.
  expect(screen.queryByTestId('label-later')).toBeNull();
  await enterValues(['20']);
  await markBoard();
  await act(async () => {
    fireEvent.press(screen.getByTestId('save-values-only'));
  });
  // Saved under the draft's own ID and session, and the draft is gone.
  expect(mockBox.get('d1')!.label).toMatchObject({ sessionId: 'sess-old', valuesOnly: true });
  expect(mockDrafts.has('d1')).toBe(false);
  expect(screen.getByTestId('label-run')).toHaveTextContent(/Photo 2 of 2 to label/);
  await act(async () => {
    fireEvent.press(screen.getByTestId('label-run-skip'));
  });
  expect(mockDrafts.has('d2')).toBe(true);
  expect(useLabelRun.getState().run).toMatchObject({ valuesOnly: 1, skipped: 1, labelled: 0 });
  // The summary, on the same screen; Done goes back where labelling started.
  expect(screen.getByTestId('label-done')).toHaveTextContent(/Done for now/);
  expect(screen.getByTestId('label-done')).toHaveTextContent(/1 photo skipped/);
  await fireEvent.press(screen.getByTestId('label-done-close'));
  expect(useLabelRun.getState().run).toBeNull();
  expect(router.back).toHaveBeenCalled();
});

it('adds the tips to a values-only visit and saves it under its own ID', async () => {
  const saved = visitIn('vo', 'sess-old', true);
  saved.label.darts = [
    { x: null, y: null, value: 'T20' },
    { x: null, y: null, value: '5' },
  ];
  mockBox.set('vo', saved);
  expect(addTips('vo')).toBe(true);
  await render(<LabelVisit />);
  // Its values are already in; no label later, no retake.
  expect(screen.queryByTestId('label-later')).toBeNull();
  expect(screen.getByTestId('label-back')).toHaveTextContent('Back');
  await markBoard();
  await tapAt(centreOf({ segment: 20, multiplier: 3 }));
  await tapAt(centreOf({ segment: 5, multiplier: 1 }));
  expect(screen.queryByTestId('save-values-only')).toBeNull();
  await fireEvent.press(screen.getByTestId('to-review'));
  await act(async () => {
    fireEvent.press(screen.getByTestId('save'));
  });
  const again = mockBox.get('vo')!;
  expect(again.label).toMatchObject({
    sessionId: 'sess-old',
    createdAt: saved.label.createdAt,
    valuesOnly: false,
  });
  expect(again.label.darts.every((d) => d.x !== null)).toBe(true);
  expect(router.back).toHaveBeenCalled();
});
