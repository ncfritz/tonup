import type { ConfigContext, ExpoConfig } from 'expo/config';

// Bundle ID and Pro product ID: ADR 0009, docs/plan/v1-implementation.md §1.
const BUNDLE_ID = 'app.tonup.ios';
// Signing team for local builds (Neil's individual account, as Tippytoe); written into the
// Xcode project by prebuild so `expo prebuild --clean` doesn't need the team picked again.
const APPLE_TEAM_ID = '39BL2H9S6P';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Ton Up',
  slug: 'tonup',
  version: '0.1.0',
  orientation: 'portrait',
  scheme: 'tonup',
  userInterfaceStyle: 'automatic',
  // Icon and launch art: docs/design/brand.md (sources in assets/brand).
  icon: './assets/icon.png',
  ios: {
    bundleIdentifier: BUNDLE_ID,
    appleTeamId: APPLE_TEAM_ID,
    buildNumber: '1',
    // iPhone only for v1 (ADR 0010).
    supportsTablet: false,
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
    },
    // Apple's privacy manifest (docs/release/privacy.md): no tracking and no data collected.
    // The required-reason APIs are the ones React Native, Expo and SQLite use on the phone.
    privacyManifests: {
      NSPrivacyTracking: false,
      NSPrivacyTrackingDomains: [],
      NSPrivacyCollectedDataTypes: [],
      NSPrivacyAccessedAPITypes: [
        {
          // Settings and app state in UserDefaults (React Native, Expo modules).
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryUserDefaults',
          NSPrivacyAccessedAPITypeReasons: ['CA92.1'],
        },
        {
          // File timestamps for the database, caches and exported files.
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryFileTimestamp',
          NSPrivacyAccessedAPITypeReasons: ['C617.1'],
        },
        {
          // Time since boot for measuring elapsed time (React Native).
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategorySystemBootTime',
          NSPrivacyAccessedAPITypeReasons: ['35F9.1'],
        },
        {
          // Free disk space before writing files (Expo file system).
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryDiskSpace',
          NSPrivacyAccessedAPITypeReasons: ['E174.1'],
        },
      ],
    },
  },
  plugins: [
    'expo-router',
    'expo-font',
    'expo-sqlite',
    // StoreKit 2 for Ton Up Pro (ADR 0009); the plugin adds the OpenIAP pod's source.
    'expo-iap',
    // Xcode runs buy Pro against storekit/TonUp.storekit.
    './plugins/with-storekit-config',
    ['expo-build-properties', { ios: { deploymentTarget: '18.0' } }],
    [
      'expo-splash-screen',
      {
        // Full-screen Training-lab board art, same in light and dark (docs/design/brand.md).
        image: './assets/splash.png',
        resizeMode: 'cover',
        enableFullScreenImage_legacy: true,
        backgroundColor: '#0E1217',
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
});
