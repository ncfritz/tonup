// Entry point. Intl polyfills before anything formats text, then Expo Router, then Unistyles
// configuration (per the Unistyles Expo Router guide).
import './src/i18n/polyfills';
import 'expo-router/entry';
import './src/theme/unistyles';
