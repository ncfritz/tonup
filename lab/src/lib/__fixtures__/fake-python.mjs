#!/usr/bin/env node
// Stands in for ml/'s Python in the runner tests: `fake-python -u -m <module> args…` writes the
// files the real module would. FAKE_FAIL=<module> makes that module fail; FAKE_SLOW sleeps.
import fs from 'node:fs';
import path from 'node:path';

const argv = process.argv.slice(2);
const mod = argv[argv.indexOf('-m') + 1];
const arg = (name) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
};
fs.appendFileSync(
  process.env.FAKE_CALLS,
  `${mod} ${argv.slice(argv.indexOf('-m') + 2).join(' ')}\n`,
);
if (process.env.FAKE_SLOW) await new Promise((r) => setTimeout(r, Number(process.env.FAKE_SLOW)));
if (process.env.FAKE_FAIL === mod) {
  console.error('Traceback: something broke');
  process.exit(3);
}
if (mod === 'tonup_ml.train') {
  const out = arg('--out');
  const epochs = Number(arg('--epochs'));
  for (let e = 1; e <= epochs; e++) {
    console.log(`epoch ${e} step 1/1`);
    fs.appendFileSync(
      arg('--metrics'),
      JSON.stringify({
        epoch: e,
        epochs,
        loss: 1 / e,
        val_loss: 1.2 / e,
        visit_correct: 0.5 + e / 100,
        dart_correct: 0.7,
        board_found: 0.9,
        seconds: 1,
        best: true,
      }) + '\n',
    );
  }
  fs.writeFileSync(path.join(out, 'best.pt'), 'weights');
} else if (mod === 'tonup_ml.evaluate') {
  fs.writeFileSync(
    arg('--out'),
    JSON.stringify({
      samples: 2,
      visit_correct: 0.5,
      dart_correct: 0.75,
      board_found: 1,
      loss: 0.3,
    }),
  );
  fs.writeFileSync(arg('--predictions'), '{}\n');
} else if (mod === 'tonup_ml.export') {
  fs.mkdirSync(arg('--out'), { recursive: true });
  fs.writeFileSync(path.join(arg('--out'), 'Manifest.json'), '{}');
}
console.log('done');
