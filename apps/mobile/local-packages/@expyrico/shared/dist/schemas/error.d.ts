import { z } from 'zod';
/**
 * RFC 7807 problem+json with a stable `code` for client matching.
 */
export declare const problemSchema: z.ZodObject<{
    type: z.ZodOptional<z.ZodString>;
    title: z.ZodString;
    status: z.ZodNumber;
    detail: z.ZodOptional<z.ZodString>;
    instance: z.ZodOptional<z.ZodString>;
    code: z.ZodString;
    errors: z.ZodOptional<z.ZodArray<z.ZodObject<{
        path: z.ZodString;
        message: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        path: string;
        message: string;
    }, {
        path: string;
        message: string;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    status: number;
    code: string;
    title: string;
    type?: string | undefined;
    detail?: string | undefined;
    instance?: string | undefined;
    errors?: {
        path: string;
        message: string;
    }[] | undefined;
}, {
    status: number;
    code: string;
    title: string;
    type?: string | undefined;
    detail?: string | undefined;
    instance?: string | undefined;
    errors?: {
        path: string;
        message: string;
    }[] | undefined;
}>;
export type Problem = z.infer<typeof problemSchema>;
export declare const ERROR_CODES: {
    readonly VALIDATION: "validation_error";
    readonly UNAUTHORIZED: "unauthorized";
    readonly FORBIDDEN: "forbidden";
    readonly NOT_FOUND: "not_found";
    readonly CONFLICT: "conflict";
    readonly RATE_LIMITED: "rate_limited";
    readonly INTERNAL: "internal_error";
    readonly INVALID_CREDENTIALS: "invalid_credentials";
    readonly EMAIL_NOT_VERIFIED: "email_not_verified";
    readonly EMAIL_ALREADY_REGISTERED: "email_already_registered";
    readonly INVALID_TOKEN: "invalid_token";
    readonly TOKEN_EXPIRED: "token_expired";
    readonly REQUIRES_TOTP: "requires_totp";
    readonly REQUIRES_TOTP_ENROLLMENT: "requires_totp_enrollment";
    readonly INVALID_TOTP: "invalid_totp";
    readonly INVALID_RECOVERY_CODE: "invalid_recovery_code";
    readonly PASSKEY_VERIFICATION_FAILED: "passkey_verification_failed";
    readonly REVIEW_ALREADY_EXISTS: "review_already_exists";
    readonly REVIEW_NOT_FOUND: "review_not_found";
    readonly REVIEW_HAS_NO_COMMENT: "review_has_no_comment";
    readonly REPORT_TARGET_NOT_FOUND: "report_target_not_found";
    readonly ITEM_LIMIT_REACHED: "item_limit_reached";
    readonly DEAL_NOT_FOUND: "deal_not_found";
    readonly CANNOT_VOTE_OWN_DEAL: "cannot_vote_own_deal";
    readonly GIVEAWAY_NOT_OPEN: "giveaway_not_open";
    readonly GIVEAWAY_INVALID_TRANSITION: "giveaway_invalid_transition";
    readonly CLAIM_ALREADY_EXISTS: "claim_already_exists";
    readonly CLAIM_NOT_FOUND: "claim_not_found";
    readonly HANDOFF_NOT_ALLOWED: "handoff_not_allowed";
    readonly CONFIRM_NOT_ALLOWED: "confirm_not_allowed";
    readonly RATING_NOT_READY: "rating_not_ready";
    readonly RATING_ALREADY_EXISTS: "rating_already_exists";
    readonly RATING_NOT_ALLOWED: "rating_not_allowed";
    readonly REFERRAL_CODE_NOT_FOUND: "referral_code_not_found";
    readonly SELF_REFERRAL_NOT_ALLOWED: "self_referral_not_allowed";
    readonly REFERRAL_ALREADY_ATTRIBUTED: "referral_already_attributed";
    readonly HOUSEHOLD_NOT_FOUND: "household_not_found";
    readonly HOUSEHOLD_NOT_MEMBER: "household_not_member";
    readonly HOUSEHOLD_FORBIDDEN: "household_forbidden";
    readonly HOUSEHOLD_OWNER_CANNOT_LEAVE: "household_owner_cannot_leave";
    readonly MEMBER_NOT_FOUND: "member_not_found";
    readonly RECORD_HOUSEHOLD_FORBIDDEN: "record_household_forbidden";
};
export declare const ITEM_LIMIT = 50;
export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];
//# sourceMappingURL=error.d.ts.map