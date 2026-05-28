import { Prisma } from '@prisma/client';
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
 * Append-only writer for admin_audit_log. Called from every admin mutation in M3.
 */
export async function writeAuditLog(input: AuditLogInput): Promise<void> {
  if (!input.adminId) throw new Error('adminId is required');
  if (!input.action) throw new Error('action is required');
  if (!input.targetType) throw new Error('targetType is required');
  if (!input.targetId) throw new Error('targetId is required');

  await getPrisma().adminAuditLog.create({
    data: {
      adminId: input.adminId,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      diff: input.diff === undefined ? Prisma.JsonNull : (input.diff as Prisma.InputJsonValue),
      requestId: input.requestId ?? null,
      ip: input.ip ?? null,
    },
  });
}
