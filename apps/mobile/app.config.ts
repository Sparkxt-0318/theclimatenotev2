/**
 * Expo configuration.
 *
 * Several values here exist specifically to satisfy App Review; each is
 * commented with why, because removing one is how a submission gets rejected
 * for a reason nobody remembers.
 */

import type { ExpoConfig } from 'expo/config';

const SITE = process.env.EXPO_PUBLIC_SITE_URL ?? 'https://theclimatenote.com';

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
    buildNumber: '1',
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
      CFBundleURLTypes: [
        {
          CFBundleURLSchemes: [
            process.env.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME ?? 'com.googleusercontent.apps.PLACEHOLDER',
          ],
        },
      ],

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
      // We do not track users across apps or websites, and collect nothing for
      // advertising. This declaration must match the App Privacy answers in
      // App Store Connect exactly.
      NSPrivacyTracking: false,
      NSPrivacyCollectedDataTypes: [],
    },

    associatedDomains: [`applinks:${SITE.replace(/^https?:\/\//, '')}`],
  },

  plugins: [
    'expo-router',
    'expo-secure-store',
    'expo-apple-authentication',
    [
      '@react-native-google-signin/google-signin',
      {
        iosUrlScheme:
          process.env.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME ??
          'com.googleusercontent.apps.PLACEHOLDER',
      },
    ],
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
