import type { ThemeId } from '@expyrico/theme';
import { secureStore } from '../auth/secure-store';
import { meEndpoints } from '../api/endpoints';

const SERVER_THEME_IDS: readonly ThemePreference[] = ['expyrico', 'expyricoDark', 'system'];

function isServerThemeId(themeId: string): themeId is ThemePreference {
  return (SERVER_THEME_IDS as readonly string[]).includes(themeId as ThemePreference);
}

export async function syncThemeToServer(themeId: ThemeId): Promise<void> {
  if (!isServerThemeId(themeId)) return;
  const token = await secureStore.getAccessToken();
  if (!token) return;
  try {
    await meEndpoints.update({ themePreference: themeId });
  } catch {
    // best-effort — the preference is already stored locally
  }
}
