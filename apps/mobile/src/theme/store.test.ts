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
    await secureStore.setThemePreference('expyricoDark');
    await initThemeStore();
    expect(useThemeStore.getState().themeId).toBe('expyricoDark');
  });

  it('setTheme persists the Expyrico light appearance', async () => {
    await initThemeStore();
    await useThemeStore.getState().setTheme('expyrico');
    expect(useThemeStore.getState().themeId).toBe('expyrico');
    expect(await secureStore.getThemePreference()).toBe('expyrico');
  });

  it('can persist system preference', async () => {
    await initThemeStore();
    await useThemeStore.getState().setTheme('system');
    expect(useThemeStore.getState().themeId).toBe('system');
    expect(await secureStore.getThemePreference()).toBe('system');
  });

  it('rejects an invalid theme id at runtime', async () => {
    await initThemeStore();
    const unsupportedPreference = 'clay' as unknown as import('../auth/secure-store').ThemePreference;
    await expect(useThemeStore.getState().setTheme(unsupportedPreference)).rejects.toThrow(
      'invalid theme preference: clay',
    );
    expect(await secureStore.getThemePreference()).toBeNull();
  });
});
