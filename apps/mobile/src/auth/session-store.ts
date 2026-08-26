import { create } from 'zustand';
import type { AuthResult, User } from '@expyrico/shared';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { secureStore } from './secure-store';
import { authEndpoints } from '../api/endpoints';
import { purgePrivateImageCache } from '../api/product-private-image';
import { clearDraftLocalStateForUser } from '../features/products/product-draft-storage';

const KEY_CACHED_USER = '@pantry_cached_user';

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
    // Covers a user switch without an intervening explicit sign-out (e.g. a
    // re-auth flow that never called signOut first) — a stale cache entry
    // must never survive into a different account's session.
    purgePrivateImageCache();
    await Promise.allSettled([
      secureStore.setAccessToken(tokens.accessToken),
      secureStore.setRefreshToken(tokens.refreshToken),
      AsyncStorage.setItem(KEY_CACHED_USER, JSON.stringify(user)),
    ]);
    set({ user, accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, pendingAuth: null });
  },
  signOut: async () => {
    purgePrivateImageCache();
    // Data-hygiene cleanup for a shared device — read the outgoing user's ID
    // before it's cleared below.
    const outgoingUserId = get().user?.id;
    if (outgoingUserId) await clearDraftLocalStateForUser(outgoingUserId);
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

  // Background profile and token refresh (non-blocking)
  (async () => {
    try {
      let token = accessToken;
      if (!token && refreshToken) {
        const newTokens = await authEndpoints.refresh(refreshToken);
        token = newTokens.accessToken;
        await secureStore.setAccessToken(newTokens.accessToken);
        await secureStore.setRefreshToken(newTokens.refreshToken);
        useSessionStore.setState({ accessToken: newTokens.accessToken, refreshToken: newTokens.refreshToken });
      }
      const user = await authEndpoints.me();
      if (useSessionStore.getState().accessToken) {
        useSessionStore.getState().setUser(user);
      }
    } catch (err: unknown) {
      if (refreshToken) {
        try {
          const newTokens = await authEndpoints.refresh(refreshToken);
          await secureStore.setAccessToken(newTokens.accessToken);
          await secureStore.setRefreshToken(newTokens.refreshToken);
          useSessionStore.setState({ accessToken: newTokens.accessToken, refreshToken: newTokens.refreshToken });
          const user = await authEndpoints.me();
          useSessionStore.getState().setUser(user);
        } catch {
          // Token revoked or offline
        }
      }
    }
  })().catch(() => {});
}
