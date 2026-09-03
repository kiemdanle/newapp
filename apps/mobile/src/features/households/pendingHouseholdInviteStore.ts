import { getItem, setItem, deleteItem } from '../../auth/secure-store';

const KEY = 'pending_household_invite_code';
const CODE_RE = /^[A-Z2-9]{4,12}$/;

export async function capturePendingHouseholdInviteCode(
  raw: string | null | undefined,
): Promise<void> {
  if (!raw) return;
  const code = raw.trim().toUpperCase();
  if (!CODE_RE.test(code)) return;
  await setItem(KEY, code);
}

export async function readPendingHouseholdInviteCode(): Promise<string | null> {
  const val = await getItem(KEY);
  return val && val.trim().length > 0 ? val : null;
}

export async function clearPendingHouseholdInviteCode(): Promise<void> {
  await deleteItem(KEY);
}
