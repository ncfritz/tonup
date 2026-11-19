// Signs every target with the app's team (ADR 0012). TU Capture's Live Activity lives in a
// widget extension that expo-widgets adds without a team, and Xcode won't sign it automatically
// without one. Listed before expo-widgets in app.config.ts: mods of the same kind run last-listed
// first, so this sees the extension expo-widgets added.
const { withXcodeProject } = require('expo/config-plugins');

module.exports = function withTeamEverywhere(config, { teamId }) {
  return withXcodeProject(config, (cfg) => {
    const configs = cfg.modResults.pbxXCBuildConfigurationSection();
    for (const entry of Object.values(configs)) {
      if (typeof entry !== 'object' || !entry.buildSettings) continue;
      if (!entry.buildSettings.PRODUCT_BUNDLE_IDENTIFIER) continue;
      entry.buildSettings.DEVELOPMENT_TEAM = teamId;
      entry.buildSettings.CODE_SIGN_STYLE = 'Automatic';
    }
    return cfg;
  });
};
