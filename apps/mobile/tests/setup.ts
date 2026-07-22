import * as mockNavigation from './mocks/react-navigation';

// Default React Navigation mocks for screens rendered outside a navigator in tests
jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useNavigation: mockNavigation.useNavigation,
    useRoute: mockNavigation.useRoute,
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
beforeEach(() => {
  defaultFetch.mockClear();
  (globalThis as any).fetch = defaultFetch;
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
  statusCodes: { SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED' },
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

jest.mock('react-native-config', () => ({
  API_BASE_URL: 'http://localhost:4000',
  GOOGLE_WEB_CLIENT_ID: 'mock-web-client-id',
  GOOGLE_IOS_CLIENT_ID: 'mock-ios-client-id',
}));

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
