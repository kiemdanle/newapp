import { z } from 'zod';

export const recordStatusSchema = z.enum(['active', 'consumed', 'discarded', 'expired']);
export type RecordStatus = z.infer<typeof recordStatusSchema>;

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'must be YYYY-MM-DD');

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
  notificationOffsetsDays: z.array(z.number().int().min(0).max(365)).max(10).optional(),
});
export type RecordPatch = z.infer<typeof recordPatchSchema>;

export const recordListResponseSchema = z.object({
  items: z.array(recordSchema),
  nextCursor: z.string().nullable(),
});
export type RecordListResponse = z.infer<typeof recordListResponseSchema>;

export const recordSyncBatchSchema = z.object({
  since: z.string().datetime().nullable().optional(),
  upserts: z
    .array(
      recordCreateBaseSchema.extend({
        id: z.string().uuid().optional(),
        status: recordStatusSchema.optional(),
        updatedAt: z.string().datetime(),
      }),
    )
    .max(500),
  deletes: z.array(z.string().uuid()).max(500),
});
export type RecordSyncBatch = z.infer<typeof recordSyncBatchSchema>;

export const recordSyncResponseSchema = z.object({
  serverTime: z.string().datetime(),
  changes: z.array(recordSchema),
  deletedIds: z.array(z.string().uuid()),
});
export type RecordSyncResponse = z.infer<typeof recordSyncResponseSchema>;

export const pushTokenRegisterSchema = z.object({
  expoPushToken: z.string().regex(/^Expo(nent)?PushToken\[.+\]$/, 'invalid Expo push token'),
  platform: z.enum(['ios', 'android']),
  deviceInfo: z.record(z.unknown()).optional(),
});
export type PushTokenRegister = z.infer<typeof pushTokenRegisterSchema>;

export const pushTokenSchema = z.object({
  id: z.string().uuid(),
  expoPushToken: z.string(),
  platform: z.enum(['ios', 'android']),
  createdAt: z.string().datetime(),
  lastUsedAt: z.string().datetime().nullable(),
});
export type PushToken = z.infer<typeof pushTokenSchema>;
