import { z } from 'zod';
export const dealStatusSchema = z.enum(['visible', 'hidden', 'deleted']);
export const dealSortSchema = z.enum(['score', 'new']).default('score');
const priceField = z.number().nonnegative().max(1_000_000);
const currencyField = z.string().length(3).regex(/^[A-Z]{3}$/);
const storeNameField = z.string().trim().min(1).max(120);
const noteField = z.string().trim().max(1000).optional();
const expiryField = z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'expiryDate must be yyyy-mm-dd')
    .optional();
export const DEAL_PHOTO_CDN_HOST = 'cdn.expyrico.app';
const photoUrlField = z
    .string()
    .url()
    .refine((u) => {
    try {
        return new URL(u).host === DEAL_PHOTO_CDN_HOST;
    }
    catch {
        return false;
    }
}, 'photoUrl must be hosted on the app CDN');
export const dealSchema = z.object({
    id: z.string().uuid(),
    userId: z.string().uuid(),
    productId: z.string().uuid(),
    price: priceField,
    currency: currencyField,
    storeName: storeNameField,
    photoUrl: z.string().url().nullable(),
    expiryDate: z.string().nullable(),
    note: z.string().nullable(),
    country: z.string().length(2).nullable(),
    upvoteCount: z.number().int().nonnegative(),
    downvoteCount: z.number().int().nonnegative(),
    score: z.number().min(0).max(1),
    status: dealStatusSchema,
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    myVote: z.union([z.literal(-1), z.literal(1)]).nullable().optional(),
    product: z.object({
        id: z.string().uuid(),
        name: z.string(),
        brand: z.string().nullable(),
        imageUrl: z.string().url().nullable(),
    }).optional(),
    author: z.object({
        id: z.string().uuid(),
        firstName: z.string(),
        avatarUrl: z.string().url().nullable(),
    }).optional(),
});
export const dealCreateSchema = z.object({
    productId: z.string().uuid(),
    price: priceField,
    currency: currencyField.optional(),
    storeName: storeNameField,
    photoUrl: photoUrlField.optional(),
    expiryDate: expiryField,
    note: noteField,
});
export const dealPatchSchema = z
    .object({
    price: priceField.optional(),
    storeName: storeNameField.optional(),
    photoUrl: photoUrlField.nullable().optional(),
    expiryDate: expiryField.or(z.null()),
    note: noteField.or(z.null()),
})
    .partial()
    .refine((v) => Object.keys(v).length > 0, { message: 'at least one field required' });
export const dealVoteSchema = z.object({
    value: z.union([z.literal(-1), z.literal(1)]),
});
export const dealListQuerySchema = z.object({
    sort: dealSortSchema,
    cursor: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
});
//# sourceMappingURL=deal.js.map