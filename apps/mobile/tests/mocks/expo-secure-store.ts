const store = new Map<string, string>();
export const WHEN_UNLOCKED = 'WHEN_UNLOCKED';
export async function setItemAsync(k: string, v: string) {
  store.set(k, v);
}
export async function getItemAsync(k: string) {
  return store.get(k) ?? null;
}
export async function deleteItemAsync(k: string) {
  store.delete(k);
}
export function __reset() {
  store.clear();
}
