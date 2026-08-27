import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  adminTrustedDevicesListSchema,
  adminTrustedDeviceRevokeResponseSchema,
  ERROR_CODES,
} from '@expyrico/shared';
import { AppError } from '../../errors.js';
import {
  listAdminTrustedDevices,
  revokeTrustedDevice,
} from '../../services/auth/trusted-devices.js';

const paramsSchema = z.object({
  id: z.string().uuid(),
});

export async function adminTrustedDevicesRoute(app: FastifyInstance) {
  // GET /v1/admin/trusted-devices — lists active trusted devices for the authenticated admin
  app.get('/trusted-devices', async (req) => {
    const devices = await listAdminTrustedDevices(req.user!.id);
    return adminTrustedDevicesListSchema.parse({
      devices: devices.map((d) => ({
        id: d.id,
        ip: d.ip,
        deviceInfo: (d.deviceInfo as Record<string, unknown>) ?? null,
        expiresAt: d.expiresAt.toISOString(),
        lastUsedAt: d.lastUsedAt ? d.lastUsedAt.toISOString() : null,
        createdAt: d.createdAt.toISOString(),
      })),
    });
  });

  // DELETE /v1/admin/trusted-devices/:id — revokes a specific trusted device
  app.delete('/trusted-devices/:id', async (req, reply) => {
    const { id } = paramsSchema.parse(req.params);
    const ok = await revokeTrustedDevice(id, req.user!.id);
    if (!ok) {
      throw new AppError({
        status: 404,
        code: ERROR_CODES.NOT_FOUND,
        title: 'Trusted device not found or already revoked',
      });
    }
    return reply.send(adminTrustedDeviceRevokeResponseSchema.parse({ ok: true }));
  });
}
