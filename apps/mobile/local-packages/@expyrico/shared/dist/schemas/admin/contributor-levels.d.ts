import { z } from 'zod';
export declare const contributorLevelsSettingSchema: z.ZodObject<{
    enabled: z.ZodDefault<z.ZodBoolean>;
    levels: z.ZodEffects<z.ZodArray<z.ZodObject<{
        level: z.ZodNumber;
        title: z.ZodString;
        productsReq: z.ZodNumber;
        minPoints: z.ZodNumber;
        badgeKey: z.ZodEnum<["seedling", "bronze_star", "silver_star", "gold_star", "emerald_gem", "sapphire_crown", "diamond_starburst"]>;
        colorToken: z.ZodEnum<["fresh_sage", "deep_sage", "mint_mist", "honey", "soft_butter", "pebble", "almost_black"]>;
        perks: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        level: number;
        title: string;
        productsReq: number;
        minPoints: number;
        badgeKey: "seedling" | "bronze_star" | "silver_star" | "gold_star" | "emerald_gem" | "sapphire_crown" | "diamond_starburst";
        colorToken: "fresh_sage" | "deep_sage" | "mint_mist" | "honey" | "soft_butter" | "pebble" | "almost_black";
        perks: string;
    }, {
        level: number;
        title: string;
        productsReq: number;
        minPoints: number;
        badgeKey: "seedling" | "bronze_star" | "silver_star" | "gold_star" | "emerald_gem" | "sapphire_crown" | "diamond_starburst";
        colorToken: "fresh_sage" | "deep_sage" | "mint_mist" | "honey" | "soft_butter" | "pebble" | "almost_black";
        perks: string;
    }>, "many">, {
        level: number;
        title: string;
        productsReq: number;
        minPoints: number;
        badgeKey: "seedling" | "bronze_star" | "silver_star" | "gold_star" | "emerald_gem" | "sapphire_crown" | "diamond_starburst";
        colorToken: "fresh_sage" | "deep_sage" | "mint_mist" | "honey" | "soft_butter" | "pebble" | "almost_black";
        perks: string;
    }[], {
        level: number;
        title: string;
        productsReq: number;
        minPoints: number;
        badgeKey: "seedling" | "bronze_star" | "silver_star" | "gold_star" | "emerald_gem" | "sapphire_crown" | "diamond_starburst";
        colorToken: "fresh_sage" | "deep_sage" | "mint_mist" | "honey" | "soft_butter" | "pebble" | "almost_black";
        perks: string;
    }[]>;
}, "strip", z.ZodTypeAny, {
    enabled: boolean;
    levels: {
        level: number;
        title: string;
        productsReq: number;
        minPoints: number;
        badgeKey: "seedling" | "bronze_star" | "silver_star" | "gold_star" | "emerald_gem" | "sapphire_crown" | "diamond_starburst";
        colorToken: "fresh_sage" | "deep_sage" | "mint_mist" | "honey" | "soft_butter" | "pebble" | "almost_black";
        perks: string;
    }[];
}, {
    levels: {
        level: number;
        title: string;
        productsReq: number;
        minPoints: number;
        badgeKey: "seedling" | "bronze_star" | "silver_star" | "gold_star" | "emerald_gem" | "sapphire_crown" | "diamond_starburst";
        colorToken: "fresh_sage" | "deep_sage" | "mint_mist" | "honey" | "soft_butter" | "pebble" | "almost_black";
        perks: string;
    }[];
    enabled?: boolean | undefined;
}>;
export type ContributorLevelsSetting = z.infer<typeof contributorLevelsSettingSchema>;
export declare const communityContributionRowSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    barcode: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    brand: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    status: z.ZodEnum<["draft", "pending", "active", "changes_required", "report_hidden", "merged_into"]>;
    coverImageUrl: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    coverPhotoId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    packagingPhotosCount: z.ZodDefault<z.ZodNumber>;
    editsCount: z.ZodDefault<z.ZodNumber>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    status: "draft" | "pending" | "active" | "changes_required" | "report_hidden" | "merged_into";
    id: string;
    name: string;
    packagingPhotosCount: number;
    editsCount: number;
    createdAt: string;
    updatedAt: string;
    barcode?: string | null | undefined;
    brand?: string | null | undefined;
    coverImageUrl?: string | null | undefined;
    coverPhotoId?: string | null | undefined;
}, {
    status: "draft" | "pending" | "active" | "changes_required" | "report_hidden" | "merged_into";
    id: string;
    name: string;
    createdAt: string;
    updatedAt: string;
    barcode?: string | null | undefined;
    brand?: string | null | undefined;
    coverImageUrl?: string | null | undefined;
    coverPhotoId?: string | null | undefined;
    packagingPhotosCount?: number | undefined;
    editsCount?: number | undefined;
}>;
export type CommunityContributionRow = z.infer<typeof communityContributionRowSchema>;
export declare const userContributionsResponseSchema: z.ZodObject<{
    enabled: z.ZodBoolean;
    levels: z.ZodArray<z.ZodObject<{
        level: z.ZodNumber;
        title: z.ZodString;
        productsReq: z.ZodNumber;
        minPoints: z.ZodNumber;
        badgeKey: z.ZodEnum<["seedling", "bronze_star", "silver_star", "gold_star", "emerald_gem", "sapphire_crown", "diamond_starburst"]>;
        colorToken: z.ZodEnum<["fresh_sage", "deep_sage", "mint_mist", "honey", "soft_butter", "pebble", "almost_black"]>;
        perks: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        level: number;
        title: string;
        productsReq: number;
        minPoints: number;
        badgeKey: "seedling" | "bronze_star" | "silver_star" | "gold_star" | "emerald_gem" | "sapphire_crown" | "diamond_starburst";
        colorToken: "fresh_sage" | "deep_sage" | "mint_mist" | "honey" | "soft_butter" | "pebble" | "almost_black";
        perks: string;
    }, {
        level: number;
        title: string;
        productsReq: number;
        minPoints: number;
        badgeKey: "seedling" | "bronze_star" | "silver_star" | "gold_star" | "emerald_gem" | "sapphire_crown" | "diamond_starburst";
        colorToken: "fresh_sage" | "deep_sage" | "mint_mist" | "honey" | "soft_butter" | "pebble" | "almost_black";
        perks: string;
    }>, "many">;
    progression: z.ZodObject<{
        currentLevel: z.ZodNumber;
        title: z.ZodString;
        badgeKey: z.ZodEnum<["seedling", "bronze_star", "silver_star", "gold_star", "emerald_gem", "sapphire_crown", "diamond_starburst"]>;
        colorToken: z.ZodEnum<["fresh_sage", "deep_sage", "mint_mist", "honey", "soft_butter", "pebble", "almost_black"]>;
        colorHex: z.ZodString;
        totalPoints: z.ZodNumber;
        activeProductsCount: z.ZodNumber;
        currentLevelMinPoints: z.ZodNumber;
        nextLevel: z.ZodNullable<z.ZodNumber>;
        nextLevelMinPoints: z.ZodNullable<z.ZodNumber>;
        pointsToNextLevel: z.ZodNumber;
        productsToNextLevel: z.ZodNumber;
        progressPercent: z.ZodNumber;
        isMaxLevel: z.ZodBoolean;
        perks: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        title: string;
        badgeKey: "seedling" | "bronze_star" | "silver_star" | "gold_star" | "emerald_gem" | "sapphire_crown" | "diamond_starburst";
        colorToken: "fresh_sage" | "deep_sage" | "mint_mist" | "honey" | "soft_butter" | "pebble" | "almost_black";
        perks: string;
        currentLevel: number;
        colorHex: string;
        totalPoints: number;
        activeProductsCount: number;
        currentLevelMinPoints: number;
        nextLevel: number | null;
        nextLevelMinPoints: number | null;
        pointsToNextLevel: number;
        productsToNextLevel: number;
        progressPercent: number;
        isMaxLevel: boolean;
    }, {
        title: string;
        badgeKey: "seedling" | "bronze_star" | "silver_star" | "gold_star" | "emerald_gem" | "sapphire_crown" | "diamond_starburst";
        colorToken: "fresh_sage" | "deep_sage" | "mint_mist" | "honey" | "soft_butter" | "pebble" | "almost_black";
        perks: string;
        currentLevel: number;
        colorHex: string;
        totalPoints: number;
        activeProductsCount: number;
        currentLevelMinPoints: number;
        nextLevel: number | null;
        nextLevelMinPoints: number | null;
        pointsToNextLevel: number;
        productsToNextLevel: number;
        progressPercent: number;
        isMaxLevel: boolean;
    }>;
    stats: z.ZodObject<{
        totalContributed: z.ZodNumber;
        activeApproved: z.ZodNumber;
        pendingReview: z.ZodNumber;
        changesRequested: z.ZodNumber;
        editsApproved: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        totalContributed: number;
        activeApproved: number;
        pendingReview: number;
        changesRequested: number;
        editsApproved: number;
    }, {
        totalContributed: number;
        activeApproved: number;
        pendingReview: number;
        changesRequested: number;
        editsApproved: number;
    }>;
    items: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        barcode: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        brand: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        status: z.ZodEnum<["draft", "pending", "active", "changes_required", "report_hidden", "merged_into"]>;
        coverImageUrl: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        coverPhotoId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        packagingPhotosCount: z.ZodDefault<z.ZodNumber>;
        editsCount: z.ZodDefault<z.ZodNumber>;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        status: "draft" | "pending" | "active" | "changes_required" | "report_hidden" | "merged_into";
        id: string;
        name: string;
        packagingPhotosCount: number;
        editsCount: number;
        createdAt: string;
        updatedAt: string;
        barcode?: string | null | undefined;
        brand?: string | null | undefined;
        coverImageUrl?: string | null | undefined;
        coverPhotoId?: string | null | undefined;
    }, {
        status: "draft" | "pending" | "active" | "changes_required" | "report_hidden" | "merged_into";
        id: string;
        name: string;
        createdAt: string;
        updatedAt: string;
        barcode?: string | null | undefined;
        brand?: string | null | undefined;
        coverImageUrl?: string | null | undefined;
        coverPhotoId?: string | null | undefined;
        packagingPhotosCount?: number | undefined;
        editsCount?: number | undefined;
    }>, "many">;
    hasMore: z.ZodDefault<z.ZodBoolean>;
    nextOffset: z.ZodDefault<z.ZodNullable<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    enabled: boolean;
    levels: {
        level: number;
        title: string;
        productsReq: number;
        minPoints: number;
        badgeKey: "seedling" | "bronze_star" | "silver_star" | "gold_star" | "emerald_gem" | "sapphire_crown" | "diamond_starburst";
        colorToken: "fresh_sage" | "deep_sage" | "mint_mist" | "honey" | "soft_butter" | "pebble" | "almost_black";
        perks: string;
    }[];
    progression: {
        title: string;
        badgeKey: "seedling" | "bronze_star" | "silver_star" | "gold_star" | "emerald_gem" | "sapphire_crown" | "diamond_starburst";
        colorToken: "fresh_sage" | "deep_sage" | "mint_mist" | "honey" | "soft_butter" | "pebble" | "almost_black";
        perks: string;
        currentLevel: number;
        colorHex: string;
        totalPoints: number;
        activeProductsCount: number;
        currentLevelMinPoints: number;
        nextLevel: number | null;
        nextLevelMinPoints: number | null;
        pointsToNextLevel: number;
        productsToNextLevel: number;
        progressPercent: number;
        isMaxLevel: boolean;
    };
    stats: {
        totalContributed: number;
        activeApproved: number;
        pendingReview: number;
        changesRequested: number;
        editsApproved: number;
    };
    items: {
        status: "draft" | "pending" | "active" | "changes_required" | "report_hidden" | "merged_into";
        id: string;
        name: string;
        packagingPhotosCount: number;
        editsCount: number;
        createdAt: string;
        updatedAt: string;
        barcode?: string | null | undefined;
        brand?: string | null | undefined;
        coverImageUrl?: string | null | undefined;
        coverPhotoId?: string | null | undefined;
    }[];
    hasMore: boolean;
    nextOffset: number | null;
}, {
    enabled: boolean;
    levels: {
        level: number;
        title: string;
        productsReq: number;
        minPoints: number;
        badgeKey: "seedling" | "bronze_star" | "silver_star" | "gold_star" | "emerald_gem" | "sapphire_crown" | "diamond_starburst";
        colorToken: "fresh_sage" | "deep_sage" | "mint_mist" | "honey" | "soft_butter" | "pebble" | "almost_black";
        perks: string;
    }[];
    progression: {
        title: string;
        badgeKey: "seedling" | "bronze_star" | "silver_star" | "gold_star" | "emerald_gem" | "sapphire_crown" | "diamond_starburst";
        colorToken: "fresh_sage" | "deep_sage" | "mint_mist" | "honey" | "soft_butter" | "pebble" | "almost_black";
        perks: string;
        currentLevel: number;
        colorHex: string;
        totalPoints: number;
        activeProductsCount: number;
        currentLevelMinPoints: number;
        nextLevel: number | null;
        nextLevelMinPoints: number | null;
        pointsToNextLevel: number;
        productsToNextLevel: number;
        progressPercent: number;
        isMaxLevel: boolean;
    };
    stats: {
        totalContributed: number;
        activeApproved: number;
        pendingReview: number;
        changesRequested: number;
        editsApproved: number;
    };
    items: {
        status: "draft" | "pending" | "active" | "changes_required" | "report_hidden" | "merged_into";
        id: string;
        name: string;
        createdAt: string;
        updatedAt: string;
        barcode?: string | null | undefined;
        brand?: string | null | undefined;
        coverImageUrl?: string | null | undefined;
        coverPhotoId?: string | null | undefined;
        packagingPhotosCount?: number | undefined;
        editsCount?: number | undefined;
    }[];
    hasMore?: boolean | undefined;
    nextOffset?: number | null | undefined;
}>;
export type UserContributionsResponse = z.infer<typeof userContributionsResponseSchema>;
//# sourceMappingURL=contributor-levels.d.ts.map