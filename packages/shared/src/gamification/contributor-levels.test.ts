import { describe, expect, it } from 'vitest';
import {
  calculateContributorPoints,
  computeContributorProgression,
  DEFAULT_CONTRIBUTOR_LEVELS,
  EXPYRICO_BADGE_COLORS,
  expyricoBadgeColorTokenSchema,
} from './contributor-levels.js';
import { contributorLevelsSettingSchema } from '../schemas/admin/contributor-levels.js';

describe('Contributor Levels Gamification', () => {
  it('DEFAULT_CONTRIBUTOR_LEVELS contains 10 valid tiers with strictly ascending thresholds', () => {
    expect(DEFAULT_CONTRIBUTOR_LEVELS).toHaveLength(10);

    for (let i = 0; i < DEFAULT_CONTRIBUTOR_LEVELS.length; i++) {
      const tier = DEFAULT_CONTRIBUTOR_LEVELS[i]!;
      expect(tier.level).toBe(i + 1);
      expect(tier.title.length).toBeGreaterThan(0);
      expect(expyricoBadgeColorTokenSchema.safeParse(tier.colorToken).success).toBe(true);
      expect(EXPYRICO_BADGE_COLORS[tier.colorToken]).toMatch(/^#[0-9A-Fa-f]{6}$/);

      if (i > 0) {
        const prev = DEFAULT_CONTRIBUTOR_LEVELS[i - 1]!;
        expect(tier.minPoints).toBeGreaterThan(prev.minPoints);
        expect(tier.productsReq).toBeGreaterThanOrEqual(prev.productsReq);
      }
    }
  });

  it('validates default settings against contributorLevelsSettingSchema', () => {
    const result = contributorLevelsSettingSchema.safeParse({
      enabled: true,
      levels: DEFAULT_CONTRIBUTOR_LEVELS,
    });
    expect(result.success).toBe(true);
  });

  it('rejects settings with non-monotonic minPoints', () => {
    const brokenLevels = JSON.parse(JSON.stringify(DEFAULT_CONTRIBUTOR_LEVELS));
    brokenLevels[2].minPoints = brokenLevels[1].minPoints; // Level 3 points == Level 2 points

    const result = contributorLevelsSettingSchema.safeParse({
      enabled: true,
      levels: brokenLevels,
    });
    expect(result.success).toBe(false);
  });

  it('rejects settings with invalid color token', () => {
    const brokenLevels = JSON.parse(JSON.stringify(DEFAULT_CONTRIBUTOR_LEVELS));
    brokenLevels[0].colorToken = 'neon_pink'; // Not in Expyrico palette

    const result = contributorLevelsSettingSchema.safeParse({
      enabled: true,
      levels: brokenLevels,
    });
    expect(result.success).toBe(false);
  });

  it('rejects settings with incorrect tier count', () => {
    const brokenLevels = DEFAULT_CONTRIBUTOR_LEVELS.slice(0, 9); // Only 9 tiers

    const result = contributorLevelsSettingSchema.safeParse({
      enabled: true,
      levels: brokenLevels,
    });
    expect(result.success).toBe(false);
  });

  describe('calculateContributorPoints', () => {
    it('calculates weighted points accurately', () => {
      const points = calculateContributorPoints({
        activeProductsCount: 2, // 2 * 10 = 20
        approvedProductsBonusCount: 2, // 2 * 10 = 20
        photosCount: 3, // 3 * 5 = 15
        approvedEditsCount: 1, // 1 * 5 = 5
      });
      expect(points).toBe(60);
    });

    it('respects explicitPoints override', () => {
      const points = calculateContributorPoints({
        activeProductsCount: 100,
        explicitPoints: 42,
      });
      expect(points).toBe(42);
    });
  });

  describe('computeContributorProgression', () => {
    it('returns Level 0 (Unranked) for a brand new user with 0 points', () => {
      const progress = computeContributorProgression({ activeProductsCount: 0 });

      expect(progress.currentLevel).toBe(0);
      expect(progress.title).toBe('New Explorer');
      expect(progress.badgeKey).toBe('seedling');
      expect(progress.colorToken).toBe('fresh_sage');
      expect(progress.colorHex).toBe('#4BAE8A');
      expect(progress.totalPoints).toBe(0);
      expect(progress.nextLevel).toBe(1);
      expect(progress.nextLevelMinPoints).toBe(10);
      expect(progress.pointsToNextLevel).toBe(10);
      expect(progress.productsToNextLevel).toBe(1);
      expect(progress.progressPercent).toBe(0);
      expect(progress.isMaxLevel).toBe(false);
    });

    it('returns Level 0 (Unranked) when points meet threshold but productsReq is not met', () => {
      // Level 1 requires 10 pts AND 1 product.
      // User has 10 points from 2 photos, but 0 products.
      const progress = computeContributorProgression({
        activeProductsCount: 0,
        photosCount: 2, // 10 points
      });

      expect(progress.currentLevel).toBe(0);
      expect(progress.title).toBe('New Explorer');
      expect(progress.totalPoints).toBe(10);
      expect(progress.activeProductsCount).toBe(0);
      expect(progress.productsToNextLevel).toBe(1);
      expect(progress.nextLevel).toBe(1);
    });

    it('computes Level 1 boundary at 10 points and 1 product', () => {
      const progress = computeContributorProgression({
        activeProductsCount: 1, // 10 points
      });

      expect(progress.currentLevel).toBe(1);
      expect(progress.title).toBe('Novice Scout');
      expect(progress.badgeKey).toBe('seedling');
      expect(progress.colorToken).toBe('fresh_sage');
      expect(progress.totalPoints).toBe(10);
      expect(progress.activeProductsCount).toBe(1);
      expect(progress.nextLevel).toBe(2);
      expect(progress.nextLevelMinPoints).toBe(30);
      expect(progress.pointsToNextLevel).toBe(20);
      expect(progress.productsToNextLevel).toBe(2); // 3 req - 1 active = 2
      expect(progress.progressPercent).toBe(0); // 0% towards Lv 2
    });

    it('constrains Level 2 promotion when productsReq (3 prods) is not met', () => {
      // User has 40 points (> 30 pts for Lv 2), but only 2 products (< 3 prods req for Lv 2)
      const progress = computeContributorProgression({
        activeProductsCount: 2, // 20 pts
        photosCount: 4, // 20 pts -> total 40 pts
      });

      // Must remain at Level 1 because productsReq=3 is not met
      expect(progress.currentLevel).toBe(1);
      expect(progress.title).toBe('Novice Scout');
      expect(progress.productsToNextLevel).toBe(1); // 3 req - 2 active = 1
      expect(progress.nextLevel).toBe(2);
    });

    it('computes Level 1 boundary at exactly 10 points', () => {
      const progress = computeContributorProgression({
        activeProductsCount: 1, // 10 points
      });

      expect(progress.currentLevel).toBe(1);
      expect(progress.title).toBe('Novice Scout');
      expect(progress.badgeKey).toBe('seedling');
      expect(progress.colorToken).toBe('fresh_sage');
      expect(progress.totalPoints).toBe(10);
      expect(progress.nextLevel).toBe(2);
      expect(progress.nextLevelMinPoints).toBe(30);
      expect(progress.pointsToNextLevel).toBe(20);
      expect(progress.productsToNextLevel).toBe(2); // 3 req - 1 active = 2
      expect(progress.progressPercent).toBe(0); // 0% towards Lv 2
    });

    it('computes intermediate progress within Level 1', () => {
      // At 20 points (between Lv 1 at 10 and Lv 2 at 30, span is 20)
      const progress = computeContributorProgression({
        activeProductsCount: 2, // 1 product beyond Lv 1 req (span is 3-1=2, so 50% prods)
        explicitPoints: 20, // 10 pts beyond Lv 1 req (span is 30-10=20, so 50% pts)
      });

      expect(progress.currentLevel).toBe(1);
      expect(progress.totalPoints).toBe(20);
      expect(progress.pointsToNextLevel).toBe(10);
      expect(progress.progressPercent).toBe(50); // (20 - 10) / (30 - 10) = 50%
    });

    it('computes Level 4 (Pantry Scout) at 180 points', () => {
      // Lv 4 is 150 points, Lv 5 is 300 points (span = 150)
      // At 180 points, progress = (180 - 150) / 150 = 30 / 150 = 20%
      const progress = computeContributorProgression({
        activeProductsCount: 18, // 3 prods beyond Lv 4 req (span is 30-15=15, so 20% prods)
        explicitPoints: 180, // 30 pts beyond Lv 4 req (span is 300-150=150, so 20% pts)
      });

      expect(progress.currentLevel).toBe(4);
      expect(progress.title).toBe('Pantry Scout');
      expect(progress.badgeKey).toBe('silver_star');
      expect(progress.colorToken).toBe('pebble');
      expect(progress.nextLevel).toBe(5);
      expect(progress.pointsToNextLevel).toBe(120);
      expect(progress.productsToNextLevel).toBe(12); // 30 req - 18 active = 12
      expect(progress.progressPercent).toBe(20);
      expect(progress.isMaxLevel).toBe(false);
    });

    it('computes Level 10 (Expyrico Champion) max level', () => {
      const progress = computeContributorProgression({
        activeProductsCount: 1000,
        explicitPoints: 10000,
      });

      expect(progress.currentLevel).toBe(10);
      expect(progress.title).toBe('Expyrico Champion');
      expect(progress.badgeKey).toBe('diamond_starburst');
      expect(progress.colorToken).toBe('deep_sage');
      expect(progress.nextLevel).toBeNull();
      expect(progress.nextLevelMinPoints).toBeNull();
      expect(progress.pointsToNextLevel).toBe(0);
      expect(progress.productsToNextLevel).toBe(0);
      expect(progress.progressPercent).toBe(100);
      expect(progress.isMaxLevel).toBe(true);
    });

    it('computes Level 10 cleanly for points exceeding 10000', () => {
      const progress = computeContributorProgression({
        activeProductsCount: 1500,
        explicitPoints: 25000,
      });

      expect(progress.currentLevel).toBe(10);
      expect(progress.isMaxLevel).toBe(true);
      expect(progress.progressPercent).toBe(100);
      expect(progress.nextLevel).toBeNull();
    });
  });
});
