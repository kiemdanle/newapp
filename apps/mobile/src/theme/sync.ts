import { secureStore, type ThemePreference } from '../auth/secure-store';
import { meEndpoints } from '../api/endpoints';

export async function syncThemeToServer(themeId: ThemePreference): Promise<void> {
  const token = await secureStore.getAccessToken();
  if (!token) return;
  try {
    // The server database uses the canonical expyrico brand theme
    await meEndpoints.update({ themePreference: 'expyrico' });
  } catch {
    // best-effort — the preference is already stored locally
  }
}
