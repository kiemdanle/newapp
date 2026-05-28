import { z } from 'zod';

// Per D15 — 3 values only. Profanity auto-flag sets status='hidden' directly.
export const reviewStatusSchema = z.enum(['visible', 'hidden', 'deleted']);
export type ReviewStatus = z.infer<typeof reviewStatusSchema>;

export const reviewSortSchema = z.enum(['score', 'new', 'rating']).default('score');
export type ReviewSort = z.infer<typeof reviewSortSchema>;

const ratingField = z.number().int().min(1).max(5);
const bodyField = z.string().trim().max(2000).optional();

export const reviewSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  productId: z.string().uuid(),
  tasteRating: ratingField,
  valueRating: ratingField,
  body: z.string().nullable(),
  upvoteCount: z.number().int().nonnegative(),
  downvoteCount: z.number().int().nonnegative(),
  score: z.number().min(0).max(1),
  status: reviewStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  /** Present on lists when the caller is authenticated; null if no vote. */
  myVote: z.union([z.literal(-1), z.literal(1)]).nullable().optional(),
  /** Light author projection — first name + avatar only, never email. */
  author: z
    .object({
      id: z.string().uuid(),
      firstName: z.string(),
      avatarUrl: z.string().url().nullable(),
    })
    .optional(),
});
export type Review = z.infer<typeof reviewSchema>;

export const reviewCreateSchema = z.object({
  tasteRating: ratingField,
  valueRating: ratingField,
  body: bodyField,
});
export type ReviewCreate = z.infer<typeof reviewCreateSchema>;

export const reviewPatchSchema = z
  .object({
    tasteRating: ratingField.optional(),
    valueRating: ratingField.optional(),
    body: bodyField,
  })
  .refine(
    (v) => v.tasteRating !== undefined || v.valueRating !== undefined || v.body !== undefined,
    { message: 'at least one field required' },
  );
export type ReviewPatch = z.infer<typeof reviewPatchSchema>;

export const reviewVoteSchema = z.object({
  value: z.union([z.literal(-1), z.literal(1)]),
});
export type ReviewVote = z.infer<typeof reviewVoteSchema>;

/** Alias kept for symmetry with the file-ownership map (vote.ts split). */
export const voteSchema = reviewVoteSchema;
export type Vote = ReviewVote;

export const reviewListQuerySchema = z.object({
  sort: reviewSortSchema,
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type ReviewListQuery = z.infer<typeof reviewListQuerySchema>;
