import { create } from 'zustand';
import type { AuthResult, User } from '@expyrico/shared';
import { secureStore } from './secure-store';

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

export async function hydrateSession(): Promise<void> {
  const accessToken = await secureStore.getAccessToken();
  const refreshToken = await secureStore.getRefreshToken();
  useSessionStore.setState({ accessToken, refreshToken, hydrated: true });
}
