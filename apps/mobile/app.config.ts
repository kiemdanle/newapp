import type { ExpoConfig } from 'expo/config';

// newArchEnabled is a supported Expo field not yet reflected in the SDK 51 types.
const config: ExpoConfig & { newArchEnabled?: boolean } = {
  name: 'Expyrico',
  slug: 'pantry',
  scheme: 'Expyrico',
  version: '0.0.1',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#0b0a17',
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
      backgroundColor: '#0b0a17',
    },
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    'expo-apple-authentication',
    [
      '@react-native-google-signin/google-signin',
      { iosUrlScheme: 'com.googleusercontent.apps.PLACEHOLDER' },
    ],
  ],
  extra: {
    eas: { projectId: 'be162389-d598-4a6c-8641-e7f6715d4741' },
    apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:4000',
    googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '',
    googleIosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '',
    passkeyRpId: process.env.EXPO_PUBLIC_PASSKEY_RP_ID ?? 'localhost',
  },
  experiments: { typedRoutes: true },
};

export default config;
