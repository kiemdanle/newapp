import { getPrisma } from '../../db.js';
import { generateUniqueReferralCode } from './referral-code.js';
import { getConfig } from '../../config.js';

export function shareUrlForCode(code: string): string {
  const cfg = getConfig() as unknown as Record<string, unknown>;
  const base = ((cfg.publicWebBaseUrl as string | undefined) ?? 'https://expyrico.app').replace(/\/$/, '');
  return `${base}/invite?code=${code}`;
}

export async function ensureReferralCode(userId: string): Promise<string> {
  const prisma = getPrisma();
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { referralCode: true } });
  if (user.referralCode) return user.referralCode;
  const code = await generateUniqueReferralCode();
  await prisma.user.update({ where: { id: userId }, data: { referralCode: code } });
  return code;
}
