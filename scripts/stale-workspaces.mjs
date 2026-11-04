// Removes Xcode workspaces in ios/ whose project is gone. Switching app variants regenerates
// ios/ (TonUp.xcodeproj ↔ TUCapture.xcodeproj), and an Xcode window still open on the other
// variant saves its workspace back; `expo run:ios` may then pick that one and fail with
// "does not contain a scheme". Run before every `expo run:ios`.
import fs from 'node:fs';
import path from 'node:path';

const ios = path.resolve(import.meta.dirname, '..', 'ios');
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
