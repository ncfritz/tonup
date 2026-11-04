// The run queue (capture-lab.md › Runs): one run at a time, each a series of child processes
// of ml/'s Python environment. A training run snapshots the data, trains, evaluates the best
// checkpoint on the verification set, exports it to Core ML and registers it as a candidate.
// Output goes to <data>/runs/<id>/log.txt; per-epoch numbers to metrics.jsonl.
import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { asc, eq } from 'drizzle-orm';

import { db } from './db/client';
import { models, runs } from './db/schema';
import { deepdartsPath } from './deepdarts';
import { dataDir } from './env';
import { nextModelName, runDir, type TrainParams } from './runs';
import { createSnapshot } from './snapshots';

/** The repository (Lab runs from lab/), ml/ in it, and its Python. */
export const repoDir = () =>
  process.env.TONUP_REPO ?? path.resolve(/* turbopackIgnore: true */ process.cwd(), '..');
export const pythonPath = () =>
  process.env.TONUP_LAB_PYTHON ??
  path.join(/* turbopackIgnore: true */ repoDir(), 'ml', '.venv', 'bin', 'python');

class RunCancelled extends Error {}

interface Runner {
  busy: boolean;
  current: { runId: number; child: ChildProcess | null } | null;
}

// One runner per server process; on globalThis so dev hot reloads don't start a second.
const g = globalThis as unknown as { labRunner?: Runner };
const runner = (): Runner => (g.labRunner ??= { busy: false, current: null });

/** At startup: anything left "running" died with the last server. */
export function recoverRuns() {
  db()
    .update(runs)
    .set({
      status: 'failed',
      error: 'Lab stopped while this was running',
      endedAt: new Date(),
      pid: null,
    })
    .where(eq(runs.status, 'running'))
    .run();
}

/** Starts the next queued run if nothing is running. */
export function tick() {
  const r = runner();
  if (r.busy) return;
  const next = db()
    .select()
    .from(runs)
    .where(eq(runs.status, 'queued'))
    .orderBy(asc(runs.id))
    .get();
  if (!next) return;
  r.busy = true;
  r.current = { runId: next.id, child: null };
  void execute(next.id)
    .catch(() => {})
    .finally(() => {
      r.busy = false;
      r.current = null;
      tick();
    });
}

export function cancelRun(id: number): boolean {
  const d = db();
  const row = d.select().from(runs).where(eq(runs.id, id)).get();
  if (!row || (row.status !== 'queued' && row.status !== 'running')) return false;
  d.update(runs)
    .set({ status: 'cancelled', endedAt: new Date(), pid: null })
    .where(eq(runs.id, id))
    .run();
  const cur = runner().current;
  if (cur?.runId === id && cur.child?.pid) {
    try {
      // The child leads its own process group (caffeinate and Python together).
      process.kill(-cur.child.pid, 'SIGTERM');
    } catch {
      cur.child.kill('SIGTERM');
    }
  }
  return true;
}

function cancelled(id: number) {
  return db().select({ s: runs.status }).from(runs).where(eq(runs.id, id)).get()?.s === 'cancelled';
}

function setRun(id: number, change: Partial<typeof runs.$inferInsert>) {
  db().update(runs).set(change).where(eq(runs.id, id)).run();
}

/** Runs `python -m <module> args` in ml/, appending its output to the run's log. */
function python(runId: number, log: fs.WriteStream, module: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const py = pythonPath();
    if (!fs.existsSync(py)) {
      reject(
        new Error(`No Python at ${py}: set up ml/.venv (ml/README.md) or set TONUP_LAB_PYTHON`),
      );
      return;
    }
    const argv = ['-u', '-m', module, ...args];
    // On the Mac, keep it awake for the length of the step.
    const [cmd, cmdArgs] =
      process.platform === 'darwin' ? ['caffeinate', ['-i', py, ...argv]] : [py, argv];
    log.write(`\n$ ${module} ${args.join(' ')}\n`);
    const child = spawn(cmd, cmdArgs, {
      cwd: path.join(/* turbopackIgnore: true */ repoDir(), 'ml'),
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, PYTHONUNBUFFERED: '1' },
    });
    const cur = runner().current;
    if (cur) cur.child = child;
    setRun(runId, { pid: child.pid ?? null });
    child.stdout.on('data', (b: Buffer) => log.write(b));
    child.stderr.on('data', (b: Buffer) => log.write(b));
    child.on('error', reject);
    child.on('close', (code, signal) => {
      if (cur) cur.child = null;
      if (cancelled(runId)) reject(new RunCancelled());
      else if (code === 0) resolve();
      else reject(new Error(`${module} exited with ${code ?? signal}`));
    });
  });
}

