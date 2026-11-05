import { act, fireEvent, render, screen } from '@testing-library/react-native';

import i18next from '@/i18n';
import capture from '@/i18n/locales/en/capture.json';

import SavedPhoto from '../../capture-app/photo/[id]';
import { forgetLab, recheckLab } from './labHealth';
import type { SentItem } from './outbox';
import { useCapture } from './store';

i18next.addResourceBundle('en', 'capture', capture);

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), push: jest.fn() },
  useLocalSearchParams: () => ({ id: 'v1' }),
}));
jest.mock('expo-file-system', () => ({ File: class {}, Directory: class {}, Paths: {} }));
jest.mock('react-native-gesture-handler', () => ({
  ...jest.requireActual('react-native-gesture-handler'),
  GestureDetector: ({ children }: { children: unknown }) => children,
  usePinchGesture: () => ({}),
}));

// One sent visit whose photo has been cleared from the phone.
const mockSent: SentItem = {
  id: 'v1',
  label: {
    id: 'v1',
    image: 'v1.jpg',
    width: 1000,
    height: 1000,
    createdAt: '2026-11-04T05:00:00.000Z',
    sessionId: 's1',
    sessionStartedAt: '2026-11-04T04:50:00.000Z',
    tags: [],
    calibration: [
      { x: 0.5, y: 0.2 },
      { x: 0.8, y: 0.5 },
      { x: 0.5, y: 0.8 },
      { x: 0.2, y: 0.5 },
      { x: 0.5, y: 0.5 },
    ],
    darts: [{ x: 0.5, y: 0.3, value: 'T20' }],
    valuesOnly: false,
    prefillModel: null,
  },
};
jest.mock('./outboxFiles', () => ({
  fileOutbox: {
    pending: () => [],
    sent: () => [mockSent],
    sentPhotoUri: () => null,
    photoUri: () => '',
  },
}));

beforeEach(() => {
  forgetLab();
  useCapture.setState({ labUrl: 'my-mac.local:3100' });
});

const frame = () => screen.getByTestId('snap-photo-frame');
const layOut = async () =>
  act(async () => {
    await fireEvent(frame(), 'layout', { nativeEvent: { layout: { width: 300, height: 300 } } });
  });

it('draws a cleared photo’s board and tips on a blank while Lab is down', async () => {
  await act(async () => {
    await recheckLab('my-mac.local:3100', async () => ({ ok: false, error: 'down' }));
  });
  await act(async () => {
    await render(<SavedPhoto />);
  });
  expect(screen.getByTestId('saved-source')).toHaveTextContent(/drawn from the label/);
  expect(screen.getByTestId('saved-total')).toHaveTextContent('60');
  await layOut();
  expect(screen.getByTestId('snap-photo-blank')).toBeOnTheScreen();
  expect(screen.queryByTestId('snap-photo-image')).toBeNull();
});

it('shows Lab’s copy of a cleared photo when Lab is up', async () => {
  await act(async () => {
    await recheckLab('my-mac.local:3100', async () => ({
      ok: true,
      version: '1',
      activeModel: null,
      sessions: 1,
    }));
  });
  await act(async () => {
    await render(<SavedPhoto />);
  });
  expect(screen.getByTestId('saved-source')).toHaveTextContent(/the photo is Lab's copy/);
  await layOut();
  expect(screen.getByTestId('snap-photo-image')).toHaveProp('source', {
    uri: 'http://my-mac.local:3100/api/captures/v1/photo',
  });
});
