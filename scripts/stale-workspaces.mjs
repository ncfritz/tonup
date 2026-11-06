// Run before every `expo run:ios`. Two checks, because both app variants (ADR 0012) share ios/:
//
// 1. ios/ must be generated for the variant being built. `expo run:ios` builds whatever native
//    project is there and never regenerates it, so after `capture:sync` a plain `ios:release`
//    would build TU Capture (and the other way round). If ios/ holds the other variant's
//    project, regenerate it with `expo prebuild --clean` for this one.
// 2. Remove Xcode workspaces whose project is gone. An Xcode window still open on the other
//    variant saves its workspace back; `expo run:ios` may then pick that one and fail with
//    "does not contain a scheme".
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ios = path.resolve(import.meta.dirname, '..', 'ios');
// APP_VARIANT has to be set for this script too, not just the expo command after it:
// `APP_VARIANT=capture node scripts/stale-workspaces.mjs && APP_VARIANT=capture expo run:ios`.
const variant = process.env.APP_VARIANT === 'capture' ? 'capture' : 'tonup';
console.log(
  `Building ${variant === 'capture' ? 'TU Capture' : 'Ton Up'} (APP_VARIANT=${process.env.APP_VARIANT ?? 'unset'})`,
);
const projects = { tonup: 'TonUp.xcodeproj', capture: 'TUCapture.xcodeproj' };

if (fs.existsSync(ios) && !fs.existsSync(path.join(ios, projects[variant]))) {
  console.log(
    `ios/ was generated for the other app variant; regenerating it for ${variant === 'capture' ? 'TU Capture' : 'Ton Up'}…`,
  );
  execSync('npx expo prebuild --platform ios --clean', {
    stdio: 'inherit',
    cwd: path.resolve(import.meta.dirname, '..'),
    env: process.env,
  });
}

if (fs.existsSync(ios)) {
  for (const name of fs.readdirSync(ios)) {
    if (!name.endsWith('.xcworkspace')) continue;
    const project = `${name.slice(0, -'.xcworkspace'.length)}.xcodeproj`;
    if (!fs.existsSync(path.join(ios, project))) {
      fs.rmSync(path.join(ios, name), { recursive: true, force: true });
      console.log(`Removed ios/${name}: its project is gone (left from the other app variant)`);
    }
  }
}
