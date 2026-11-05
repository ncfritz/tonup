import { act, fireEvent, render, screen, within } from '@testing-library/react-native';

import i18next from '@/i18n';
import capture from '@/i18n/locales/en/capture.json';

import PastRun from '../../capture-app/(tabs)/runs/[id]';
import { verdictOf, type RunDetail, type Verification, type VerifyResult } from './labData';
import { useCapture } from './store';

i18next.addResourceBundle('en', 'capture', capture);

jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual<typeof import('react')>('react');
  return {
    router: { back: jest.fn(), push: jest.fn() },
    useLocalSearchParams: () => ({ id: '14' }),
    useFocusEffect: (cb: () => void | (() => void)) => useEffect(cb, [cb]),
  };
});
jest.mock('expo-file-system', () => ({
  File: class {},
  Directory: class {},
  Paths: {},
  UploadType: {},
}));

const result = (
  modelId: number,
  model: string,
  modelStatus: string,
  visitCorrect: number,
  dartCorrect: number,
  boardFound: number,
): VerifyResult => ({
  modelId,
  model,
  modelStatus,
  samples: 412,
  valuesOnly: 20,
  visitCorrect,
  dartCorrect,
  boardFound,
});

const mockRun: RunDetail['run'] = {
  id: 14,
  kind: 'verify',
  status: 'done',
  stage: null,
  createdAt: Date.parse('2026-11-04T22:12:00Z'),
  startedAt: 1_000,
  endedAt: 1_000 + 184_000,
  error: null,
  baseModel: null,
  model: null,
  models: ['v4', 'v5'],
  visitCorrect: null,
  dartCorrect: null,
  boardFound: null,
  evaluatedOn: null,
  samples: null,
  snapshot: null,
  params: { modelIds: [4, 5] },
};

const P = (x: number, y: number): [number, number] => [x, y];
const mockVerification: Verification = {
  run: mockRun,
  results: [
    result(4, 'v4', 'active', 0.912, 0.941, 0.988),
    result(5, 'v5', 'candidate', 0.934, 0.958, 0.993),
  ],
  snapshot: { id: 9, test: 412 },
  breakdown: [
    {
      key: 'angle',
      title: 'Angle',
      unmeasured: 0,
      buckets: [
        {
          bucket: 'steep',
          by: {
            '4': { n: 60, visit: 0.8, dart: 0.9, board: 0.97 },
            '5': { n: 60, visit: 0.867, dart: 0.93, board: 0.98 },
          },
        },
      ],
    },
  ],
  worst: [
    {
      captureId: 'c1',
      modelId: 5,
      model: 'v5',
      valuesOnly: false,
      boardFound: false,
      darts: 3,
      dartsRight: 0,
      wantTotal: 60,
      gotTotal: null,
      width: 1000,
      height: 1000,
      predicted: { calibration: {}, tips: [] },
      truth: { calibration: [], tips: [{ x: 0.5, y: 0.2 }] },
    },
    {
      captureId: 'c2',
      modelId: 5,
      model: 'v5',
      valuesOnly: false,
      boardFound: true,
      darts: 3,
      dartsRight: 1,
      wantTotal: 60,
      gotTotal: 41,
      width: 1000,
      height: 1000,
      predicted: {
        calibration: {
          cal20: P(0.5, 0.2),
          cal6: P(0.8, 0.5),
          cal3: P(0.5, 0.8),
          cal11: P(0.2, 0.5),
        },
        tips: [P(0.5, 0.3)],
      },
      truth: null,
    },
    {
      captureId: 'c3',
      modelId: 4,
      model: 'v4',
      valuesOnly: false,
      boardFound: true,
      darts: 3,
      dartsRight: 2,
      wantTotal: 60,
      gotTotal: 45,
      width: 1000,
      height: 1000,
      predicted: { calibration: {}, tips: [] },
      truth: null,
    },
  ],
};

const mockActivate = jest.fn(async () => ({ ok: true }));
jest.mock('./labData', () => ({
  ...jest.requireActual('./labData'),
  fetchRun: async () => ({ ok: true, data: { run: mockRun, metrics: [], log: { step: null } } }),
  fetchVerification: async () => ({ ok: true, data: mockVerification }),
  activateModel: (...a: unknown[]) => mockActivate(...(a as [])),
}));

it('picks the better model, and makes it active only if it beats the active one', () => {
  const [v4, v5] = mockVerification.results;
  expect(verdictOf([v4!, v5!])).toMatchObject({ best: v5, next: v4, tie: false, promote: true });
  expect(verdictOf([{ ...v4!, visitCorrect: 0.95 }, v5!])).toMatchObject({ promote: false });
  expect(verdictOf([v5!])).toMatchObject({ best: v5, next: null, promote: true });
});

it('shows a verify run: the verdict, scores side by side, by condition, the worst photos', async () => {
  useCapture.setState({ labUrl: 'mac.local:3100' });
  await act(async () => {
    await render(<PastRun />);
  });
  const verdict = screen.getByTestId('verify-verdict');
  expect(verdict).toHaveTextContent(/v5 beats v4/);
  expect(verdict).toHaveTextContent(/On the same 412 verify photos \(snapshot 9\)/);
  expect(verdict).toHaveTextContent(/v4 is short on segments\./);
  expect(verdict).toHaveTextContent(/v5 meets all three bars\./);
  const scores = screen.getByTestId('verify-scores');
  expect(scores).toHaveTextContent(/Visit right.*91\.2%.*93\.4%.*▲2\.2/);
  expect(scores).toHaveTextContent(/Segment right.*94\.1%.*95\.8%.*▲1\.7/);
  expect(screen.getByTestId('verify-condition-angle')).toHaveTextContent(
    /steep.*60 photos.*80%.*86\.7%/,
  );
  // The best model's worst photos, board missed first; the other model's on a tap.
  const worst = screen.getByTestId('verify-worst');
  expect(within(worst).getByTestId('verify-worst-c1')).toHaveProp(
    'accessibilityLabel',
    'Board missed',
  );
  expect(within(worst).getByTestId('verify-worst-c2')).toHaveProp(
    'accessibilityLabel',
    '2 of 3 wrong',
  );
  expect(within(worst).queryByTestId('verify-worst-c3')).toBeNull();
  await act(async () => {
    await fireEvent.press(within(worst).getByRole('radio', { name: 'v4' }));
  });
  expect(within(worst).getByTestId('verify-worst-c3')).toBeOnTheScreen();
  // Set v5 active.
  await act(async () => {
    await fireEvent.press(screen.getByTestId('verify-activate'));
  });
  expect(mockActivate).toHaveBeenCalledWith('mac.local:3100', 5);
  expect(screen.getByTestId('verify-note')).toHaveTextContent(/v5/);
});
