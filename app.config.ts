import type { ConfigContext, ExpoConfig } from 'expo/config';

// Two iOS apps build from this project (ADR 0012), picked by APP_VARIANT when the config is read:
// Ton Up itself (the default) and Ton Up Capture, the internal app for collecting training
// photos (docs/plan/capture-lab.md). Each has its own name, bundle ID and routes directory, so
// nothing from the Capture routes is bundled into Ton Up.
export type AppVariant = 'tonup' | 'capture';
export const appVariant = (env = process.env.APP_VARIANT): AppVariant =>
  env === 'capture' ? 'capture' : 'tonup';

// Bundle ID and Pro product ID: ADR 0009, docs/plan/v1-implementation.md §1.
const BUNDLE_ID = 'app.tonup.ios';
// Signing team for local builds (Neil's individual account, as Tippytoe); written into the
// Xcode project by prebuild so `expo prebuild --clean` doesn't need the team picked again.
const APPLE_TEAM_ID = '39BL2H9S6P';

// Apple's privacy manifest (docs/release/privacy.md): no tracking and no data collected.
// The required-reason APIs are the ones React Native, Expo and SQLite use on the phone.
const privacyManifests = {
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
};

type PluginEntry = [string, Record<string, unknown>];

const splash: PluginEntry = [
  'expo-splash-screen',
  {
    // Full-screen Training-lab board art, same in light and dark (docs/design/brand.md).
    image: './assets/splash.png',
    resizeMode: 'cover',
    enableFullScreenImage_legacy: true,
    backgroundColor: '#0E1217',
  },
];

const camera = (cameraPermission: string): PluginEntry => [
  'expo-camera',
  { cameraPermission, microphonePermission: false, recordAudioAndroid: false },
];

function tonUp(config: ConfigContext['config']): ExpoConfig {
  return {
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
        // Snap-to-score photos kept for training show in Files › On My iPhone › Ton Up (ADR 0011).
        UIFileSharingEnabled: true,
        LSSupportsOpeningDocumentsInPlace: true,
      },
      privacyManifests,
    },
    plugins: [
      ['expo-router', { root: 'src/app' }],
      'expo-font',
      'expo-sqlite',
      // Snap to score (ADR 0011): the camera only, no microphone.
      camera(
        'Ton Up uses the camera to read your darts from a photo of the board. Photos stay on your iPhone.',
      ),
      // StoreKit 2 for Ton Up Pro (ADR 0009); the plugin adds the OpenIAP pod's source.
      'expo-iap',
      // Xcode runs buy Pro against storekit/TonUp.storekit.
      './plugins/with-storekit-config',
      ['./plugins/with-app-variant', { variant: 'tonup' }],
      ['expo-build-properties', { ios: { deploymentTarget: '18.0' } }],
      splash,
    ],
    experiments: {
      typedRoutes: true,
      reactCompiler: true,
    },
  };
}

/**
 * Ton Up Capture (ADR 0012): installed from Xcode, never submitted to the App Store. It talks to
 * Ton Up Lab over plain HTTP on the local network only, and has no Pro, StoreKit or Files
 * sharing.
 */
function capture(config: ConfigContext['config']): ExpoConfig {
  const base = tonUp(config);
  return {
    ...base,
    name: 'TU Capture',
    scheme: 'tonupcapture',
    ios: {
      ...base.ios,
      bundleIdentifier: `${BUNDLE_ID}.capture`,
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
        NSLocalNetworkUsageDescription:
          'TU Capture sends photos and labels to Ton Up Lab on your Mac.',
        // Plain HTTP to .local names and local addresses only; everything else stays HTTPS.
        NSAppTransportSecurity: { NSAllowsLocalNetworking: true },
      },
    },
    plugins: [
      ['expo-router', { root: 'src/capture-app' }],
      'expo-font',
      camera('TU Capture photographs the board so its darts can be labelled for training.'),
      ['./plugins/with-app-variant', { variant: 'capture' }],
      ['expo-build-properties', { ios: { deploymentTarget: '18.0' } }],
      splash,
    ],
  };
}

export default ({ config }: ConfigContext): ExpoConfig =>
  appVariant() === 'capture' ? capture(config) : tonUp(config);
