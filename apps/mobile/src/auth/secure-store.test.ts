import { __reset } from '../../tests/mocks/react-native-keychain';
import { getItem, secureStore, setItem } from './secure-store';

describe('secureStore', () => {
  beforeEach(() => __reset());

  it('round-trips a string value', async () => {
    await secureStore.setAccessToken('abc.def.ghi');
    expect(await secureStore.getAccessToken()).toBe('abc.def.ghi');
  });

  it('returns null when a key is unset', async () => {
    expect(await secureStore.getRefreshToken()).toBeNull();
  });

  it('clearAll wipes every known key', async () => {
    await secureStore.setAccessToken('a');
    await secureStore.setRefreshToken('b');
    await secureStore.setThemePreference('expyrico');
    await secureStore.clearAll();
    expect(await secureStore.getAccessToken()).toBeNull();
    expect(await secureStore.getRefreshToken()).toBeNull();
    expect(await secureStore.getThemePreference()).toBeNull();
  });

  it('clearAll resets the last registered FCM token for the next authenticated boot', async () => {
    await secureStore.setAccessToken('a');
    await setItem('pantry.pushRegisteredV1', 'fcm-token-previous');
    await secureStore.clearAll();
    expect(await getItem('pantry.pushRegisteredV1')).toBeNull();
  });

  it('only stores valid theme preferences', async () => {
    // @ts-expect-error — runtime check
    await expect(secureStore.setThemePreference('neon')).rejects.toThrow();
  });
});
