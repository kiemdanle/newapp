import type { ThemeId } from '@expyrico/theme';
import { secureStore } from '../auth/secure-store';
import { meEndpoints } from '../api/endpoints';

export async function syncThemeToServer(themeId: ThemeId): Promise<void> {
  const token = await secureStore.getAccessToken();
  if (!token) return;
  try {
    await meEndpoints.update({ themePreference: themeId });
  } catch {
    // best-effort — the preference is already stored locally
  }
}
