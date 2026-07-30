// @prisma/client v5 ships CJS only; Node-ESM rejects named runtime imports.
// We separate the runtime value (Prisma.JsonNull) from the type namespace
// (Prisma.InputJsonValue, etc) — TypeScript erases the type-only import,
// so only `prismaPkg` survives at runtime.
import type { Prisma } from '@prisma/client';
import prismaPkg from '@prisma/client';
const PrismaRuntime = prismaPkg.Prisma;
import { getPrisma } from '../../db.js';

export interface AuditLogInput {
  adminId: string;
  action: string;
  targetType: string;
  targetId: string;
  diff?: unknown;
  requestId?: string | undefined;
  ip?: string | undefined;
}

/**
 * Append-only writer for admin_audit_log. Called from every admin mutation.
 *
 * Pass `tx` (a Prisma transaction client) whenever the audit row must commit
 * atomically with the state change it records — every Phase 4 moderation/
 * revision/merge/recovery service does this, inserting the audit row inside the
 * same `$transaction` as the write instead of via the post-response `req.auditLog`
 * plugin. Omit it only for non-domain/simple admin CRUD where a post-commit,
 * best-effort audit write is an accepted trade-off.
 */
export async function writeAuditLog(input: AuditLogInput, tx?: Prisma.TransactionClient): Promise<void> {
  if (!input.adminId) throw new Error('adminId is required');
  if (!input.action) throw new Error('action is required');
  if (!input.targetType) throw new Error('targetType is required');
  if (!input.targetId) throw new Error('targetId is required');

  await (tx ?? getPrisma()).adminAuditLog.create({
    data: {
      adminId: input.adminId,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      diff:
        input.diff === undefined
          ? PrismaRuntime.JsonNull
          : (input.diff as Prisma.InputJsonValue),
      requestId: input.requestId ?? null,
      ip: input.ip ?? null,
    },
  });
}
