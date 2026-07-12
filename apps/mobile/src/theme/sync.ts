import type { ThemeId } from '@expyrico/theme';
import { secureStore } from '../auth/secure-store';
import { meEndpoints } from '../api/endpoints';

type ServerThemeId = Exclude<ThemeId, 'expyricoDark'>;

const SERVER_THEME_IDS: readonly ServerThemeId[] = ['expyrico', 'bento', 'clay', 'material'];

function isServerThemeId(themeId: ThemeId): themeId is ServerThemeId {
  return (SERVER_THEME_IDS as readonly string[]).includes(themeId);
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
