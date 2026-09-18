import { z } from 'zod';
export declare const expyricoBadgeColorTokenSchema: z.ZodEnum<["fresh_sage", "deep_sage", "mint_mist", "honey", "soft_butter", "pebble", "almost_black"]>;
export type ExpyricoBadgeColorToken = z.infer<typeof expyricoBadgeColorTokenSchema>;
export declare const EXPYRICO_BADGE_COLORS: Record<ExpyricoBadgeColorToken, string>;
export declare const contributorBadgeKeySchema: z.ZodEnum<["seedling", "bronze_star", "silver_star", "gold_star", "emerald_gem", "sapphire_crown", "diamond_starburst"]>;
export type ContributorBadgeKey = z.infer<typeof contributorBadgeKeySchema>;
export declare const contributorLevelTierSchema: z.ZodObject<{
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
}>;
export type ContributorLevelTier = z.infer<typeof contributorLevelTierSchema>;
export declare const FALLBACK_CONTRIBUTOR_TIER: ContributorLevelTier;
export declare const DEFAULT_CONTRIBUTOR_LEVELS: readonly ContributorLevelTier[];
export declare const contributorProgressionSchema: z.ZodObject<{
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
export type ContributorProgression = z.infer<typeof contributorProgressionSchema>;
export interface ContributorStatsInput {
    activeProductsCount: number;
    approvedProductsBonusCount?: number;
    photosCount?: number;
    approvedEditsCount?: number;
    explicitPoints?: number;
}
export declare function calculateContributorPoints(stats: ContributorStatsInput): number;
export declare function computeContributorProgression(stats: ContributorStatsInput, customLevels?: readonly ContributorLevelTier[]): ContributorProgression;
//# sourceMappingURL=contributor-levels.d.ts.map