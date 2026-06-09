import { randomInt } from 'node:crypto';
import { getPrisma } from '../../db.js';

// 32-char alphabet: A–Z minus O/I, plus 2–9 (no 0/1) — avoids visual ambiguity.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 8;

export function generateReferralCode(): string {
  let out = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    out += ALPHABET[randomInt(ALPHABET.length)];
  }
  return out;
}

export async function generateUniqueReferralCode(maxAttempts = 5): Promise<string> {
  const prisma = getPrisma();
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const code = generateReferralCode();
    const existing = await prisma.user.findUnique({ where: { referralCode: code } });
    if (!existing) return code;
  }
  throw new Error('failed to generate a unique referral code');
}
