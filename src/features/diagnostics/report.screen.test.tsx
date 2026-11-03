import { fireEvent, render, screen } from '@testing-library/react-native';

import { log } from '@/services/diagnostics';

import { resetTestDb } from '../../../test/sqlite';
import Report from '../../app/(tabs)/settings/report';
import { startX01 } from '../game/session';

import { buildReport } from './report';

jest.mock('@/services/db/client', () => jest.requireActual('../../../test/sqlite').testClient());
jest.mock('@/services/export', () => ({ shareTextFile: jest.fn(async () => {}) }));
const share = jest.requireMock<{ shareTextFile: jest.Mock }>('@/services/export').shareTextFile;
jest.mock('expo-router', () => ({
  router: { back: jest.fn(), push: jest.fn() },
}));

beforeEach(async () => {
  await resetTestDb();
});

describe('Report a problem', () => {
  it('builds a report with the log and counts, and no player names', () => {
    startX01({ startScore: 501, in: 'straight', out: 'double', legs: 1, sets: 1 } as never, [
      { id: 'p1', name: 'Alexandra' },
    ]);
    log('error', 'Something broke', { where: 'test' });
    const text = buildReport({ note: 'It froze', now: 0 });
    expect(text).toContain('Ton Up problem report');
    expect(text).toContain('It froze');
    expect(text).toContain('Stored: 1 sessions, 0 darts');
    expect(text).toMatch(/ERROR Something broke \{"where":"test"\}/);
    expect(text).not.toContain('Alexandra');
  });

  it('previews the report and sends it through the share sheet', async () => {
    log('warn', 'A warning');
    await render(<Report />);
    await fireEvent.changeText(screen.getByTestId('report-note'), 'Scores went missing');
    await fireEvent.press(screen.getByTestId('report-preview'));
    expect(screen.getByTestId('report-text')).toHaveTextContent(/Scores went missing/);
    expect(screen.getByText(/1 entries/)).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('report-send'));
    expect(share).toHaveBeenCalledWith(
      expect.stringMatching(/^tonup-report-.*\.txt$/),
      expect.stringContaining('Scores went missing'),
      { mimeType: 'text/plain', uti: 'public.plain-text' },
    );
  });
});
