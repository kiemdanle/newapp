export function isNetworkError(error: unknown): boolean {
  return error instanceof TypeError && /network request failed|failed to fetch/i.test(error.message);
}

export const NETWORK_ERROR_MESSAGE =
  'Cannot reach the Expyrico API. Check that the local API server is running and adb reverse is active.';
