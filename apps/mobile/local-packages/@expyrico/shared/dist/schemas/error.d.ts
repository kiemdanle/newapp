import { z } from 'zod';
/**
 * RFC 7807 problem+json with a stable `code` for client matching.
 *
 * `currentVersion`/`canonicalProduct` are safe, explicitly typed structured fields for
 * optimistic-concurrency conflicts (never a generic arbitrary details bag). Both are
 * optional so most problems carry neither, and `canonicalProduct` is only ever present
 * when the server has already decided it is visible to the caller.
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
    currentVersion: z.ZodOptional<z.ZodNumber>;
    canonicalProduct: z.ZodOptional<z.ZodObject<{
        id: z.ZodString;
        barcode: z.ZodNullable<z.ZodString>;
        qrPayload: z.ZodNullable<z.ZodString>;
        name: z.ZodString;
        description: z.ZodNullable<z.ZodString>;
        brand: z.ZodNullable<z.ZodString>;
        category: z.ZodNullable<z.ZodString>;
        imageUrl: z.ZodNullable<z.ZodString>;
        defaultShelfLifeDays: z.ZodNullable<z.ZodNumber>;
        source: z.ZodEnum<["off", "upcitemdb", "user"]>;
        sourceId: z.ZodNullable<z.ZodString>;
        isCommunityEligible: z.ZodBoolean;
        buyAgainCount: z.ZodNumber;
        buyAgainOnSaleCount: z.ZodNumber;
        wontBuyCount: z.ZodNumber;
        ratingCount: z.ZodNumber;
        reviewCount: z.ZodNumber;
        status: z.ZodEnum<["draft", "pending", "changes_required", "active", "report_hidden", "merged_into"]>;
        version: z.ZodNumber;
        photos: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            position: z.ZodNumber;
            thumbnailUrl: z.ZodString;
            displayUrl: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            id: string;
            position: number;
            thumbnailUrl: string;
            displayUrl: string;
        }, {
            id: string;
            position: number;
            thumbnailUrl: string;
            displayUrl: string;
        }>, "many">;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        status: "draft" | "pending" | "changes_required" | "active" | "report_hidden" | "merged_into";
        barcode: string | null;
        qrPayload: string | null;
        name: string;
        description: string | null;
        brand: string | null;
        category: string | null;
        imageUrl: string | null;
        defaultShelfLifeDays: number | null;
        source: "off" | "upcitemdb" | "user";
        sourceId: string | null;
        isCommunityEligible: boolean;
        buyAgainCount: number;
        buyAgainOnSaleCount: number;
        wontBuyCount: number;
        ratingCount: number;
        reviewCount: number;
        version: number;
        photos: {
            id: string;
            position: number;
            thumbnailUrl: string;
            displayUrl: string;
        }[];
        createdAt: string;
        updatedAt: string;
    }, {
        id: string;
        status: "draft" | "pending" | "changes_required" | "active" | "report_hidden" | "merged_into";
        barcode: string | null;
        qrPayload: string | null;
        name: string;
        description: string | null;
        brand: string | null;
        category: string | null;
        imageUrl: string | null;
        defaultShelfLifeDays: number | null;
        source: "off" | "upcitemdb" | "user";
        sourceId: string | null;
        isCommunityEligible: boolean;
        buyAgainCount: number;
        buyAgainOnSaleCount: number;
        wontBuyCount: number;
        ratingCount: number;
        reviewCount: number;
        version: number;
        photos: {
            id: string;
            position: number;
            thumbnailUrl: string;
            displayUrl: string;
        }[];
        createdAt: string;
        updatedAt: string;
    }>>;
}, "strip", z.ZodTypeAny, {
    code: string;
    status: number;
    title: string;
    type?: string | undefined;
    detail?: string | undefined;
    instance?: string | undefined;
    errors?: {
        path: string;
        message: string;
    }[] | undefined;
    currentVersion?: number | undefined;
    canonicalProduct?: {
        id: string;
        status: "draft" | "pending" | "changes_required" | "active" | "report_hidden" | "merged_into";
        barcode: string | null;
        qrPayload: string | null;
        name: string;
        description: string | null;
        brand: string | null;
        category: string | null;
        imageUrl: string | null;
        defaultShelfLifeDays: number | null;
        source: "off" | "upcitemdb" | "user";
        sourceId: string | null;
        isCommunityEligible: boolean;
        buyAgainCount: number;
        buyAgainOnSaleCount: number;
        wontBuyCount: number;
        ratingCount: number;
        reviewCount: number;
        version: number;
        photos: {
            id: string;
            position: number;
            thumbnailUrl: string;
            displayUrl: string;
        }[];
        createdAt: string;
        updatedAt: string;
    } | undefined;
}, {
    code: string;
    status: number;
    title: string;
    type?: string | undefined;
    detail?: string | undefined;
    instance?: string | undefined;
    errors?: {
        path: string;
        message: string;
    }[] | undefined;
    currentVersion?: number | undefined;
    canonicalProduct?: {
        id: string;
        status: "draft" | "pending" | "changes_required" | "active" | "report_hidden" | "merged_into";
        barcode: string | null;
        qrPayload: string | null;
        name: string;
        description: string | null;
        brand: string | null;
        category: string | null;
        imageUrl: string | null;
        defaultShelfLifeDays: number | null;
        source: "off" | "upcitemdb" | "user";
        sourceId: string | null;
        isCommunityEligible: boolean;
        buyAgainCount: number;
        buyAgainOnSaleCount: number;
        wontBuyCount: number;
        ratingCount: number;
        reviewCount: number;
        version: number;
        photos: {
            id: string;
            position: number;
            thumbnailUrl: string;
            displayUrl: string;
        }[];
        createdAt: string;
        updatedAt: string;
    } | undefined;
}>;
export type Problem = z.infer<typeof problemSchema>;
export declare const versionConflictProblemSchema: z.ZodObject<{
    type: z.ZodOptional<z.ZodString>;
    title: z.ZodString;
    status: z.ZodNumber;
    detail: z.ZodOptional<z.ZodString>;
    instance: z.ZodOptional<z.ZodString>;
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
    canonicalProduct: z.ZodOptional<z.ZodObject<{
        id: z.ZodString;
        barcode: z.ZodNullable<z.ZodString>;
        qrPayload: z.ZodNullable<z.ZodString>;
        name: z.ZodString;
        description: z.ZodNullable<z.ZodString>;
        brand: z.ZodNullable<z.ZodString>;
        category: z.ZodNullable<z.ZodString>;
        imageUrl: z.ZodNullable<z.ZodString>;
        defaultShelfLifeDays: z.ZodNullable<z.ZodNumber>;
        source: z.ZodEnum<["off", "upcitemdb", "user"]>;
        sourceId: z.ZodNullable<z.ZodString>;
        isCommunityEligible: z.ZodBoolean;
        buyAgainCount: z.ZodNumber;
        buyAgainOnSaleCount: z.ZodNumber;
        wontBuyCount: z.ZodNumber;
        ratingCount: z.ZodNumber;
        reviewCount: z.ZodNumber;
        status: z.ZodEnum<["draft", "pending", "changes_required", "active", "report_hidden", "merged_into"]>;
        version: z.ZodNumber;
        photos: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            position: z.ZodNumber;
            thumbnailUrl: z.ZodString;
            displayUrl: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            id: string;
            position: number;
            thumbnailUrl: string;
            displayUrl: string;
        }, {
            id: string;
            position: number;
            thumbnailUrl: string;
            displayUrl: string;
        }>, "many">;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        status: "draft" | "pending" | "changes_required" | "active" | "report_hidden" | "merged_into";
        barcode: string | null;
        qrPayload: string | null;
        name: string;
        description: string | null;
        brand: string | null;
        category: string | null;
        imageUrl: string | null;
        defaultShelfLifeDays: number | null;
        source: "off" | "upcitemdb" | "user";
        sourceId: string | null;
        isCommunityEligible: boolean;
        buyAgainCount: number;
        buyAgainOnSaleCount: number;
        wontBuyCount: number;
        ratingCount: number;
        reviewCount: number;
        version: number;
        photos: {
            id: string;
            position: number;
            thumbnailUrl: string;
            displayUrl: string;
        }[];
        createdAt: string;
        updatedAt: string;
    }, {
        id: string;
        status: "draft" | "pending" | "changes_required" | "active" | "report_hidden" | "merged_into";
        barcode: string | null;
        qrPayload: string | null;
        name: string;
        description: string | null;
        brand: string | null;
        category: string | null;
        imageUrl: string | null;
        defaultShelfLifeDays: number | null;
        source: "off" | "upcitemdb" | "user";
        sourceId: string | null;
        isCommunityEligible: boolean;
        buyAgainCount: number;
        buyAgainOnSaleCount: number;
        wontBuyCount: number;
        ratingCount: number;
        reviewCount: number;
        version: number;
        photos: {
            id: string;
            position: number;
            thumbnailUrl: string;
            displayUrl: string;
        }[];
        createdAt: string;
        updatedAt: string;
    }>>;
} & {
    code: z.ZodLiteral<"version_conflict">;
    currentVersion: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    code: "version_conflict";
    status: number;
    title: string;
    currentVersion: number;
    type?: string | undefined;
    detail?: string | undefined;
    instance?: string | undefined;
    errors?: {
        path: string;
        message: string;
    }[] | undefined;
    canonicalProduct?: {
        id: string;
        status: "draft" | "pending" | "changes_required" | "active" | "report_hidden" | "merged_into";
        barcode: string | null;
        qrPayload: string | null;
        name: string;
        description: string | null;
        brand: string | null;
        category: string | null;
        imageUrl: string | null;
        defaultShelfLifeDays: number | null;
        source: "off" | "upcitemdb" | "user";
        sourceId: string | null;
        isCommunityEligible: boolean;
        buyAgainCount: number;
        buyAgainOnSaleCount: number;
        wontBuyCount: number;
        ratingCount: number;
        reviewCount: number;
        version: number;
        photos: {
            id: string;
            position: number;
            thumbnailUrl: string;
            displayUrl: string;
        }[];
        createdAt: string;
        updatedAt: string;
    } | undefined;
}, {
    code: "version_conflict";
    status: number;
    title: string;
    currentVersion: number;
    type?: string | undefined;
    detail?: string | undefined;
    instance?: string | undefined;
    errors?: {
        path: string;
        message: string;
    }[] | undefined;
    canonicalProduct?: {
        id: string;
        status: "draft" | "pending" | "changes_required" | "active" | "report_hidden" | "merged_into";
        barcode: string | null;
        qrPayload: string | null;
        name: string;
        description: string | null;
        brand: string | null;
        category: string | null;
        imageUrl: string | null;
        defaultShelfLifeDays: number | null;
        source: "off" | "upcitemdb" | "user";
        sourceId: string | null;
        isCommunityEligible: boolean;
        buyAgainCount: number;
        buyAgainOnSaleCount: number;
        wontBuyCount: number;
        ratingCount: number;
        reviewCount: number;
        version: number;
        photos: {
            id: string;
            position: number;
            thumbnailUrl: string;
            displayUrl: string;
        }[];
        createdAt: string;
        updatedAt: string;
    } | undefined;
}>;
export type VersionConflictProblem = z.infer<typeof versionConflictProblemSchema>;
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
    readonly VERSION_CONFLICT: "version_conflict";
    readonly UNSUPPORTED_MEDIA: "unsupported_media";
    readonly PAYLOAD_TOO_LARGE: "payload_too_large";
    readonly PIXEL_LIMIT_EXCEEDED: "pixel_limit_exceeded";
    readonly PROCESSING_TIMEOUT: "processing_timeout";
    readonly STORAGE_CAPACITY_UNAVAILABLE: "storage_capacity_unavailable";
    readonly UPGRADE_REQUIRED: "upgrade_required";
    readonly FEATURE_DISABLED: "feature_disabled";
    readonly TEMPORARILY_UNAVAILABLE: "temporarily_unavailable";
    readonly IDEMPOTENCY_KEY_REUSED: "idempotency_key_reused";
    readonly IDEMPOTENCY_IN_PROGRESS: "idempotency_in_progress";
};
export declare const ITEM_LIMIT = 50;
export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];
//# sourceMappingURL=error.d.ts.map