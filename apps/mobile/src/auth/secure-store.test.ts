import { __reset } from '../../tests/mocks/expo-secure-store';
import { secureStore } from './secure-store';

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
    await secureStore.setThemePreference('clay');
    await secureStore.clearAll();
    expect(await secureStore.getAccessToken()).toBeNull();
    expect(await secureStore.getRefreshToken()).toBeNull();
    expect(await secureStore.getThemePreference()).toBeNull();
  });

  it('only stores valid theme preferences', async () => {
    // @ts-expect-error — runtime check
    await expect(secureStore.setThemePreference('neon')).rejects.toThrow();
  });
});
