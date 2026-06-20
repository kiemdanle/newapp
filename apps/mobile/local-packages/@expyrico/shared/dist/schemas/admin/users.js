import { z } from 'zod';
import { cursorQuerySchema, cursorPageSchema } from './common.js';
export const adminUserRoleSchema = z.enum(['user', 'admin']);
export const adminUserStatusSchema = z.enum(['active', 'suspended', 'deleted']);
export const adminUserRowSchema = z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    firstName: z.string(),
    lastName: z.string(),
    country: z.string().nullable(),
    role: adminUserRoleSchema,
    status: adminUserStatusSchema,
    createdAt: z.string().datetime(),
    lastSeenAt: z.string().datetime().nullable(),
});
export const adminUsersQuerySchema = cursorQuerySchema.extend({
    status: adminUserStatusSchema.optional(),
    role: adminUserRoleSchema.optional(),
    country: z.string().length(2).optional(),
    q: z.string().trim().min(1).optional(),
    sort: z.enum(['createdAt', 'lastSeenAt', 'email']).default('createdAt'),
    order: z.enum(['asc', 'desc']).default('desc'),
});
export const adminUsersListSchema = cursorPageSchema(adminUserRowSchema);
export const adminUserDetailSchema = adminUserRowSchema.extend({
    emailVerifiedAt: z.string().datetime().nullable(),
    totpEnabledAt: z.string().datetime().nullable(),
    recordCount: z.number().int(),
    reviewCount: z.number().int(),
    openReportsAgainst: z.number().int(),
    sessions: z.array(z.object({
        id: z.string().uuid(),
        ip: z.string().nullable(),
        deviceInfo: z.record(z.unknown()).nullable(),
        expiresAt: z.string().datetime(),
        revokedAt: z.string().datetime().nullable(),
    })),
});
export const adminUserPatchSchema = z.object({
    status: adminUserStatusSchema.optional(),
    role: adminUserRoleSchema.optional(),
    firstName: z.string().min(1).optional(),
    lastName: z.string().min(1).optional(),
}).refine((d) => Object.keys(d).length > 0, { message: 'no fields to update' });
export const adminUserImpersonateResponseSchema = z.object({
    accessToken: z.string(),
    expiresIn: z.number().int(),
});
//# sourceMappingURL=users.js.map