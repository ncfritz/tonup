import { act, render, screen } from '@testing-library/react-native';

import i18next from '@/i18n';
import capture from '@/i18n/locales/en/capture.json';

import PastRun from '../../capture-app/(tabs)/runs/[id]';
import type { RunDetail } from './labData';
import { useCapture } from './store';

i18next.addResourceBundle('en', 'capture', capture);

jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual<typeof import('react')>('react');
  return {
    router: { back: jest.fn(), push: jest.fn() },
    useLocalSearchParams: () => ({ id: '12' }),
    useFocusEffect: (cb: () => void | (() => void)) => useEffect(cb, [cb]),
  };
});
jest.mock('expo-file-system', () => ({
  File: class {},
  Directory: class {},
  Paths: {},
  UploadType: {},
}));

const metric = (epoch: number, visit: number) => ({
  epoch,
  visit_correct: visit,
  dart_correct: 0.95,
  board_found: 0.99,
  loss: 10 - epoch,
  val_loss: 11 - epoch,
  seconds: 150,
  images_per_second: 41,
  best: epoch === 2,
});

const mockDetail: RunDetail = {
  run: {
    id: 12,
    kind: 'train',
    status: 'done',
    stage: null,
    createdAt: Date.parse('2026-11-03T21:14:00Z'),
    startedAt: 1_000,
    endedAt: 1_000 + 52 * 60_000,
    error: null,
    baseModel: 'v3',
    model: 'v4',
    visitCorrect: 0.93,
    dartCorrect: 0.956,
    boardFound: 0.99,
    evaluatedOn: 'verify set, snapshot 7',
    samples: 128,
    snapshot: { train: 1032, val: 124, test: 128 },
    params: {
      from: 'model',
      baseModelId: 3,
      epochs: 3,
      lr: 0.0003,
      batch: 16,
      captureWeight: 3,
      captures: true,
      deepdarts: true,
      deepdartsSample: 2000,
    },
  },
  metrics: [metric(1, 0.9), metric(2, 0.932), metric(3, 0.93)],
  log: { tail: 'done', step: null },
  comparison: {
    made: { id: 4, name: 'v4', status: 'candidate' },
    base: {
      id: 3,
      name: 'v3',
      visitCorrect: 0.91,
      dartCorrect: 0.94,
      boardFound: 0.985,
      sameSnapshot: true,
    },
  },
};

jest.mock('./labData', () => ({
  ...jest.requireActual('./labData'),
  fetchRun: async () => ({ ok: true, data: mockDetail }),
}));

it('shows a past run: what it made, its numbers against the model it started from, settings', async () => {
  useCapture.setState({ labUrl: 'mac.local:3100' });
  await act(async () => {
    await render(<PastRun />);
  });
  expect(screen.getByTestId('run-made')).toHaveTextContent(/Made v4/);
  expect(screen.getByTestId('run-made')).toHaveTextContent(/best checkpoint, epoch 2/);
  expect(screen.getByTestId('run-activate')).toHaveTextContent('Set v4 active');
  expect(screen.getByTestId('run-verify')).toHaveTextContent('Compare with v3');
  const verified = screen.getByTestId('run-verified');
  expect(verified).toHaveTextContent(/93%.*meets 90%.*▲ 2 vs v3/);
  expect(verified).toHaveTextContent(/vs v3 on the same photos/);
  expect(screen.getByText('1,032 train · 124 val · 128 verify')).toBeOnTheScreen();
  expect(screen.getByText('52m')).toBeOnTheScreen();
});
