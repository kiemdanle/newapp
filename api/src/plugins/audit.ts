import type { FastifyInstance, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { writeAuditLog } from '../services/audit/log.js';
import type { AuditDiff } from '@pantry/shared';

export type AuditTarget = { type: string; id: string };

declare module 'fastify' {
  interface FastifyRequest {
    auditLog: (action: string, target: AuditTarget, diff?: AuditDiff | null) => Promise<void>;
  }
}

export const auditPlugin = fp(async (app: FastifyInstance) => {
  app.decorateRequest('auditLog', async function (
    this: FastifyRequest,
    action: string,
    target: AuditTarget,
    diff: AuditDiff | null = null,
  ) {
    if (!this.user) throw new Error('auditLog requires an authenticated admin');
    await writeAuditLog({
      adminId: this.user.id,
      action,
      targetType: target.type,
      targetId: target.id,
      diff,
      requestId: (this.headers['x-request-id'] as string) ?? this.id,
      ip: this.ip,
    });
  });
});
