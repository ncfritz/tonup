import { act, render, screen } from '@testing-library/react-native';

import i18next from '@/i18n';
import capture from '@/i18n/locales/en/capture.json';

import type { LabHealth } from './lab';
import { forgetLab, recheckLab, useLabHealth } from './labHealth';
import { LabPill } from './LabPill';
import { useCapture } from './store';

i18next.addResourceBundle('en', 'capture', capture);
jest.mock('expo-file-system', () => ({ File: class {}, Directory: class {}, Paths: {} }));

const OK: LabHealth = { ok: true, version: '1', activeModel: null, sessions: 0 };

beforeEach(() => forgetLab());

it('asks once per address at a time and shares the answer', async () => {
  const check = jest.fn(async () => OK);
  await Promise.all([recheckLab('mac.local', check), recheckLab('mac.local', check)]);
  expect(check).toHaveBeenCalledTimes(1);
  expect(useLabHealth.getState()).toMatchObject({ url: 'mac.local', health: OK, checking: false });
});

it('drops an answer for an address since changed', async () => {
  let answer: (h: LabHealth) => void = () => {};
  const slow = () => new Promise<LabHealth>((r) => (answer = r));
  const first = recheckLab('old.local', slow);
  await recheckLab('new.local', async () => ({ ok: false, error: 'down' }));
  answer(OK);
  await first;
  expect(useLabHealth.getState()).toMatchObject({ url: 'new.local', health: { ok: false } });
});

it('shows each state on the pill', async () => {
  useCapture.setState({ labUrl: '' });
  const r = await render(<LabPill />);
  expect(screen.getByText('No Lab')).toBeOnTheScreen();
  await act(async () => {
    useCapture.setState({ labUrl: 'mac.local' });
  });
  expect(screen.getByText('Lab…')).toBeOnTheScreen();
  await act(async () => {
    await recheckLab('mac.local', async () => OK);
  });
  expect(screen.getByLabelText('Lab connected')).toBeOnTheScreen();
  await act(async () => {
    await recheckLab('mac.local', async () => ({ ok: false, error: 'x' }));
  });
  expect(screen.getByText('Lab offline')).toBeOnTheScreen();
  r.unmount();
});
