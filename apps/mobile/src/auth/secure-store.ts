import * as Keychain from 'react-native-keychain';

const KEY_ACCESS = 'pantry.access_token';
const KEY_REFRESH = 'pantry.refresh_token';
const KEY_THEME = 'pantry.theme_preference';
const KEY_PUSH_REGISTERED = 'pantry.pushRegisteredV1';

export type ThemePreference = 'system' | 'expyrico' | 'expyricoDark';

const THEME_PREFERENCES: readonly ThemePreference[] = ['system', 'expyrico', 'expyricoDark'];

export function isThemePreference(v: string): v is ThemePreference {
  return (THEME_PREFERENCES as readonly string[]).includes(v);
}

const KEYCHAIN_OPTIONS: Keychain.Options = {
  accessible: Keychain?.ACCESSIBLE?.AFTER_FIRST_UNLOCK,
  securityLevel: Keychain?.SECURITY_LEVEL?.ANY,
};

async function getValue(service: string): Promise<string | null> {
  try {
    const result = await Keychain.getGenericPassword({ service, ...KEYCHAIN_OPTIONS });
    if (result === false) return null;
    return result.password;
  } catch {
    return null;
  }
}

async function setValue(service: string, value: string): Promise<void> {
  await Keychain.setGenericPassword(service, value, { service, ...KEYCHAIN_OPTIONS });
}

async function deleteValue(service: string): Promise<void> {
  await Keychain.resetGenericPassword({ service });
}

export const secureStore = {
  async getAccessToken(): Promise<string | null> {
    return getValue(KEY_ACCESS);
  },
  async setAccessToken(token: string): Promise<void> {
    await setValue(KEY_ACCESS, token);
  },

  async getRefreshToken(): Promise<string | null> {
    return getValue(KEY_REFRESH);
  },
  async setRefreshToken(token: string): Promise<void> {
    await setValue(KEY_REFRESH, token);
  },

  async getThemePreference(): Promise<ThemePreference | null> {
    const v = await getValue(KEY_THEME);
    if (v && isThemePreference(v)) return v;
    return null;
  },
  async setThemePreference(v: ThemePreference): Promise<void> {
    if (!isThemePreference(v)) throw new Error(`invalid theme preference: ${v}`);
    await setValue(KEY_THEME, v);
  },

  async clearAll(): Promise<void> {
    await deleteValue(KEY_ACCESS);
    await deleteValue(KEY_REFRESH);
    await deleteValue(KEY_THEME);
    await deleteValue(KEY_PUSH_REGISTERED);
    await deleteValue('pantry.pushRegisteredUserIdV1');
  },
};

// Generic key/value helpers for non-auth persisted state (sync cursor, push
// registration flag). Namespaced keys are passed by the caller.
export async function getItem(key: string): Promise<string | null> {
  return getValue(key);
}

export async function setItem(key: string, value: string): Promise<void> {
  await setValue(key, value);
}
