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
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];
