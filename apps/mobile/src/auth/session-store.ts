import { create } from 'zustand';
import type { AuthResult, User } from '@expyrico/shared';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { secureStore } from './secure-store';
import { authEndpoints } from '../api/endpoints';
import { setOnTokensRefreshed, refreshTokensOnce } from '../api/client';
import { purgePrivateImageCache } from '../api/product-private-image';
import { clearDraftLocalStateForUser } from '../features/products/product-draft-storage';
import { database } from '../db/index';
import { clearQueryClient } from '../api/query-client';
import { usePantryScope } from '../store/pantryScope';
import { triggerSyncSoon } from '../db/triggers';

const KEY_CACHED_USER = '@pantry_cached_user';

export async function clearAllLocalUserData(userId?: string | null): Promise<void> {
  purgePrivateImageCache();
  clearQueryClient();
  if (userId) {
    await clearDraftLocalStateForUser(userId).catch(() => {});
  }
  usePantryScope.getState().setScope('personal', null);
  // Reset local SQLite database to prevent any records leaking to other accounts
  try {
    await database.write(async () => {
      await database.unsafeResetDatabase();
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('Failed to reset local database', e);
  }
  // Clear last sync timestamp so next user starts fresh
  await AsyncStorage.removeItem('pantry.lastSyncAt').catch(() => {});
}
interface SessionState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  hydrated: boolean;
  // Session returned by register, held (not persisted) until the user completes
  // the email OTP step. Keeping it out of accessToken means AuthGate doesn't
  // treat a registered-but-unverified user as signed in and bounce them to home.
  pendingAuth: AuthResult | null;
  signIn: (result: AuthResult) => Promise<void>;
  signOut: () => Promise<void>;
  setUser: (user: User) => void;
  setPendingAuth: (result: AuthResult | null) => void;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  hydrated: false,
  pendingAuth: null,
  signIn: async ({ user, tokens }) => {
    const currentUserId = get().user?.id;
    if (currentUserId && currentUserId !== user.id) {
      await clearAllLocalUserData(currentUserId);
    }
    purgePrivateImageCache();
    await Promise.allSettled([
      secureStore.setAccessToken(tokens.accessToken),
      secureStore.setRefreshToken(tokens.refreshToken),
      AsyncStorage.setItem(KEY_CACHED_USER, JSON.stringify(user)),
    ]);
    set({ user, accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, pendingAuth: null });
    triggerSyncSoon();
  },
  signOut: async () => {
    const outgoingUserId = get().user?.id;
    await clearAllLocalUserData(outgoingUserId);
    await Promise.allSettled([
      secureStore.clearAll(),
      AsyncStorage.removeItem(KEY_CACHED_USER),
    ]);
    set({ user: null, accessToken: null, refreshToken: null, pendingAuth: null });
  },
  setUser: (user) => {
    void AsyncStorage.setItem(KEY_CACHED_USER, JSON.stringify(user)).catch(() => {});
    set({ user });
  },
  setPendingAuth: (pendingAuth) => set({ pendingAuth }),
}));
setOnTokensRefreshed((accessToken, refreshToken) => {
  useSessionStore.setState({ accessToken, refreshToken });
});


/**
 * Restores tokens from the keychain, then (when an access token exists) loads
 * the current user via /auth/me. Tokens alone are enough for AuthGate; the me
 * fetch fills the profile card (name/email/initials) which is not persisted.
 */
export async function hydrateSession(): Promise<void> {
  const [accessToken, refreshToken, cachedUserStr] = await Promise.all([
    secureStore.getAccessToken(),
    secureStore.getRefreshToken(),
    AsyncStorage.getItem(KEY_CACHED_USER).catch(() => null),
  ]);
  let cachedUser: User | null = null;
  if (cachedUserStr) {
    try {
      cachedUser = JSON.parse(cachedUserStr) as User;
    } catch {}
  }

  // Mark hydrated immediately so splash screen dismisses instantly with local tokens and cached user
  useSessionStore.setState({ user: cachedUser, accessToken, refreshToken, hydrated: true });

  if (!accessToken && !refreshToken) return;

  // Background profile validation and token refresh via single-flight mutex
  (async () => {
    try {
      if (!accessToken && refreshToken) {
        const refreshed = await refreshTokensOnce();
        if (!refreshed) return;
      }
      const user = await authEndpoints.me();
      if (useSessionStore.getState().accessToken) {
        useSessionStore.getState().setUser(user);
      }
    } catch {
      // Network error or offline: retain cached credentials, do not logout
    }
  })().catch(() => {});
}
