import * as mockNavigation from './mocks/react-navigation';

// Default React Navigation mocks for screens rendered outside a navigator in tests
jest.mock('@react-navigation/native', () => {
  // Required inside the factory: jest.mock() factories can't reference
  // outer-scope imports (hoisting restriction).
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { useEffect } = require('react');
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useNavigation: mockNavigation.useNavigation,
    useRoute: mockNavigation.useRoute,
    // The real useFocusEffect needs a NavigationContext a bare `render()`
    // (no NavigationContainer) never provides. Screens tested in isolation
    // are always "focused" for the test's purposes, so just run the effect.
    useFocusEffect: (effect: () => void | (() => void)) => useEffect(effect, []),
  };
});


// Safe area context test shim
jest.mock('react-native-safe-area-context', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const actual = jest.requireActual('react-native-safe-area-context');
  return {
    ...actual,
    useSafeAreaInsets: jest.fn(() => ({ top: 0, right: 0, bottom: 0, left: 0 })),
  };
});
// VisionCamera imports the native module at load time; stub it before anything
// requires OcrCamera or ScanCamera.
jest.mock('react-native-vision-camera', () => ({
  Camera: () => null,
  useCameraDevice: jest.fn(() => null),
  useCameraPermission: jest.fn(() => ({ hasPermission: false })),
  useCodeScanner: jest.fn((opts: any) => opts),
  requestCameraPermission: jest.fn(async () => 'denied'),
  getCameraPermissionStatus: jest.fn(async () => 'denied'),
}));

// Default global fetch mock; individual tests can override.
const defaultFetch = jest.fn(
  async () =>
    new Response(JSON.stringify({}), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }),
);
beforeEach(async () => {
  defaultFetch.mockClear();
  (globalThis as unknown as { fetch: unknown }).fetch = defaultFetch;
  const AsyncStorage = require('@react-native-async-storage/async-storage');
  await AsyncStorage.clear();
});
// React Native Reanimated test shim
jest.mock('react-native-reanimated', () => {
  return {
    default: { call: () => undefined },
    useSharedValue: (v: unknown) => ({ value: v }),
    useAnimatedStyle: (fn: () => unknown) => fn(),
    withTiming: (v: unknown) => v,
    Easing: { inOut: () => undefined, ease: undefined },
    runOnJS: <T>(fn: T) => fn,
    View: 'Animated.View',
  };
});

// React Native Gesture Handler Swipeable test shim
jest.mock('react-native-gesture-handler/Swipeable', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const React = require('react');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { View } = require('react-native');
  return React.forwardRef((props: { renderRightActions?: () => React.ReactNode; children?: React.ReactNode }, _ref: unknown) => {
    return React.createElement(
      View,
      { testID: 'swipeable-container' },
      props.children,
      props.renderRightActions ? props.renderRightActions() : null,
    );
  });
});

// Apple authentication: iOS-only native module — stub for tests
jest.mock('@invertase/react-native-apple-authentication', () => ({
  appleAuth: {
    isSupported: true,
    performRequest: jest.fn(),
    Operation: { LOGIN: 1 },
    Scope: { FULL_NAME: 0, EMAIL: 1 },
  },
}));

// Google Sign-in
jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn(async () => true),
    signIn: jest.fn(),
    signOut: jest.fn(),
  },
  statusCodes: {
    SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED',
    IN_PROGRESS: 'IN_PROGRESS',
    PLAY_SERVICES_NOT_AVAILABLE: 'PLAY_SERVICES_NOT_AVAILABLE',
    DEVELOPER_ERROR: 'DEVELOPER_ERROR',
  },
}));

// Passkey
jest.mock('react-native-passkey', () => ({
  Passkey: { get: jest.fn(), create: jest.fn() },
}));

// FCM push notifications
jest.mock('@react-native-firebase/messaging', () => ({
  default: jest.fn(() => ({
    requestPermission: jest.fn(async () => 1),
    getToken: jest.fn(async () => 'mock-fcm-token'),
    isDeviceRegistered: true,
  })),
  AuthorizationStatus: { AUTHORIZED: 1, PROVISIONAL: 2, DENIED: 0, NOT_DETERMINED: -1 },
}));

jest.mock('react-native-vector-icons/Ionicons', () => {
  return () => null;
});

// Image Crop Picker
jest.mock('react-native-image-crop-picker', () => ({
  openCamera: jest.fn(async () => null),
  openPicker: jest.fn(async () => []),
  clean: jest.fn(async () => undefined),
  cleanSingle: jest.fn(async () => undefined),
}));

// This explicit jest.mock takes precedence over jest.config.js's
// moduleNameMapper entry for the same specifier (both redirect
// 'react-native-config', but an explicit per-file mock factory wins) — keep
// this object as the actual single source of default mock Config values;
// tests/mocks/react-native-config.ts exists for direct, non-setupFiles
// imports/documentation only.
jest.mock('react-native-config', () => ({
  API_BASE_URL: 'http://localhost:4000',
  GOOGLE_WEB_CLIENT_ID: 'mock-web-client-id',
  GOOGLE_IOS_CLIENT_ID: 'mock-ios-client-id',
  RECAPTCHA_SITE_KEY_ANDROID: 'mock-recaptcha-site-key-android',
  RECAPTCHA_SITE_KEY_IOS: 'mock-recaptcha-site-key-ios',
}));

// Official in-memory Jest mock shipped by the package itself.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// WatermelonDB — native SQLite adapter, mock for Jest
jest.mock('../src/db/index', () => {
  const EMPTY_OBS = { subscribe: () => ({ unsubscribe: jest.fn() }) };
  const EMPTY_QUERY = { observe: () => EMPTY_OBS, fetch: () => Promise.resolve([]) };
  const recordsCol = {
    query: () => EMPTY_QUERY,
    find: () => Promise.reject(new Error('not found')),
    findAndObserve: () => EMPTY_OBS,
    create: () => Promise.resolve({ id: 'mock-record-id' }),
  };
  class RecordModel {}
  class ProductCacheModel {}
  return {
    database: {
      get: () => recordsCol,
      write: (fn: () => Promise<void>) => fn(),
    },
    RecordModel,
    ProductCacheModel,
  };
});
jest.mock('../src/db/triggers', () => ({
  triggerSyncSoon: jest.fn(),
}));

// Secure storage mock is provided by moduleNameMapper -> tests/mocks/react-native-keychain.ts
