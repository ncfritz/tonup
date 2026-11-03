// Local StoreKit testing, as in Tippytoe: copies storekit/TonUp.storekit into ios/ and points
// the scheme's Run action at it, so running from Xcode (⌘R) buys Ton Up Pro against the local
// file instead of the App Store (Xcode's Debug › StoreKit › Manage Transactions can then refund
// it). It doesn't affect TestFlight or App Store builds, and `expo run:ios` (pnpm ios) doesn't
// use it. ios/ is generated, hence a plugin.
const { withDangerousMod, withXcodeProject } = require('expo/config-plugins');
const fs = require('node:fs');
const path = require('node:path');

module.exports = function withStoreKitConfig(config, { file = 'storekit/TonUp.storekit' } = {}) {
  // Xcode only offers (and resolves) a StoreKit file that's part of the project, so add a
  // reference in the main group. No target membership: it must not ship in the app.
  config = withXcodeProject(config, (cfg) => {
    const project = cfg.modResults;
    const name = path.basename(file);
    if (!project.hasFile(name)) {
      const mainGroup = project.getFirstProject().firstProject.mainGroup;
      const ref = project.addFile(name, mainGroup, {
        lastKnownFileType: 'text',
        sourceTree: '"<group>"',
      });
      const entry = ref && project.pbxFileReferenceSection()[ref.fileRef];
      if (entry) {
        delete entry.explicitFileType;
        delete entry.includeInIndex;
      }
    }
    return cfg;
  });
  return withDangerousMod(config, [
    'ios',
    (cfg) => {
      const { platformProjectRoot, projectRoot, projectName } = cfg.modRequest;
      const source = path.join(projectRoot, file);
      const name = path.basename(file);
      fs.copyFileSync(source, path.join(platformProjectRoot, name));

      const scheme = path.join(
        platformProjectRoot,
        `${projectName}.xcodeproj`,
        'xcshareddata',
        'xcschemes',
        `${projectName}.xcscheme`,
      );
      if (!fs.existsSync(scheme)) throw new Error(`with-storekit-config: no scheme at ${scheme}`);
      let xml = fs.readFileSync(scheme, 'utf8');
      // Paths in the scheme are relative to <project>.xcodeproj/xcshareddata, so ../../ is ios/.
      const ref = `      <StoreKitConfigurationFileReference\n         identifier = "../../${name}">\n      </StoreKitConfigurationFileReference>\n`;
      xml = xml.replace(
        /\s*<StoreKitConfigurationFileReference[\s\S]*?<\/StoreKitConfigurationFileReference>\n?/,
        '\n',
      );
      const next = xml.replace(/(\n\s*<\/LaunchAction>)/, `\n${ref.trimEnd()}$1`);
      if (next === xml) throw new Error('with-storekit-config: LaunchAction not found in the scheme');
      fs.writeFileSync(scheme, next);
      return cfg;
    },
  ]);
};
