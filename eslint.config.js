// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettier = require('eslint-config-prettier');

module.exports = defineConfig([
  expoConfig,
  prettier,
  {
    ignores: [
      'dist/*',
      'ios/*',
      'android/*',
      'docs/design/mockups/*',
      'src/services/db/migrations/*',
    ],
  },
  {
    // Use the app's Pressable so presses behave the same everywhere (src/ui/Pressable.tsx).
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/ui/Pressable.tsx'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'react-native',
              importNames: ['Pressable'],
              message: "Use Pressable from '@/ui/Pressable'.",
            },
          ],
        },
      ],
    },
  },
  {
    // The domain layer stays plain TypeScript: game rules, stats and the bot (AGENTS.md).
    files: ['src/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            'react',
            'react-native',
            'react-native-*',
            'expo',
            'expo-*',
            '@/services/*',
            '@/features/*',
            '@/ui/*',
          ],
        },
      ],
    },
  },
]);
