/**
 * Expo configuration.
 *
 * Several values here exist specifically to satisfy App Review; each is
 * commented with why, because removing one is how a submission gets rejected
 * for a reason nobody remembers.
 */

import type { ExpoConfig } from 'expo/config';

/**
 * Values that must be present at BUILD time.
 *
 * Expo inlines EXPO_PUBLIC_* variables into the bundle when it is built, so a
 * missing one is not a runtime problem to handle gracefully — it produces a
 * binary that can never work. Previously these had `?? ''` and placeholder
 * fallbacks, which meant a misconfigured build succeeded, shipped, and crashed
 * on launch or silently failed to sign in.
 *
 * Failing here costs a few minutes on the EAS builder. Not failing here costs a
 * review cycle.
 */
const REQUIRED_AT_BUILD_TIME = [
  'EXPO_PUBLIC_SUPABASE_URL',
  'EXPO_PUBLIC_SUPABASE_ANON_KEY',
  'EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID',
  'EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID',
  'EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME',
  'EXPO_PUBLIC_SITE_URL',
] as const;

/** Builds that ship to a device or the store. Local tooling is exempt. */
const IS_RELEASE_BUILD = ['preview', 'production'].includes(process.env.EXPO_PUBLIC_ENV ?? '');

function requireEnv(name: string, fallback?: string): string {
  const value = process.env[name];
  if (value) return value;
  if (!IS_RELEASE_BUILD && fallback !== undefined) return fallback;

  throw new Error(
    `\n\n  ${name} is not set.\n\n` +
      `  Every value in this list must be present when building:\n` +
      REQUIRED_AT_BUILD_TIME.map((key) => `    - ${key}`).join('\n') +
      `\n\n  For an EAS build, set them as EAS environment variables:\n` +
      `    eas env:create --scope project --name ${name} --value "..."\n\n` +
      `  Locally, copy .env.example to .env and fill it in.\n` +
      `  See store/SUBMISSION.md.\n`,
  );
}

// Development falls back to a placeholder so `expo start` works before the real
// project exists. A release build has no fallbacks and will refuse to proceed.
const GOOGLE_URL_SCHEME = requireEnv(
  'EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME',
  'com.googleusercontent.apps.dev-placeholder',
);

if (IS_RELEASE_BUILD) {
  // Touch the rest so a release build fails now rather than at launch.
  for (const name of REQUIRED_AT_BUILD_TIME) requireEnv(name);
}

const config: ExpoConfig = {
  name: 'The Climate Note',
  slug: 'the-climate-note',
  scheme: 'climatenote',
  version: '1.0.0',
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
  icon: './assets/icon.png',


  ios: {
    bundleIdentifier: 'com.theclimatenote.app',
    // Ignored: eas.json uses appVersionSource "remote", so EAS owns this.
    supportsTablet: false,

    // Required by guideline 4.8 whenever a third-party sign-in is offered, and
    // this flag is what makes the entitlement appear in the built binary.
    usesAppleSignIn: true,

    infoPlist: {
      // Without this, every submission stops to ask about export compliance.
      // We use only standard HTTPS, which is exempt.
      ITSAppUsesNonExemptEncryption: false,

      // Google's native SDK opens its account sheet through this scheme. It is
      // NOT a browser redirect — the sheet renders inside the app.
      CFBundleURLTypes: [{ CFBundleURLSchemes: [GOOGLE_URL_SCHEME] }],

      UIViewControllerBasedStatusBarAppearance: true,
    },

    // Apple requires a reason for each of these APIs. Both are used indirectly
    // by React Native and expo-image rather than by our own code, but they must
    // still be declared or the build is rejected at upload.
    privacyManifests: {
      NSPrivacyAccessedAPITypes: [
        {
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryUserDefaults',
          // CA92.1: accessing UserDefaults for this app's own data only.
          NSPrivacyAccessedAPITypeReasons: ['CA92.1'],
        },
        {
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryFileTimestamp',
          // C617.1: timestamps of files inside our own container (image cache).
          NSPrivacyAccessedAPITypeReasons: ['C617.1'],
        },
        {
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryDiskSpace',
          // E174.1: checking free space before writing to the image cache.
          NSPrivacyAccessedAPITypeReasons: ['E174.1'],
        },
        {
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategorySystemBootTime',
          // 35F9.1: measuring elapsed time.
          NSPrivacyAccessedAPITypeReasons: ['35F9.1'],
        },
      ],
      // MUST match the App Privacy answers in App Store Connect exactly; a
      // mismatch is a rejection. We collect an account and what the reader
      // writes, all linked to their identity, none of it used for tracking.
      NSPrivacyTracking: false,
      NSPrivacyCollectedDataTypes: [
        {
          NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypeEmailAddress',
          NSPrivacyCollectedDataTypeLinked: true,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: ['NSPrivacyCollectedDataTypePurposeAppFunctionality'],
        },
        {
          NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypeName',
          NSPrivacyCollectedDataTypeLinked: true,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: ['NSPrivacyCollectedDataTypePurposeAppFunctionality'],
        },
        {
          NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypeUserID',
          NSPrivacyCollectedDataTypeLinked: true,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: ['NSPrivacyCollectedDataTypePurposeAppFunctionality'],
        },
        {
          // The climate notes a reader writes.
          NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypeOtherUserContent',
          NSPrivacyCollectedDataTypeLinked: true,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: ['NSPrivacyCollectedDataTypePurposeAppFunctionality'],
        },
      ],
    },

    // No associatedDomains entry yet. Universal Links need an
    // apple-app-site-association file served from the site, which does not
    // exist, and an unbacked entitlement is a known first-build signing
    // failure. Add both together when a real domain is in place.
  },

  plugins: [
    'expo-router',
    'expo-secure-store',
    'expo-apple-authentication',
    ['@react-native-google-signin/google-signin', { iosUrlScheme: GOOGLE_URL_SCHEME }],
    [
      'expo-splash-screen',
      {
        image: './assets/splash.png',
        resizeMode: 'contain',
        backgroundColor: '#FFFFFF',
        dark: { image: './assets/splash-dark.png', backgroundColor: '#0D0D08' },
      },
    ],
  ],

  experiments: { typedRoutes: true },

  extra: {
    eas: { projectId: process.env.EAS_PROJECT_ID ?? '' },
  },
};

export default config;
