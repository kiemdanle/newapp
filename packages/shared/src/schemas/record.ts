import { z } from 'zod';

export const recordStatusSchema = z.enum(['active', 'consumed', 'discarded', 'expired']);
export type RecordStatus = z.infer<typeof recordStatusSchema>;

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'must be YYYY-MM-DD');

const locationField = z
  .string()
  .nullable()
  .optional()
  .transform((v) => {
    if (v === null || v === undefined) return null;
    const trimmed = v.trim();
    return trimmed.length > 0 ? trimmed : null;
  })
  .refine((v) => v === null || v.length <= 50, {
    message: 'location cannot exceed 50 characters',
  })
  .refine((v) => v === null || !/[\x00-\x1F\x7F\u200B-\u200D\uFEFF]/.test(v), {
    message: 'location contains invalid characters',
  });

export const recordSchema = z.object({
  id: z.string().uuid(),
  clientId: z.string().uuid(),
  userId: z.string().uuid(),
  productId: z.string().uuid().nullable(),
  householdId: z.string().uuid().nullable(),
  customName: z.string().nullable(),
  expiryDate: isoDate,
  purchaseDate: isoDate.nullable(),
  quantity: z.number().nonnegative(),
  unit: z.string().max(16),
  notes: z.string().nullable(),
  photoUrl: z.string().url().nullable(),
  status: recordStatusSchema,
  notifyAt: z.array(z.string().datetime()),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  consumedAt: z.string().datetime().nullable(),
  discardedAt: z.string().datetime().nullable().optional(),
  discardReason: z.string().trim().min(1).max(50).nullable().optional(),
  location: z.string().max(50).nullable().optional(),
  brand: z.string().max(120).nullable().optional(),
});
export type Record = z.infer<typeof recordSchema>;

export const recordCreateBaseSchema = z.object({
  clientId: z.string().uuid(),
  productId: z.string().uuid().nullable().optional(),
  customName: z.string().trim().min(1).max(200).nullable().optional(),
  expiryDate: isoDate,
  purchaseDate: isoDate.nullable().optional(),
  quantity: z.number().nonnegative().max(100_000).default(1),
  unit: z.string().trim().max(16).default('pcs'),
  notes: z.string().trim().max(2000).nullable().optional(),
  photoUrl: z.string().url().nullable().optional(),
  notificationOffsetsDays: z.array(z.number().int().min(0).max(365)).max(10).optional(),
  /** Assign the record to a household the caller belongs to; absent/null = personal. */
  householdId: z.string().uuid().nullable().optional(),
  location: locationField,
  brand: z.string().trim().min(1).max(120).nullable().optional(),
});

export const recordCreateSchema = recordCreateBaseSchema.refine(
  (v) => Boolean(v.productId) || Boolean(v.customName),
  { message: 'one of productId | customName is required' },
);
export type RecordCreate = z.infer<typeof recordCreateSchema>;

export const recordPatchSchema = z.object({
  customName: z.string().trim().min(1).max(200).nullable().optional(),
  expiryDate: isoDate.optional(),
  purchaseDate: isoDate.nullable().optional(),
  quantity: z.number().nonnegative().max(100_000).optional(),
  unit: z.string().trim().max(16).optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  photoUrl: z.string().url().nullable().optional(),
  status: recordStatusSchema.optional(),
  consumedAt: z.string().datetime().nullable().optional(),
  discardedAt: z.string().datetime().nullable().optional(),
  discardReason: z.string().trim().min(1).max(50).nullable().optional(),
  notificationOffsetsDays: z.array(z.number().int().min(0).max(365)).max(10).optional(),
  /** Move a record between personal and a household; enforced server-side. */
  householdId: z.string().uuid().nullable().optional(),
  location: locationField,
  brand: z.string().trim().min(1).max(120).nullable().optional(),
});
export type RecordPatch = z.infer<typeof recordPatchSchema>;

export const recordListResponseSchema = z.object({
  items: z.array(recordSchema),
  nextCursor: z.string().nullable(),
});
export type RecordListResponse = z.infer<typeof recordListResponseSchema>;

export const recordScopeSchema = z.enum(['personal', 'household', 'all']).default('all');
export type RecordScope = z.infer<typeof recordScopeSchema>;

export const recordListQuerySchema = z.object({
  scope: recordScopeSchema,
  /** Restrict to a single household (only meaningful with scope=household|all). */
  householdId: z.string().uuid().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type RecordListQuery = z.infer<typeof recordListQuerySchema>;

export const recordSyncConflictSchema = z.object({
  clientId: z.string().uuid(),
  // `scope_changed`: the record's household/personal scope moved on the server
  // since the client last synced. `product_unavailable`: the upsert's productId
  // can no longer be used this way (draft/pending/changes_required it isn't
  // entitled to, or a newly-private/report-hidden reference) — the item is
  // never silently dropped, it always surfaces here instead.
  reason: z.enum(['scope_changed', 'product_unavailable']),
});
export type RecordSyncConflict = z.infer<typeof recordSyncConflictSchema>;

export const recordSyncBatchSchema = z.object({
  since: z.string().datetime().nullable().optional(),
  upserts: z
    .array(
      recordCreateBaseSchema.extend({
        id: z.string().uuid().optional(),
        status: recordStatusSchema.optional(),
        updatedAt: z.string().datetime(),
        consumedAt: z.string().datetime().nullable().optional(),
        discardedAt: z.string().datetime().nullable().optional(),
        discardReason: z.string().trim().min(1).max(50).nullable().optional(),
      })
    )
    .max(500),
  deletes: z.array(z.string().uuid()).max(500),
});
export type RecordSyncBatch = z.infer<typeof recordSyncBatchSchema>;

export const recordSyncResponseSchema = z.object({
  serverTime: z.string().datetime(),
  changes: z.array(recordSchema),
  deletedIds: z.array(z.string().uuid()),
  conflicts: z.array(recordSyncConflictSchema).default([]),
  householdIds: z.array(z.string().uuid()).default([]),
});
export type RecordSyncResponse = z.infer<typeof recordSyncResponseSchema>;

const deviceTokenSchema = z
  .string()
  .trim()
  .min(20, 'invalid device token')
  .max(4096, 'invalid device token')
  .regex(/^\S+$/, 'invalid device token');

export const pushTokenRegisterSchema = z.object({
  deviceToken: deviceTokenSchema,
  platform: z.enum(['ios', 'android']),
  deviceInfo: z.record(z.unknown()).optional(),
});
export type PushTokenRegister = z.infer<typeof pushTokenRegisterSchema>;

export const pushTokenSchema = z.object({
  id: z.string().uuid(),
  deviceToken: z.string(),
  platform: z.enum(['ios', 'android']),
  createdAt: z.string().datetime(),
  lastUsedAt: z.string().datetime().nullable(),
});
export type PushToken = z.infer<typeof pushTokenSchema>;

export const recordBulkScopeSchema = z.object({
  recordIds: z.array(z.string().uuid()).min(1).max(100),
  targetHouseholdId: z.string().uuid().nullable(),
});
export type RecordBulkScope = z.infer<typeof recordBulkScopeSchema>;

export const recordBulkScopeResponseSchema = z.object({
  updatedCount: z.number().int().min(0),
  recordIds: z.array(z.string().uuid()),
});
export type RecordBulkScopeResponse = z.infer<typeof recordBulkScopeResponseSchema>;
