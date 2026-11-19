// Native modules one app variant leaves out (ADR 0012). Both apps share package.json, so
// autolinking would put every module in both; Ton Up passes these to `use_expo_modules!` in its
// Podfile instead, so it doesn't ship TU Capture's Live Activity (expo-widgets, @expo/ui).
const { withDangerousMod } = require('expo/config-plugins');
const fs = require('node:fs');
const path = require('node:path');

module.exports = function withAutolinkingExclude(config, { exclude }) {
  return withDangerousMod(config, [
    'ios',
    (cfg) => {
      const file = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      const podfile = fs.readFileSync(file, 'utf8');
      const call = `use_expo_modules!({ exclude: ${JSON.stringify(exclude)} })`;
      const next = podfile.replace(/use_expo_modules!(\(.*\))?/, call);
      if (!next.includes(call))
        throw new Error('with-autolinking-exclude: no use_expo_modules! in the Podfile');
      fs.writeFileSync(file, next);
      return cfg;
    },
  ]);
};
