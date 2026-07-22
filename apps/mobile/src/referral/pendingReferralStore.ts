import { getItem, setItem } from '../auth/secure-store';

const KEY = 'pending_referral_code';
const CODE_RE = /^[A-Z2-9]{8}$/;

/** Persist a captured code (validated + normalized). No-op for invalid input.
 *  First-launch capture wins — does NOT overwrite an already-captured code. */
export async function capturePendingReferralCode(
  raw: string | null | undefined,
): Promise<void> {
  if (!raw) return;
  const code = raw.trim().toUpperCase();
  if (!CODE_RE.test(code)) return;
  const existing = await getItem(KEY);
  if (existing) return;
  await setItem(KEY, code);
}

export async function readPendingReferralCode(): Promise<string | null> {
  return getItem(KEY);
}

export async function clearPendingReferralCode(): Promise<void> {
  await setItem(KEY, '');
}
