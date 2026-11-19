import type { ActivityColors } from '@/domain/lab/runActivity';

import { sendToken, tokenWatcher, type TokenBody } from './liveActivity';

const COLORS: ActivityColors = {
  accent: '#E8B931',
  onAccent: '#07090E',
  text: '#F4F6FA',
  muted: '#9AA4B6',
  surface: '#151A24',
  danger: '#B3261E',
  ok: '#118A45',
};
const flush = () => new Promise((r) => setTimeout(r, 0));

describe('handing Lab the Live Activity tokens', () => {
  it('sends the start token once Lab is known, once per Lab', async () => {
    const sent: [string, TokenBody][] = [];
    const w = tokenWatcher(async (url, body) => {
      sent.push([url, body]);
      return true;
    });
    w.setStartToken('ab12');
    await flush();
    expect(sent).toEqual([]);
    w.setLab('http://lab.local:3100', COLORS);
    await flush();
    w.setLab('http://lab.local:3100', COLORS);
    await flush();
    expect(sent).toEqual([
      ['http://lab.local:3100', { kind: 'start', token: 'ab12', colors: COLORS }],
    ]);
    w.setLab('http://other.local:3100', COLORS);
    await flush();
    expect(sent).toHaveLength(2);
  });

  it('tries again when Lab didn’t take it', async () => {
    let ok = false;
    const calls: TokenBody[] = [];
    const w = tokenWatcher(async (_url, body) => {
      calls.push(body);
      return ok;
    });
    w.setLab('http://lab.local:3100', COLORS);
    w.setStartToken('ab12');
    await flush();
    ok = true;
    await w.scan();
    await w.scan();
    expect(calls).toHaveLength(2);
  });

  it('posts to Lab’s live-activity endpoint', async () => {
    const fetchImpl = jest.fn(async () => ({ ok: true }) as Response);
    const body: TokenBody = { kind: 'start', token: 'ab12', colors: COLORS };
    expect(await sendToken('http://lab.local:3100', body, fetchImpl)).toBe(true);
    expect(fetchImpl).toHaveBeenCalledWith('http://lab.local:3100/api/live-activity', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const failing = jest.fn(async () => {
      throw new Error('offline');
    });
    expect(await sendToken('http://lab.local:3100', body, failing)).toBe(false);
  });
});
