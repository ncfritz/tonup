// The Live Activity a Lab run shows on the phone (docs/plan/capture-lab.md › Live Activity).
// Lab builds these props and pushes them through APNs; TU Capture's RunActivity draws them.
// Shared here so the two can't drift apart.

/** The Live Activity's name: `createLiveActivity(RUN_ACTIVITY, …)` and the pushes' content-state. */
export const RUN_ACTIVITY = 'RunActivity';

/** The phone's theme colours, sent to Lab with its tokens so the Live Activity matches the app. */
export interface ActivityColors {
  accent: string;
  onAccent: string;
  text: string;
  muted: string;
  surface: string;
  danger: string;
  ok: string;
}

export interface RunActivityProps {
  runId: number;
  kind: 'train' | 'verify';
  status: 'queued' | 'running' | 'done' | 'failed' | 'cancelled';
  title: string;
  /** What it's doing now, or how it ended. */
  line: string;
  /** The verified numbers once there are some (or the best so far, while it trains). */
  result: string | null;
  /** 0–1, or null when there's no way to tell. */
  progress: number | null;
  startedAt: number | null;
  /** When it should finish, while training (from the pace so far). */
  endsAt: number | null;
  /** Opens the run in TU Capture. */
  url: string;
  colors: ActivityColors | null;
}
