import type { ExpoConfig } from 'expo/config';

// newArchEnabled propagates to gradle.properties during prebuild on SDK 52+.
const config: ExpoConfig & { newArchEnabled?: boolean } = {
  name: 'Expyrico',
  slug: 'expyrico',
  scheme: 'Expyrico',
  version: '0.0.1',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#FAFAF8',
  },
  runtimeVersion: '0.0.1',
  updates: {
    url: 'https://u.expo.dev/be162389-d598-4a6c-8641-e7f6715d4741',
    enabled: true,
    checkAutomatically: 'ON_LOAD',
    fallbackToCacheTimeout: 0,
  },
  ios: {
    bundleIdentifier: 'com.expyrico.app',
    supportsTablet: false,
    usesAppleSignIn: true,
  },
  android: {
    package: 'com.expyrico.app',
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#FAFAF8',
    },
  },
  plugins: [
    [
      'expo-build-properties',
      {
        android: {
          // react-native-passkey pulls kotlinx-coroutines 1.10.2 (Kotlin 2.1.0
          // metadata); the SDK 52 prebuild template defaults the app compiler
          // to Kotlin 1.9.25, which can't read that metadata (1.9 reads only
          // up to 2.0.0). 2.0.21 is the version expo-modules-core ships and
          // tests against; it reads 2.1.0 metadata (one minor ahead, allowed)
          // and stays binary-compatible with the Expo gradle plugins. 2.1.0
          // itself breaks those plugins (KotlinTopLevelExtension class→iface).
          kotlinVersion: '2.0.21',
        },
      },
    ],
    'expo-router',
    'expo-secure-store',
    'expo-apple-authentication',
    [
      '@react-native-google-signin/google-signin',
      { iosUrlScheme: 'com.googleusercontent.apps.PLACEHOLDER' },
    ],
  ],
  owner: 'lekiemdan',
  extra: {
    eas: { projectId: 'd49cae3d-5945-4f7e-a425-59b791fb54b1' },
    apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:4000',
    googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '',
    googleIosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '',
    passkeyRpId: process.env.EXPO_PUBLIC_PASSKEY_RP_ID ?? 'localhost',
  },
  experiments: { typedRoutes: true },
};

export default config;
