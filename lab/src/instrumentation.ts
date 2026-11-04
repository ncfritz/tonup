// Runs once when the Lab server starts: open and migrate the database so the first request
// doesn't pay for it (and a broken migration shows at startup, not mid-upload), then pick up
// the run queue (runs left "running" by a previous server are marked failed).
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { db } = await import('./lib/db/client');
    db();
    const { recoverRuns, tick } = await import('./lib/runner');
    recoverRuns();
    tick();
  }
}
