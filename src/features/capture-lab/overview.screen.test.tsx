import { act, render, screen, within } from '@testing-library/react-native';

import i18next from '@/i18n';
import capture from '@/i18n/locales/en/capture.json';

import CaptureOverview from '../../capture-app/(tabs)/overview';
import type { Overview } from './labData';
import { useCapture } from './store';

i18next.addResourceBundle('en', 'capture', capture);

jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual<typeof import('react')>('react');
  return { useFocusEffect: (cb: () => void | (() => void)) => useEffect(cb, [cb]) };
});
jest.mock('expo-file-system', () => ({
  File: class {},
  Directory: class {},
  Paths: {},
  UploadType: {},
}));

const bucket = (name: string, n: number, thin: boolean) => ({
  bucket: name,
  training: n,
  verify: 0,
  thin,
});

const mockOverview: Overview = {
  counts: {
    captures: 40,
    sessions: 3,
    toReview: 0,
    valuesOnly: 0,
    rejected: 0,
    bySplit: { train: 30, val: 5, test: 5 },
  },
  active: null,
  progress: [],
  coverage: [
    {
      key: 'angle',
      title: 'Angle',
      buckets: [bucket('front', 30, false), bucket('steep', 2, true)],
    },
    {
      key: 'light',
      title: 'Light',
      buckets: [bucket('dim', 1, true), bucket('bright', 39, false)],
    },
  ],
  prefill: [],
};

jest.mock('./labData', () => ({
  ...jest.requireActual('./labData'),
  fetchOverview: async () => ({ ok: true, data: mockOverview }),
}));

it('lists the thin conditions to shoot next, one per line', async () => {
  useCapture.setState({ labUrl: 'mac.local:3100' });
  await act(async () => {
    await render(<CaptureOverview />);
  });
  const list = within(screen.getByTestId('overview-thin'));
  expect(list.getByText('Thin, so aim the next sessions at these:')).toBeTruthy();
  expect(list.getByText('Angle steep')).toBeTruthy();
  expect(list.getByText('Light dim')).toBeTruthy();
  expect(list.queryByText('Angle front')).toBeNull();
});
