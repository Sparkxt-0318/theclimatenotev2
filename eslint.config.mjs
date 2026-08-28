import js from '@eslint/js';
import tseslint from 'typescript-eslint';

/**
 * Imports that would take the user out to a browser to sign in.
 *
 * The App Store rejected a previous version of this app with:
 *   "the user is taken to the default web browser to sign in or register for
 *    an account, which provides a poor user experience."
 *
 * Every module below produces exactly that behaviour. Authentication in this
 * codebase must go through the native Apple / Google SDKs and hand the
 * resulting ID token to `supabase.auth.signInWithIdToken`, which never leaves
 * the app. See apps/mobile/src/features/auth/README.md.
 *
 * If you are here because the build failed: do not add an eslint-disable.
 * Use the native path instead.
 */
const BROWSER_AUTH_MODULES = [
  {
    name: 'expo-auth-session',
    message:
      'Browser-redirect auth caused an App Store rejection. Use the native Apple/Google sign-in in src/features/auth instead.',
  },
  {
    name: 'expo-web-browser',
    message:
      'Opening a browser for auth caused an App Store rejection. Use the native sign-in in src/features/auth instead.',
  },
  {
    name: 'react-native-app-auth',
    message:
      'This library performs browser-based OAuth, which Apple rejected. Use the native sign-in in src/features/auth instead.',
  },
  {
    name: 'react-native-inappbrowser-reborn',
    message: 'In-app browsers are not an auth mechanism here. Use the native sign-in flow.',
  },
];

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/build/**',
      '**/.expo/**',
      '**/ios/**',
      '**/android/**',
      'store/screenshots/generated/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      'no-restricted-imports': ['error', { paths: BROWSER_AUTH_MODULES }],
    },
  },
  {
    // The browser-auth ban is absolute inside the mobile app, and additionally
    // forbids the Supabase redirect-based sign-in helpers by name.
    files: ['apps/mobile/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "MemberExpression[property.name='signInWithOAuth'], CallExpression[callee.property.name='signInWithOAuth']",
          message:
            'signInWithOAuth opens a browser and was the cause of the App Store rejection. Use signInWithIdToken with a native Apple/Google credential.',
        },
        {
          selector:
            "MemberExpression[property.name='linkIdentity'], CallExpression[callee.property.name='linkIdentity']",
          message:
            'linkIdentity uses a browser redirect. Link providers by signing in natively with the second provider instead.',
        },
      ],
    },
  },
  {
    files: ['**/*.test.ts', '**/*.test.tsx', '**/*.config.{js,mjs,ts}'],
    rules: { '@typescript-eslint/no-explicit-any': 'off' },
  },
);
