import { __reset } from '../../tests/mocks/expo-secure-store';
import { useThemeStore, initThemeStore } from './store';
import { secureStore } from '../auth/secure-store';

describe('theme store', () => {
  beforeEach(() => {
    __reset();
    useThemeStore.setState({ themeId: 'expyrico', hydrated: false });
  });

  it('defaults to aurora when no preference is stored', async () => {
    await initThemeStore();
    expect(useThemeStore.getState().themeId).toBe('expyrico');
    expect(useThemeStore.getState().hydrated).toBe(true);
  });

  it('hydrates from secure store on init', async () => {
    await secureStore.setThemePreference('clay');
    await initThemeStore();
    expect(useThemeStore.getState().themeId).toBe('clay');
  });

  it('setTheme updates state and persists to secure store', async () => {
    await initThemeStore();
    await useThemeStore.getState().setTheme('material');
    expect(useThemeStore.getState().themeId).toBe('material');
    expect(await secureStore.getThemePreference()).toBe('material');
  });

  it('rejects an invalid theme id at runtime', async () => {
    await initThemeStore();
    // @ts-expect-error — runtime check
    await expect(useThemeStore.getState().setTheme('neon')).rejects.toThrow();
  });
});
