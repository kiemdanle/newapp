import { z } from 'zod';
import { recordStatusSchema } from '../record.js';

export const adminPantryStatusQuerySchema = z
  .enum(['all', 'active', 'consumed', 'discarded', 'expired'])
  .default('all');

export const adminPantrySortBySchema = z
  .enum(['createdAt', 'expiryDate', 'updatedAt', 'quantity', 'name'])
  .default('expiryDate');

export const adminPantrySortOrderSchema = z
  .enum(['asc', 'desc'])
  .default('asc');

export const adminPantryProductTypeSchema = z
  .enum(['all', 'catalog', 'custom'])
  .default('all');

export const adminPantryItemsQuerySchema = z.object({
  q: z.string().trim().optional(),
  location: z.string().trim().optional(),
  category: z.string().trim().optional(),
  brand: z.string().trim().optional(),
  productId: z.string().uuid().optional(),
  productType: adminPantryProductTypeSchema.optional().default('all'),
  userId: z.string().uuid().optional(),
  status: adminPantryStatusQuerySchema.optional().default('all'),
  sortBy: adminPantrySortBySchema.optional().default('expiryDate'),
  sortOrder: adminPantrySortOrderSchema.optional().default('asc'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export type AdminPantryItemsQuery = z.infer<typeof adminPantryItemsQuerySchema>;

export const adminPantryItemRowSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  userName: z.string(),
  userEmail: z.string(),
  productId: z.string().uuid().nullable(),
  productName: z.string().nullable(),
  productBarcode: z.string().nullable(),
  customName: z.string().nullable(),
  displayName: z.string(),
  brand: z.string().nullable(),
  category: z.string().nullable(),
  expiryDate: z.string(),
  purchaseDate: z.string().nullable(),
  quantity: z.number(),
  unit: z.string(),
  price: z.number().nullable(),
  store: z.string().nullable(),
  location: z.string().nullable(),
  status: recordStatusSchema,
  photoUrl: z.string().nullable(),
  photoCount: z.number().int().nonnegative(),
  householdId: z.string().uuid().nullable(),
  householdName: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type AdminPantryItemRow = z.infer<typeof adminPantryItemRowSchema>;

export const adminPantryItemsListSchema = z.object({
  items: z.array(adminPantryItemRowSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
  totalPages: z.number().int().nonnegative(),
});

export type AdminPantryItemsList = z.infer<typeof adminPantryItemsListSchema>;

export const adminPantryItemDetailSchema = adminPantryItemRowSchema.extend({
  notes: z.string().nullable(),
  photoUrls: z.array(z.string()),
  notifyAt: z.array(z.string().datetime()),
  consumedAt: z.string().datetime().nullable(),
  discardedAt: z.string().datetime().nullable(),
  discardReason: z.string().nullable(),
  user: z.object({
    id: z.string().uuid(),
    email: z.string(),
    firstName: z.string().nullable(),
    lastName: z.string().nullable(),
    country: z.string().nullable(),
    status: z.string().optional(),
  }),
  product: z
    .object({
      id: z.string().uuid(),
      name: z.string(),
      brand: z.string().nullable(),
      category: z.string().nullable(),
      barcode: z.string().nullable(),
      imageUrl: z.string().nullable(),
      status: z.string().optional(),
      version: z.number().optional(),
    })
    .nullable(),
  household: z
    .object({
      id: z.string().uuid(),
      name: z.string(),
      memberCount: z.number().int().optional(),
    })
    .nullable(),
  pushLogsCount: z.number().int().nonnegative().default(0),
  giveawaysCount: z.number().int().nonnegative().default(0),
});

export type AdminPantryItemDetail = z.infer<typeof adminPantryItemDetailSchema>;

export const adminPantryItemPatchSchema = z.object({
  customName: z.string().trim().max(120).nullable().optional(),
  brand: z.string().trim().max(120).nullable().optional(),
  category: z.string().trim().max(60).nullable().optional(),
  location: z.string().trim().max(50).nullable().optional(),
  quantity: z.number().nonnegative().max(100_000).optional(),
  unit: z.string().trim().max(16).optional(),
  expiryDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'must be YYYY-MM-DD')
    .optional(),
  purchaseDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'must be YYYY-MM-DD')
    .nullable()
    .optional(),
  price: z.number().nonnegative().nullable().optional(),
  store: z.string().trim().max(120).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  status: recordStatusSchema.optional(),
  discardReason: z.string().trim().max(50).nullable().optional(),
});

export type AdminPantryItemPatch = z.infer<typeof adminPantryItemPatchSchema>;

export const adminPantryFilterOptionsSchema = z.object({
  locations: z.array(z.string()),
  categories: z.array(z.string()),
  brands: z.array(z.string()),
});

export type AdminPantryFilterOptions = z.infer<typeof adminPantryFilterOptionsSchema>;
