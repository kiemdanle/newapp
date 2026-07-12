import { __reset } from '../../tests/mocks/expo-secure-store';
import { useThemeStore, initThemeStore } from './store';
import { secureStore } from '../auth/secure-store';

describe('theme store', () => {
  beforeEach(() => {
    __reset();
    useThemeStore.setState({ themeId: 'system', hydrated: false });
  });

  it('defaults to system when no preference is stored', async () => {
    await initThemeStore();
    expect(useThemeStore.getState().themeId).toBe('system');
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

  it('can persist system preference', async () => {
    await initThemeStore();
    await useThemeStore.getState().setTheme('system');
    expect(useThemeStore.getState().themeId).toBe('system');
    expect(await secureStore.getThemePreference()).toBe('system');
  });

  it('rejects an invalid theme id at runtime', async () => {
    await initThemeStore();
    // @ts-expect-error — runtime check
    await expect(useThemeStore.getState().setTheme('neon')).rejects.toThrow();
  });
});
