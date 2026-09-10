import { z } from 'zod';
export const expyricoBadgeColorTokenSchema = z.enum([
    'fresh_sage',
    'deep_sage',
    'mint_mist',
    'honey',
    'soft_butter',
    'pebble',
    'almost_black',
]);
export const EXPYRICO_BADGE_COLORS = {
    fresh_sage: '#4BAE8A',
    deep_sage: '#3A8F6F',
    mint_mist: '#D6F0E6',
    honey: '#F5A623',
    soft_butter: '#FEEFC3',
    pebble: '#8C8C85',
    almost_black: '#2C2C28',
};
export const contributorBadgeKeySchema = z.enum([
    'seedling',
    'bronze_star',
    'silver_star',
    'gold_star',
    'emerald_gem',
    'sapphire_crown',
    'diamond_starburst',
]);
export const contributorLevelTierSchema = z.object({
    level: z.number().int().min(1).max(10),
    title: z.string().min(1).max(60),
    productsReq: z.number().int().min(0),
    minPoints: z.number().int().min(0),
    badgeKey: contributorBadgeKeySchema,
    colorToken: expyricoBadgeColorTokenSchema,
    perks: z.string().min(1).max(200),
});
export const FALLBACK_CONTRIBUTOR_TIER = {
    level: 1,
    title: 'Novice Scout',
    productsReq: 1,
    minPoints: 10,
    badgeKey: 'seedling',
    colorToken: 'fresh_sage',
    perks: 'Profile Contributor badge & Community catalog recognition',
};
export const DEFAULT_CONTRIBUTOR_LEVELS = [
    FALLBACK_CONTRIBUTOR_TIER,
    {
        level: 2,
        title: 'Junior Contributor',
        productsReq: 3,
        minPoints: 30,
        badgeKey: 'bronze_star',
        colorToken: 'honey',
        perks: 'Bronze Contributor star & Faster product verification queue',
    },
    {
        level: 3,
        title: 'Active Contributor',
        productsReq: 7,
        minPoints: 70,
        badgeKey: 'bronze_star',
        colorToken: 'honey',
        perks: 'Community impact highlight in weekly digest',
    },
    {
        level: 4,
        title: 'Pantry Scout',
        productsReq: 15,
        minPoints: 150,
        badgeKey: 'silver_star',
        colorToken: 'pebble',
        perks: 'Silver Contributor star & Access to contributor discord channel',
    },
    {
        level: 5,
        title: 'Catalog Explorer',
        productsReq: 30,
        minPoints: 300,
        badgeKey: 'silver_star',
        colorToken: 'pebble',
        perks: 'Direct feedback channel with catalog moderation team',
    },
    {
        level: 6,
        title: 'Senior Contributor',
        productsReq: 60,
        minPoints: 600,
        badgeKey: 'gold_star',
        colorToken: 'honey',
        perks: 'Gold Contributor star & Early access to barcode scan features',
    },
    {
        level: 7,
        title: 'Catalog Pioneer',
        productsReq: 120,
        minPoints: 1200,
        badgeKey: 'gold_star',
        colorToken: 'fresh_sage',
        perks: 'Featured Pioneer spot on regional leaderboard',
    },
    {
        level: 8,
        title: 'Master Contributor',
        productsReq: 250,
        minPoints: 2500,
        badgeKey: 'emerald_gem',
        colorToken: 'deep_sage',
        perks: 'Emerald Contributor gem & Priority community product reviews',
    },
    {
        level: 9,
        title: 'Catalog Legend',
        productsReq: 500,
        minPoints: 5000,
        badgeKey: 'sapphire_crown',
        colorToken: 'almost_black',
        perks: 'Sapphire Contributor crown & Annual Expyrico community gift box',
    },
    {
        level: 10,
        title: 'Expyrico Champion',
        productsReq: 1000,
        minPoints: 10000,
        badgeKey: 'diamond_starburst',
        colorToken: 'deep_sage',
        perks: 'Hall of Fame recognition & Lifetime VIP community champion status',
    },
];
export const contributorProgressionSchema = z.object({
    currentLevel: z.number().int().min(0).max(10),
    title: z.string(),
    badgeKey: contributorBadgeKeySchema,
    colorToken: expyricoBadgeColorTokenSchema,
    colorHex: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
    totalPoints: z.number().int().min(0),
    activeProductsCount: z.number().int().min(0),
    currentLevelMinPoints: z.number().int().min(0),
    nextLevel: z.number().int().min(1).max(10).nullable(),
    nextLevelMinPoints: z.number().int().min(0).nullable(),
    pointsToNextLevel: z.number().int().min(0),
    productsToNextLevel: z.number().int().min(0),
    progressPercent: z.number().int().min(0).max(100),
    isMaxLevel: z.boolean(),
    perks: z.string(),
});
export function calculateContributorPoints(stats) {
    if (typeof stats.explicitPoints === 'number') {
        return Math.max(0, stats.explicitPoints);
    }
    const products = Math.max(0, stats.activeProductsCount);
    const approvedBonus = Math.max(0, stats.approvedProductsBonusCount ?? 0);
    const photos = Math.max(0, stats.photosCount ?? 0);
    const edits = Math.max(0, stats.approvedEditsCount ?? 0);
    return products * 10 + approvedBonus * 10 + photos * 5 + edits * 5;
}
export function computeContributorProgression(stats, customLevels) {
    const levels = customLevels && customLevels.length === 10 ? customLevels : DEFAULT_CONTRIBUTOR_LEVELS;
    const totalPoints = calculateContributorPoints(stats);
    const activeProducts = Math.max(0, stats.activeProductsCount);
    const firstTier = levels[0] ?? FALLBACK_CONTRIBUTOR_TIER;
    // Find highest tier where BOTH points and products requirements are fulfilled
    let currentTierIndex = -1;
    for (let i = 0; i < levels.length; i++) {
        const tier = levels[i];
        if (tier && totalPoints >= tier.minPoints && activeProducts >= tier.productsReq) {
            currentTierIndex = i;
        }
        else {
            break;
        }
    }
    // If even Tier 1 is not unlocked: Level 0 (Unranked)
    if (currentTierIndex === -1) {
        const nextTier = firstTier;
        const pointProgress = nextTier.minPoints > 0 ? Math.min(1, Math.max(0, totalPoints / nextTier.minPoints)) : 1;
        const prodProgress = nextTier.productsReq > 0 ? Math.min(1, Math.max(0, activeProducts / nextTier.productsReq)) : 1;
        const pointsToNext = Math.max(0, nextTier.minPoints - totalPoints);
        const productsToNext = Math.max(0, nextTier.productsReq - activeProducts);
        const progressPercent = Math.min(100, Math.max(0, Math.round(((pointProgress + prodProgress) / 2) * 100)));
        return {
            currentLevel: 0,
            title: 'New Explorer',
            badgeKey: 'seedling',
            colorToken: 'fresh_sage',
            colorHex: EXPYRICO_BADGE_COLORS.fresh_sage,
            totalPoints,
            activeProductsCount: activeProducts,
            currentLevelMinPoints: 0,
            nextLevel: nextTier.level,
            nextLevelMinPoints: nextTier.minPoints,
            pointsToNextLevel: pointsToNext,
            productsToNextLevel: productsToNext,
            progressPercent,
            isMaxLevel: false,
            perks: 'Add your first product to reach Level 1 Novice Scout',
        };
    }
    const currentTier = levels[currentTierIndex] ?? FALLBACK_CONTRIBUTOR_TIER;
    const isMaxLevel = currentTierIndex === levels.length - 1;
    if (isMaxLevel) {
        return {
            currentLevel: currentTier.level,
            title: currentTier.title,
            badgeKey: currentTier.badgeKey,
            colorToken: currentTier.colorToken,
            colorHex: EXPYRICO_BADGE_COLORS[currentTier.colorToken],
            totalPoints,
            activeProductsCount: activeProducts,
            currentLevelMinPoints: currentTier.minPoints,
            nextLevel: null,
            nextLevelMinPoints: null,
            pointsToNextLevel: 0,
            productsToNextLevel: 0,
            progressPercent: 100,
            isMaxLevel: true,
            perks: currentTier.perks,
        };
    }
    const nextTier = levels[currentTierIndex + 1] ?? currentTier;
    const pointsToNext = Math.max(0, nextTier.minPoints - totalPoints);
    const productsToNext = Math.max(0, nextTier.productsReq - activeProducts);
    const tierPointSpan = Math.max(1, nextTier.minPoints - currentTier.minPoints);
    const pointsInCurrentTier = Math.max(0, totalPoints - currentTier.minPoints);
    const pointProgress = Math.min(1, Math.max(0, pointsInCurrentTier / tierPointSpan));
    const tierProdSpan = Math.max(1, nextTier.productsReq - currentTier.productsReq);
    const prodsInCurrentTier = Math.max(0, activeProducts - currentTier.productsReq);
    const prodProgress = Math.min(1, Math.max(0, prodsInCurrentTier / tierProdSpan));
    const progressPercent = Math.min(100, Math.max(0, Math.round(((pointProgress + prodProgress) / 2) * 100)));
    return {
        currentLevel: currentTier.level,
        title: currentTier.title,
        badgeKey: currentTier.badgeKey,
        colorToken: currentTier.colorToken,
        colorHex: EXPYRICO_BADGE_COLORS[currentTier.colorToken],
        totalPoints,
        activeProductsCount: activeProducts,
        currentLevelMinPoints: currentTier.minPoints,
        nextLevel: nextTier.level,
        nextLevelMinPoints: nextTier.minPoints,
        pointsToNextLevel: pointsToNext,
        productsToNextLevel: productsToNext,
        progressPercent,
        isMaxLevel: false,
        perks: currentTier.perks,
    };
}
//# sourceMappingURL=contributor-levels.js.map