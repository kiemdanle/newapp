const memory: Record<string, string | null> = {};

function mockValueForKey(key: string): string | null {
  if (!(key in memory)) return null;
  return memory[key] ?? null;
}

function mockSetValueForKey(key: string, value: string | null) {
  memory[key] = value;
}

export function __reset() {
  for (const key of Object.keys(memory)) {
    memory[key] = null;
  }
}

export const setGenericPassword = jest.fn((username: string, password: string, options?: { service?: string }) => {
  mockSetValueForKey(options?.service ?? username, password);
  return Promise.resolve();
});

export const getGenericPassword = jest.fn((options?: { service?: string }) => {
  const v = mockValueForKey(options?.service ?? '');
  if (v === null) return Promise.resolve(false);
  return Promise.resolve({ username: options?.service ?? '', password: v, service: options?.service, storage: 'keychain' });
});

export const resetGenericPassword = jest.fn((options?: { service?: string }) => {
  mockSetValueForKey(options?.service ?? '', null);
  return Promise.resolve(true);
});
