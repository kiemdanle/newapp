import { z } from 'zod';

/**
 * RFC 7807 problem+json with a stable `code` for client matching.
 */
export const problemSchema = z.object({
  type: z.string().url().optional(),
  title: z.string(),
  status: z.number().int().min(400).max(599),
  detail: z.string().optional(),
  instance: z.string().optional(),
  code: z.string(),
  errors: z.array(z.object({ path: z.string(), message: z.string() })).optional(),
});
export type Problem = z.infer<typeof problemSchema>;

export const ERROR_CODES = {
  VALIDATION: 'validation_error',
  UNAUTHORIZED: 'unauthorized',
  FORBIDDEN: 'forbidden',
  NOT_FOUND: 'not_found',
  CONFLICT: 'conflict',
  RATE_LIMITED: 'rate_limited',
  INTERNAL: 'internal_error',

  // Auth-specific
  INVALID_CREDENTIALS: 'invalid_credentials',
  EMAIL_NOT_VERIFIED: 'email_not_verified',
  EMAIL_ALREADY_REGISTERED: 'email_already_registered',
  INVALID_TOKEN: 'invalid_token',
  TOKEN_EXPIRED: 'token_expired',
  REQUIRES_TOTP: 'requires_totp',
  REQUIRES_TOTP_ENROLLMENT: 'requires_totp_enrollment',
  INVALID_TOTP: 'invalid_totp',
  INVALID_RECOVERY_CODE: 'invalid_recovery_code',
  PASSKEY_VERIFICATION_FAILED: 'passkey_verification_failed',

  // Reviews + reports
  REVIEW_ALREADY_EXISTS: 'review_already_exists',
  REVIEW_NOT_FOUND: 'review_not_found',
  REVIEW_HAS_NO_COMMENT: 'review_has_no_comment',
  REPORT_TARGET_NOT_FOUND: 'report_target_not_found',

  // Pantry item cap
  ITEM_LIMIT_REACHED: 'item_limit_reached',

  // Deals
  DEAL_NOT_FOUND: 'deal_not_found',
  CANNOT_VOTE_OWN_DEAL: 'cannot_vote_own_deal',

  // Giveaways
  GIVEAWAY_NOT_OPEN: 'giveaway_not_open',
  GIVEAWAY_INVALID_TRANSITION: 'giveaway_invalid_transition',
  CLAIM_ALREADY_EXISTS: 'claim_already_exists',
  CLAIM_NOT_FOUND: 'claim_not_found',
  HANDOFF_NOT_ALLOWED: 'handoff_not_allowed',
  CONFIRM_NOT_ALLOWED: 'confirm_not_allowed',
  RATING_NOT_READY: 'rating_not_ready',
  RATING_ALREADY_EXISTS: 'rating_already_exists',
  RATING_NOT_ALLOWED: 'rating_not_allowed',

  // Referrals
  REFERRAL_CODE_NOT_FOUND: 'referral_code_not_found',
  SELF_REFERRAL_NOT_ALLOWED: 'self_referral_not_allowed',
  REFERRAL_ALREADY_ATTRIBUTED: 'referral_already_attributed',

  // Households
  HOUSEHOLD_NOT_FOUND: 'household_not_found',
  HOUSEHOLD_NOT_MEMBER: 'household_not_member',
  HOUSEHOLD_FORBIDDEN: 'household_forbidden',
  HOUSEHOLD_OWNER_CANNOT_LEAVE: 'household_owner_cannot_leave',
  MEMBER_NOT_FOUND: 'member_not_found',
  RECORD_HOUSEHOLD_FORBIDDEN: 'record_household_forbidden',
} as const;

export const ITEM_LIMIT = 50;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];
