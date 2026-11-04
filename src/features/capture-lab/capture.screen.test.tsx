import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { centreOf } from '@/domain/board';
import { applyHomography, boardPointOf, CALIBRATION_IDS, fitHomography } from '@/domain/camera';
import type { Point } from '@/domain/darts';
import i18next from '@/i18n';
import capture from '@/i18n/locales/en/capture.json';

import CaptureHome from '../../capture-app';
import LabelVisit from '../../capture-app/label';
import type { OutboxItem, SentItem, UploadOutcome } from './outbox';
import { useCapture, useShot } from './store';
import type { LabelFile } from './visit';

// Capture's strings are added by its layout at runtime.
i18next.addResourceBundle('en', 'capture', capture);

jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual<typeof import('react')>('react');
  return {
    router: { back: jest.fn(), push: jest.fn() },
    Redirect: () => null,
    useFocusEffect: (cb: () => void | (() => void)) => useEffect(cb, [cb]),
  };
});
const router = jest.requireMock<{ router: { back: jest.Mock; push: jest.Mock } }>(
  'expo-router',
).router;

// The outbox in memory instead of Documents.
const mockBox = new Map<string, SentItem & { done: boolean }>();
jest.mock('./outboxFiles', () => ({
  fileOutbox: {
    pending: () => [...mockBox.values()].filter((i) => !i.done),
    sent: () => [...mockBox.values()].filter((i) => i.done),
    put: (label: LabelFile) => mockBox.set(label.id, { id: label.id, label, done: false }),
    photoUri: (id: string) => `file:///outbox/${id}.jpg`,
    markSent: (id: string, split?: SentItem['split']) =>
      mockBox.set(id, { ...mockBox.get(id)!, done: true, split }),
    sentPhotoCount: () => 0,
    clearSent: () => 0,
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
// Gesture Handler 3's gestures need Reanimated, which doesn't run under Jest: the photo's pinch
// is inert here (its zoom buttons still work).
jest.mock('react-native-gesture-handler', () => ({
  ...jest.requireActual('react-native-gesture-handler'),
  GestureDetector: ({ children }: { children: unknown }) => children,
  usePinchGesture: () => ({}),
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
  mockUploads.length = 0;
  router.back.mockClear();
  router.push.mockClear();
  useCapture.setState({
    labUrl: 'my-mac.local:3100',
    prefill: true,
    visits: 0,
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

it('shows Lab’s status, sends what’s waiting, and lists sessions with their set', async () => {
  mockBox.set('a', {
    id: 'a',
    label: {
      id: 'a',
      image: 'a.jpg',
      width: W,
      height: H,
      createdAt: '2026-11-04T05:10:00.000Z',
      sessionId: 'sess-1',
      sessionStartedAt: '2026-11-04T05:00:00.000Z',
      tags: [],
      calibration: [],
      darts: [{ x: null, y: null, value: 'T20' }],
      valuesOnly: true,
      prefillModel: null,
    },
    done: false,
  });
  await act(async () => {
    await render(<CaptureHome />);
  });
  expect(screen.getByTestId('capture-lab-status')).toHaveTextContent(/Lab connected/);
  expect(mockUploads.map((u) => u.id)).toEqual(['a']);
  expect(screen.getByTestId('capture-pending')).toHaveTextContent('Nothing waiting');
  expect(screen.getByTestId('capture-session-sess-1')).toHaveTextContent(/VERIFY/);
  expect(screen.getByTestId('capture-start')).toHaveTextContent(/Continue session/);
});
