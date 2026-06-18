import { create } from 'zustand';
import type { AuthResult, User } from '@expyrico/shared';
import { secureStore } from './secure-store';

interface SessionState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  hydrated: boolean;
  signIn: (result: AuthResult) => Promise<void>;
  signOut: () => Promise<void>;
  setUser: (user: User) => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  hydrated: false,
  signIn: async ({ user, tokens }) => {
    await secureStore.setAccessToken(tokens.accessToken);
    await secureStore.setRefreshToken(tokens.refreshToken);
    set({ user, accessToken: tokens.accessToken, refreshToken: tokens.refreshToken });
  },
  signOut: async () => {
    await secureStore.clearAll();
    set({ user: null, accessToken: null, refreshToken: null });
  },
  setUser: (user) => set({ user }),
}));

export async function hydrateSession(): Promise<void> {
  const accessToken = await secureStore.getAccessToken();
  const refreshToken = await secureStore.getRefreshToken();
  useSessionStore.setState({ accessToken, refreshToken, hydrated: true });
}
