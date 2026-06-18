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
jest.mock('expo-apple-authentication', () => ({
  isAvailableAsync: jest.fn(async () => true),
  signInAsync: jest.fn(),
  AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
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
