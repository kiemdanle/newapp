import { z } from 'zod';
import {
  contributorBadgeKeySchema,
  contributorLevelTierSchema,
  contributorProgressionSchema,
  expyricoBadgeColorTokenSchema,
} from '../../gamification/contributor-levels.js';

export const contributorLevelsSettingSchema = z.object({
  enabled: z.boolean().default(true),
  levels: z
    .array(contributorLevelTierSchema)
    .length(10, 'Contributor levels configuration must contain exactly 10 tiers')
    .superRefine((levels, ctx) => {
      // 1. Verify level numbers 1..10 in sequence
      for (let i = 0; i < levels.length; i++) {
        const current = levels[i];
        if (!current || current.level !== i + 1) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Tier at index ${i} must have level number ${i + 1}, found ${current?.level}`,
            path: [i, 'level'],
          });
        }
      }

      // 2. Verify strictly ascending points and non-descending products
      for (let i = 1; i < levels.length; i++) {
        const prev = levels[i - 1];
        const curr = levels[i];
        if (prev && curr) {
          if (curr.minPoints <= prev.minPoints) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `Level ${curr.level} minPoints (${curr.minPoints}) must be strictly greater than Level ${prev.level} minPoints (${prev.minPoints})`,
              path: [i, 'minPoints'],
            });
          }
          if (curr.productsReq < prev.productsReq) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `Level ${curr.level} productsReq (${curr.productsReq}) cannot be less than Level ${prev.level} productsReq (${prev.productsReq})`,
              path: [i, 'productsReq'],
            });
          }
        }
      }
    }),
});
export type ContributorLevelsSetting = z.infer<typeof contributorLevelsSettingSchema>;

export const communityContributionRowSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  barcode: z.string().nullable().optional(),
  brand: z.string().nullable().optional(),
  status: z.enum([
    'draft',
    'pending',
    'active',
    'changes_required',
    'report_hidden',
    'merged_into',
  ]),
  coverImageUrl: z.string().nullable().optional(),
  coverPhotoId: z.string().uuid().nullable().optional(),
  packagingPhotosCount: z.number().int().default(0),
  editsCount: z.number().int().default(0),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type CommunityContributionRow = z.infer<typeof communityContributionRowSchema>;

export const userContributionsResponseSchema = z.object({
  enabled: z.boolean(),
  levels: z.array(contributorLevelTierSchema),
  progression: contributorProgressionSchema,
  stats: z.object({
    totalContributed: z.number().int(),
    activeApproved: z.number().int(),
    pendingReview: z.number().int(),
    changesRequested: z.number().int(),
    editsApproved: z.number().int(),
  }),
  items: z.array(communityContributionRowSchema),
  hasMore: z.boolean().default(false),
  nextOffset: z.number().int().nullable().default(null),
});
export type UserContributionsResponse = z.infer<typeof userContributionsResponseSchema>;
