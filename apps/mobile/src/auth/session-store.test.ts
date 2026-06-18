import { useSessionStore, hydrateSession } from './session-store';
import { secureStore } from './secure-store';
import { __reset } from '../../tests/mocks/expo-secure-store';

const USER = {
  id: 'u1',
  email: 'a@b.c',
  emailVerified: true,
  firstName: 'A',
  lastName: 'B',
  country: null,
  avatarUrl: null,
  role: 'user' as const,
  status: 'active' as const,
  themePreference: 'expyrico' as const,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

describe('session store', () => {
  beforeEach(() => {
    __reset();
    useSessionStore.setState({
      user: null,
      accessToken: null,
      refreshToken: null,
      hydrated: false,
    });
  });

  it('signIn populates state and persists tokens', async () => {
    await useSessionStore.getState().signIn({
      user: USER,
      tokens: { accessToken: 'a', refreshToken: 'r', expiresIn: 900 },
    });
    expect(useSessionStore.getState().user?.id).toBe('u1');
    expect(useSessionStore.getState().accessToken).toBe('a');
    expect(await secureStore.getAccessToken()).toBe('a');
    expect(await secureStore.getRefreshToken()).toBe('r');
  });

  it('signOut clears state and tokens', async () => {
    await useSessionStore.getState().signIn({
      user: USER,
      tokens: { accessToken: 'a', refreshToken: 'r', expiresIn: 900 },
    });
    await useSessionStore.getState().signOut();
    expect(useSessionStore.getState().user).toBeNull();
    expect(useSessionStore.getState().accessToken).toBeNull();
    expect(await secureStore.getAccessToken()).toBeNull();
  });

  it('hydrateSession loads tokens from secure-store and marks hydrated=true', async () => {
    await secureStore.setAccessToken('a');
    await secureStore.setRefreshToken('r');
    await hydrateSession();
    expect(useSessionStore.getState().accessToken).toBe('a');
    expect(useSessionStore.getState().refreshToken).toBe('r');
    expect(useSessionStore.getState().hydrated).toBe(true);
  });

  it('hydrateSession marks hydrated=true even when no tokens exist', async () => {
    await hydrateSession();
    expect(useSessionStore.getState().hydrated).toBe(true);
    expect(useSessionStore.getState().accessToken).toBeNull();
  });
});
