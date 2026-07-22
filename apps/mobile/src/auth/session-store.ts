import { create } from 'zustand';
import type { AuthResult, User } from '@expyrico/shared';
import { secureStore } from './secure-store';
import { authEndpoints } from '../api/endpoints';

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

export const useSessionStore = create<SessionState>((set) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  hydrated: false,
  pendingAuth: null,
  signIn: async ({ user, tokens }) => {
    await secureStore.setAccessToken(tokens.accessToken);
    await secureStore.setRefreshToken(tokens.refreshToken);
    set({ user, accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, pendingAuth: null });
  },
  signOut: async () => {
    await secureStore.clearAll();
    set({ user: null, accessToken: null, refreshToken: null, pendingAuth: null });
  },
  setUser: (user) => set({ user }),
  setPendingAuth: (pendingAuth) => set({ pendingAuth }),
}));

/**
 * Restores tokens from the keychain, then (when an access token exists) loads
 * the current user via /auth/me. Tokens alone are enough for AuthGate; the me
 * fetch fills the profile card (name/email/initials) which is not persisted.
 */
export async function hydrateSession(): Promise<void> {
  const accessToken = await secureStore.getAccessToken();
  const refreshToken = await secureStore.getRefreshToken();
  useSessionStore.setState({ accessToken, refreshToken, hydrated: true });

  if (!accessToken) return;

  try {
    const user = await authEndpoints.me();
    // Drop the profile if sign-out raced while /me was in flight.
    if (useSessionStore.getState().accessToken) {
      useSessionStore.getState().setUser(user);
    }
  } catch {
    // Keep tokens; profile can retry later. A hard 401 is handled by the
    // api client refresh/sign-out path.
  }
}
