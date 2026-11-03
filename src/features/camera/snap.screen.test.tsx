import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { centreOf } from '@/domain/board';
import { applyHomography, boardPointOf, CALIBRATION_IDS, fitHomography } from '@/domain/camera';
import type { Point } from '@/domain/darts';
import { X01_DEFAULTS } from '@/domain/games/x01';
import { db } from '@/services/db/client';
import { captures } from '@/services/db/schema';
import { loadDarts } from '@/services/db/sessionsRepo';

import { resetTestDb } from '../../../test/sqlite';
import Snap from '../../app/snap/[sessionId]';
import { startX01 } from '../game/session';
import { useGame } from '../game/store';

jest.mock('@/services/db/client', () => jest.requireActual('../../../test/sqlite').testClient());
jest.mock('expo-router', () => ({
  router: { back: jest.fn(), push: jest.fn(), replace: jest.fn(), navigate: jest.fn() },
  useLocalSearchParams: () => mockParams,
}));
let mockParams: Record<string, string> = {};
const router = jest.requireMock<{ router: { back: jest.Mock } }>('expo-router').router;

jest.mock('expo-camera', () => {
  const { forwardRef, useImperativeHandle, createElement } =
    jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    useCameraPermissions: () => [{ granted: true, canAskAgain: true }, jest.fn()],
    CameraView: forwardRef((_props: object, ref) => {
      useImperativeHandle(ref, () => ({
        takePictureAsync: async () => ({ uri: 'file:///photo.jpg', width: 400, height: 300 }),
      }));
      return createElement(View, { testID: 'camera' });
    }),
  };
});

// The photo: the board seen a little from the left, in a 400 × 300 frame.
const CAMERA = fitHomography([
  { from: { x: -170, y: 170 }, to: { x: 0.25, y: 0.1 } },
  { from: { x: 170, y: 170 }, to: { x: 0.78, y: 0.12 } },
  { from: { x: 170, y: -170 }, to: { x: 0.75, y: 0.9 } },
  { from: { x: -170, y: -170 }, to: { x: 0.28, y: 0.88 } },
])!;
const W = 400;
const H = 300;
const tapAt = async (p: Point) => {
  const q = applyHomography(CAMERA, p);
  await fireEvent(screen.getByTestId('snap-photo'), 'responderRelease', {
    nativeEvent: { locationX: q.x * W, locationY: q.y * H },
  });
};

beforeEach(async () => {
  await resetTestDb();
  router.back.mockClear();
  useGame.getState().close();
});

it('scores a visit from a photo marked by hand, and keeps what was confirmed', async () => {
  const id = startX01(X01_DEFAULTS, [{ id: 'you', name: 'You' }]);
  useGame.getState().open(id);
  mockParams = { sessionId: id };
  await render(<Snap />);
  await act(async () => {
    fireEvent.press(screen.getByTestId('snap-shutter'));
  });
  // No model in tests: mark the board.
  expect(screen.getByTestId('snap-step')).toHaveTextContent(/20 and 5/);
  await fireEvent(screen.getByTestId('snap-photo-frame'), 'layout', {
    nativeEvent: { layout: { width: W, height: H } },
  });
  for (const k of CALIBRATION_IDS) await tapAt(boardPointOf(k));
  expect(screen.getByTestId('snap-hint')).toHaveTextContent(/3 to go/);
  await tapAt(centreOf({ segment: 20, multiplier: 3 }));
  await tapAt(centreOf({ segment: 20, multiplier: 1 }));
  await fireEvent.press(screen.getByTestId('snap-miss'));
  expect(screen.getByLabelText('Dart 1: T20, 60')).toBeOnTheScreen();
  await fireEvent.press(screen.getByTestId('snap-confirm'));

  const darts = loadDarts(id);
  expect(darts.map((d) => [d.source, d.hit.score])).toEqual([
    ['camera', 60],
    ['camera', 20],
    ['camera', 0],
  ]);
  expect(darts[0]!.point).not.toBeNull();
  const rows = db.select().from(captures).all();
  expect(rows).toHaveLength(1);
  expect(rows[0]!.photo).toBeNull();
  expect(JSON.parse(rows[0]!.labels).missed).toBe(1);
  expect(router.back).toHaveBeenCalled();
});
