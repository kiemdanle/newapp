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
  const otpauth = authenticator.keyuri(email, 'Pantry Admin', rawSecret);
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
