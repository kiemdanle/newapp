import { z } from 'zod';

export const analyticsRangeSchema = z.enum(['7d', '30d', '90d']);

export const analyticsOverviewSchema = z.object({
  totalUsers: z.number().int(),
  activeUsers7d: z.number().int(),
  activeUsers30d: z.number().int(),
  totalRecords: z.number().int(),
  totalReviews: z.number().int(),
  scans7d: z.number().int(),
});

export const analyticsDailyPointSchema = z.object({
  date: z.string(),
  count: z.number().int(),
});

export const analyticsScansSchema = z.object({
  range: analyticsRangeSchema,
  daily: z.array(analyticsDailyPointSchema),
  bySource: z.object({
    off: z.number().int(),
    upcitemdb: z.number().int(),
    manual: z.number().int(),
  }),
});

export const analyticsReviewsSchema = z.object({
  range: analyticsRangeSchema,
  daily: z.array(analyticsDailyPointSchema),
  autoFlaggedRate: z.number(),
  buyAgainPct: z.number().min(0).max(100),
  buyAgainOnSalePct: z.number().min(0).max(100),
  wontBuyPct: z.number().min(0).max(100),
  ratingCount: z.number().int().nonnegative(),
});

export const analyticsGeographySchema = z.object({
  top: z.array(z.object({ country: z.string().length(2), users: z.number().int() })),
});
