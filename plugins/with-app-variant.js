// Which app a native build is (ADR 0012). Xcode's "Bundle React Native code" phase reads the app
// config again when it bundles JavaScript, and a build started from Xcode doesn't inherit the
// shell's APP_VARIANT. Writing it into ios/.xcode.env (sourced by that phase) makes a Release
// build from Xcode bundle the same variant that prebuild generated.
const { withDangerousMod } = require('expo/config-plugins');
const fs = require('node:fs');
const path = require('node:path');

module.exports = function withAppVariant(config, { variant }) {
  return withDangerousMod(config, [
    'ios',
    (cfg) => {
      const file = path.join(cfg.modRequest.platformProjectRoot, '.xcode.env');
      const lines = fs.existsSync(file)
        ? fs
            .readFileSync(file, 'utf8')
            .split('\n')
            .filter((l) => !l.startsWith('export APP_VARIANT='))
        : [];
      while (lines.length && lines[lines.length - 1] === '') lines.pop();
      lines.push(`export APP_VARIANT=${variant}`, '');
      fs.writeFileSync(file, lines.join('\n'));
      return cfg;
    },
  ]);
};
