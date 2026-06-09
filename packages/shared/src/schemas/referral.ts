import { z } from 'zod';

export const referralStatusSchema = z.enum(['pending', 'activated']);
export type ReferralStatus = z.infer<typeof referralStatusSchema>;

export const referralCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z2-9]{8}$/, 'invalid referral code');
export type ReferralCode = z.infer<typeof referralCodeSchema>;

export const referredUserSchema = z.object({
  referredUserId: z.string().uuid(),
  firstName: z.string(),
  status: referralStatusSchema,
  activatedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});
export type ReferredUser = z.infer<typeof referredUserSchema>;

/** GET /v1/me/referral — passive attribution summary (v1.x, no rewards). */
export const referralSummarySchema = z.object({
  referralCode: referralCodeSchema,
  shareUrl: z.string().url(),
  activatedCount: z.number().int().nonnegative(),
});
export type ReferralSummary = z.infer<typeof referralSummarySchema>;

/** GET /v1/admin/referrals/overview */
export const adminReferralRowSchema = z.object({
  referrerUserId: z.string().uuid(),
  firstName: z.string(),
  email: z.string(),
  referralCode: referralCodeSchema.nullable(),
  referredCount: z.number().int().nonnegative(),
  activatedCount: z.number().int().nonnegative(),
  abuseFlag: z.boolean(),
});
export type AdminReferralRow = z.infer<typeof adminReferralRowSchema>;

export const adminReferralOverviewSchema = z.object({
  totalReferrals: z.number().int().nonnegative(),
  totalActivated: z.number().int().nonnegative(),
  topReferrers: z.array(adminReferralRowSchema),
});
export type AdminReferralOverview = z.infer<typeof adminReferralOverviewSchema>;