async function execute(id: number) {
  const d = db();
  const row = d.select().from(runs).where(eq(runs.id, id)).get();
  if (!row) return;
  const dir = runDir(id);
  fs.mkdirSync(dir, { recursive: true });
  const log = fs.createWriteStream(path.join(dir, 'log.txt'), { flags: 'a' });
  setRun(id, { status: 'running', startedAt: new Date(), stage: 'snapshot', error: null });
  try {
    const p = JSON.parse(row.params) as TrainParams;
    log.write(`Run #${id}: ${p.from === 'model' ? 'fine-tune' : 'from scratch'}\n`);

    const snap = createSnapshot();
    setRun(id, { snapshotId: snap.id });
    log.write(
      `Snapshot ${snap.id}: ${snap.train} train, ${snap.val} val, ${snap.test} verify (${snap.valuesOnly} values only)\n`,
    );
    const dd = p.deepdarts ? deepdartsPath() : null;
    if (p.deepdarts && !dd)
      throw new Error('DeepDarts is selected but its folder isn’t set (Sessions page)');
    if (!dd && snap.train === 0)
      throw new Error('No training data: no captures in the train set and no DeepDarts');

    let resume: string | null = null;
    if (p.from === 'model' && p.baseModelId) {
      const base = d.select().from(models).where(eq(models.id, p.baseModelId)).get();
      if (!base) throw new Error(`Model ${p.baseModelId} not found`);
      resume = path.join(dataDir(), base.checkpoint);
    }

    setRun(id, { stage: 'train' });
    await python(id, log, 'tonup_ml.train', [
      ...(dd ? ['--deepdarts', dd] : []),
      ...(p.captures ? ['--captures', snap.path] : []),
      '--out',
      dir,
      '--metrics',
      path.join(dir, 'metrics.jsonl'),
      '--epochs',
      String(p.epochs),
      '--lr',
      String(p.lr),
      '--batch',
      String(p.batch),
      '--capture-weight',
      String(p.captureWeight),
      '--deepdarts-sample',
      String(p.deepdartsSample),
      '--workers',
      String(p.workers),
      ...(resume ? ['--resume', resume] : []),
    ]);

    // Verify on our own held-out photos; before there are any, on DeepDarts' test split.
    setRun(id, { stage: 'evaluate' });
    const onOurs = snap.test - snap.valuesOnly > 0;
    const evaluatedOn = onOurs ? `verify set, snapshot ${snap.id}` : 'DeepDarts test split';
    if (onOurs || dd) {
      await python(id, log, 'tonup_ml.evaluate', [
        '--checkpoint',
        path.join(dir, 'best.pt'),
        ...(onOurs ? ['--captures', snap.path] : ['--deepdarts', dd!]),
        '--split',
        'test',
        '--out',
        path.join(dir, 'eval.json'),
        '--predictions',
        path.join(dir, 'predictions.jsonl'),
      ]);
    }
    const evalFile = path.join(dir, 'eval.json');
    const ev = fs.existsSync(evalFile)
      ? (JSON.parse(fs.readFileSync(evalFile, 'utf8')) as {
          samples: number;
          visit_correct: number;
          dart_correct: number;
          board_found: number;
        })
      : null;
    const results = ev
      ? {
          evaluatedOn,
          samples: ev.samples,
          visitCorrect: ev.visit_correct,
          dartCorrect: ev.dart_correct,
          boardFound: ev.board_found,
        }
      : {
          evaluatedOn: null,
          samples: null,
          visitCorrect: null,
          dartCorrect: null,
          boardFound: null,
        };
    setRun(id, results);

    // Export for the phone; a failed export still registers the model (Lab can retry later).
    setRun(id, { stage: 'export' });
    const name = nextModelName();
    const modelDir = path.join(dataDir(), 'models', name);
    fs.mkdirSync(modelDir, { recursive: true });
    let mlpackage: string | null = path.join('models', name, 'DartKeypoints.mlpackage');
    try {
      await python(id, log, 'tonup_ml.export', [
        '--checkpoint',
        path.join(dir, 'best.pt'),
        '--version',
        name,
        '--out',
        path.join(dataDir(), mlpackage),
      ]);
    } catch (e) {
      if (e instanceof RunCancelled) throw e;
      log.write(
        `Export failed: ${e instanceof Error ? e.message : String(e)}. The model is registered without a Core ML package.\n`,
      );
      mlpackage = null;
    }
    const [model] = d
      .insert(models)
      .values({
        name,
        runId: id,
        status: 'candidate',
        createdAt: new Date(),
        checkpoint: path.join('runs', String(id), 'best.pt'),
        mlpackage,
        ...results,
      })
      .returning({ id: models.id })
      .all();
    setRun(id, { status: 'done', stage: null, modelId: model!.id, endedAt: new Date(), pid: null });
    log.write(`Registered ${name} as a candidate.\n`);
  } catch (e) {
    if (e instanceof RunCancelled || cancelled(id)) {
      log.write('Cancelled.\n');
      setRun(id, { stage: null, pid: null });
    } else {
      const msg = e instanceof Error ? e.message : String(e);
      log.write(`Failed: ${msg}\n`);
      setRun(id, { status: 'failed', stage: null, error: msg, endedAt: new Date(), pid: null });
    }
  } finally {
    log.end();
  }
}

/** Tests only: wait until the runner is idle. */
export async function idleForTests() {
  while (runner().busy) await new Promise((r) => setTimeout(r, 20));
}
