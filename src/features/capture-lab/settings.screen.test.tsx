import { act, fireEvent, render, screen } from '@testing-library/react-native';

import i18next from '@/i18n';
import capture from '@/i18n/locales/en/capture.json';

import CaptureSettings from '../../capture-app/(tabs)/settings';
import type { InstalledModel } from './modelPull';
import { useCapture } from './store';

i18next.addResourceBundle('en', 'capture', capture);

jest.mock('expo-router', () => ({ router: { back: jest.fn(), push: jest.fn() } }));
jest.mock('expo-file-system', () => ({ File: class {}, Directory: class {}, Paths: {} }));
jest.mock('./outboxFiles', () => ({ fileOutbox: { sentPhotoCount: () => 0, clearSent: () => 0 } }));

// The phone's model folder in memory.
const mockModel: { installed: InstalledModel | null; staged: string[] } = {
  installed: null,
  staged: [],
};
jest.mock('./modelFiles', () => ({
  modelFiles: {
    installed: () => mockModel.installed,
    beginStaging: () => (mockModel.staged = []),
    download: async (url: string) => {
      mockModel.staged.push(url);
      return url.endsWith('Manifest.json') ? 10 : 990;
    },
    commit: (m: InstalledModel) => (mockModel.installed = m),
    discardStaging: () => (mockModel.staged = []),
  },
}));

// Lab's active model: v4, two files.
jest.mock('./lab', () => ({
  ...jest.requireActual('./lab'),
  fetchActiveModel: async () => ({
    ok: true,
    model: {
      id: 4,
      name: 'v4',
      visitCorrect: 0.912,
      files: [
        { path: 'Manifest.json', size: 10 },
        { path: 'Data/com.apple.CoreML/model.mlmodel', size: 990 },
      ],
    },
  }),
}));

// dart-vision: whatever was installed last is what loads.
jest.mock('@/services/vision', () => ({
  visionCapabilities: async () => ({
    model: !!mockModel.installed,
    version: mockModel.installed?.name ?? null,
  }),
  reloadModel: async () => ({ model: true, version: 'v4' }),
}));

beforeEach(() => {
  mockModel.installed = null;
  useCapture.setState({ labUrl: 'my-mac.local:3100', prefill: true, visits: 0, session: null });
});

it('pulls Lab’s active model onto the phone', async () => {
  await act(async () => {
    await render(<CaptureSettings />);
  });
  expect(screen.getByText('No model on this phone yet')).toBeOnTheScreen();
  expect(screen.getByTestId('settings-lab-model')).toHaveTextContent(
    "Lab's active model is v4 · visit total right 91%.",
  );
  await act(async () => {
    await fireEvent.press(screen.getByTestId('settings-get-model'));
  });
  expect(mockModel.staged).toEqual([
    'http://my-mac.local:3100/api/models/4/files/Manifest.json',
    'http://my-mac.local:3100/api/models/4/files/Data/com.apple.CoreML/model.mlmodel',
  ]);
  expect(mockModel.installed).toMatchObject({ id: 4, name: 'v4' });
  expect(screen.getByTestId('settings-pull-note')).toHaveTextContent(
    'Installed v4. New visits are pre-filled by it.',
  );
  expect(screen.getByText('On this phone: v4')).toBeOnTheScreen();
  expect(screen.getByTestId('settings-lab-model')).toHaveTextContent('Up to date with Lab (v4).');
  expect(screen.queryByTestId('settings-get-model')).toBeNull();
});
