// Sending Lab what it needs to show runs on this phone's Lock Screen (docs/plan/capture-lab.md
// › Live Activity): the push-to-start token, so Lab can start a run's Live Activity, and each
// Live Activity's own token, so Lab can update and end it. Lab does all the pushing; the app
// only hands tokens over, whenever it's open (and when iOS wakes it for a new activity).
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';
import { addPushToStartTokenListener } from 'expo-widgets';

import type { ActivityColors } from '@/domain/lab/runActivity';

import { RunActivity } from './RunActivity';
import { useCapture } from './store';

export type TokenBody =
  | { kind: 'start'; token: string; colors: ActivityColors }
  | { kind: 'activity'; token: string; activityId: string; colors: ActivityColors };

/** Posts one token to Lab; true when Lab took it. */
export async function sendToken(
  labUrl: string,
  body: TokenBody,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  try {
    const res = await fetchImpl(`${labUrl}/api/live-activity`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Keeps Lab told: what was sent where, so a token goes once per Lab (and again if Lab changes
 * or didn't get it). One per app process.
 */
export function tokenWatcher(send: (labUrl: string, body: TokenBody) => Promise<boolean>) {
  let labUrl = '';
  let colors: ActivityColors | null = null;
  let start: string | null = null;
  const activities = new Map<string, string>();
  const delivered = new Set<string>();
  const listening = new Set<string>();

  const deliver = async (body: TokenBody) => {
    const key = `${labUrl}|${body.token}`;
    if (!labUrl || delivered.has(key)) return;
    if (await send(labUrl, body)) delivered.add(key);
  };

  const flush = async () => {
    if (!labUrl || !colors) return;
    if (start) await deliver({ kind: 'start', token: start, colors });
    for (const [activityId, token] of activities) {
      await deliver({ kind: 'activity', token, activityId, colors });
    }
  };

  /** Finds the Live Activities showing now (Lab may have started one since) and their tokens. */
  const scan = async () => {
    for (const a of RunActivity.getInstances()) {
      const id = a.getId();
      if (!listening.has(id)) {
        listening.add(id);
        a.addPushTokenListener((e) => {
          activities.set(e.activityId, e.pushToken);
          void flush();
        });
      }
      const token = await a.getPushToken().catch(() => null);
      if (token) activities.set(id, token);
    }
    await flush();
  };

  return {
    setLab(url: string, c: ActivityColors) {
      labUrl = url;
      colors = c;
      void scan();
    },
    setStartToken(token: string) {
      start = token;
      void flush();
    },
    scan,
  };
}

const watcher = tokenWatcher((url, body) => sendToken(url, body));

/** Mounted once in Capture's root: hands Lab the tokens while the app is open. */
export function LiveActivityWatch() {
  const labUrl = useCapture((s) => s.labUrl);
  const { theme } = useUnistyles();
  const { accent, onAccent, text, muted, surface, danger, ok } = theme.colors;

  useEffect(() => {
    const sub = addPushToStartTokenListener((e) =>
      watcher.setStartToken(e.activityPushToStartToken),
    );
    const app = AppState.addEventListener('change', (s) => {
      if (s === 'active') void watcher.scan();
    });
    return () => {
      sub.remove();
      app.remove();
    };
  }, []);

  useEffect(() => {
    if (labUrl) watcher.setLab(labUrl, { accent, onAccent, text, muted, surface, danger, ok });
  }, [labUrl, accent, onAccent, text, muted, surface, danger, ok]);

  return null;
}
