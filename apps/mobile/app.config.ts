import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'Expyrico',
  slug: 'pantry',
  scheme: 'pantry',
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
    apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:4000',
    googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '',
    googleIosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '',
    passkeyRpId: process.env.EXPO_PUBLIC_PASSKEY_RP_ID ?? 'localhost',
  },
  experiments: { typedRoutes: true },
};

export default config;
