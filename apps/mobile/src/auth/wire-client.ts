import { setOnSignOut } from '../api/client';
import { useSessionStore } from './session-store';

let wired = false;
export function wireApiClient(): void {
  if (wired) return;
  wired = true;
  setOnSignOut(() => {
    // Fire-and-forget — secureStore is already cleared by the refresh path
    void useSessionStore.getState().signOut();
  });
}
