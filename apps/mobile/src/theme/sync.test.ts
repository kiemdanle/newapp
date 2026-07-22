import { syncThemeToServer } from './sync';
import { jsonResponse, queueFetch } from '../../tests/mocks/fetch';
import { secureStore } from '../auth/secure-store';
import { __reset } from '../../tests/mocks/react-native-keychain';

describe('syncThemeToServer', () => {
  beforeEach(() => __reset());

  it('PATCHes /v1/me with theme_preference when authed', async () => {
    await secureStore.setAccessToken('a');
    const f = queueFetch(jsonResponse({ id: 'u', themePreference: 'expyrico' }));
    await syncThemeToServer('expyrico');
    expect(f).toHaveBeenCalledTimes(1);
    const [url, init] = f.mock.calls[0]!;
    expect(url).toBe('http://localhost:4000/v1/me');
    expect((init as RequestInit).method).toBe('PATCH');
    expect((init as RequestInit).body).toBe(JSON.stringify({ themePreference: 'expyrico' }));
  });

  it('is a no-op when there is no access token', async () => {
    const f = queueFetch();
    await syncThemeToServer('expyrico');
    expect(f).not.toHaveBeenCalled();
  });

  it('swallows errors so a failed sync never breaks the UI', async () => {
    await secureStore.setAccessToken('a');
    queueFetch(new Response('boom', { status: 500 }));
    await expect(syncThemeToServer('expyrico')).resolves.toBeUndefined();
  });
});
