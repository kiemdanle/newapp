import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import { getConfig } from '../../config.js';
import { encrypt, decrypt } from '../../utils/encryption.js';
import { randomToken } from '../../utils/random.js';

authenticator.options = { window: 1 };

export interface TotpEnrollment {
  encryptedSecret: string;
  qrCodeDataUrl: string;
  rawSecret: string;
  recoveryCodes: string[];
}

export async function buildEnrollment(email: string): Promise<TotpEnrollment> {
  const cfg = getConfig();
  const rawSecret = authenticator.generateSecret();
  const otpauth = authenticator.keyuri(email, 'Expyrico Admin', rawSecret);
  const qrCodeDataUrl = await QRCode.toDataURL(otpauth);
  const encryptedSecret = encrypt(rawSecret, cfg.totp.encryptionKey);
  const recoveryCodes = Array.from({ length: 10 }, () => randomToken(8).slice(0, 10));
  return { encryptedSecret, qrCodeDataUrl, rawSecret, recoveryCodes };
}

export function verifyTotp(encryptedSecret: string, code: string): boolean {
  const cfg = getConfig();
  try {
    const secret = decrypt(encryptedSecret, cfg.totp.encryptionKey);
    return authenticator.check(code, secret);
  } catch {
    return false;
  }
}

/**
 * TEMPORARY diagnostic. Returns how the submitted code relates to the secret
 * without ever exposing the secret. delta is the time-step offset the code
 * matches at within a wide window: 0 = current step, ±N = N*30s skew, null =
 * no match at any window (code came from a DIFFERENT secret). Remove once the
 * enrollment-mismatch investigation is closed.
 */
export function diagnoseTotp(
  encryptedSecret: string,
  code: string,
): { delta: number | null; expectedNow: string } {
  const cfg = getConfig();
  const secret = decrypt(encryptedSecret, cfg.totp.encryptionKey);
  const wide = authenticator.clone({ window: [10, 10] });
  const delta = wide.checkDelta(code, secret);
  return { delta: delta === null ? null : delta, expectedNow: authenticator.generate(secret) };
}
