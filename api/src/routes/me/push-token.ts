import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { pushTokenRegisterSchema, pushTokenSchema, ERROR_CODES } from '@expyrico/shared';
import { AppError } from '../../errors.js';
import {
  PushTokenOwnershipError,
  upsertPushToken,
  revokePushToken,
} from '../../services/push/repository.js';

const paramSchema = z.object({ id: z.string().uuid() });

export async function pushTokenRoutes(app: FastifyInstance) {
  app.post('/push-token', { onRequest: app.requireAuth }, async (req, reply) => {
    const input = pushTokenRegisterSchema.parse(req.body);
    let row;
    try {
      row = await upsertPushToken({
        userId: req.user!.id,
        deviceToken: input.deviceToken,
        platform: input.platform,
        deviceInfo: input.deviceInfo,
      });
    } catch (error) {
      if (error instanceof PushTokenOwnershipError) {
        throw new AppError({
          status: 409,
          code: ERROR_CODES.CONFLICT,
          title: 'Device token is already registered to another account',
        });
      }
      throw error;
    }
    return reply.status(201).send(
      pushTokenSchema.parse({
        id: row.id,
        deviceToken: row.deviceToken,
        platform: row.platform,
        createdAt: row.createdAt.toISOString(),
        lastUsedAt: row.lastUsedAt ? row.lastUsedAt.toISOString() : null,
      }),
    );
  });

  app.delete('/push-token/:id', { onRequest: app.requireAuth }, async (req, reply) => {
    const { id } = paramSchema.parse(req.params);
    const ok = await revokePushToken(req.user!.id, id);
    if (!ok) {
      throw new AppError({
        status: 404,
        code: ERROR_CODES.NOT_FOUND,
        title: 'Push token not found',
      });
    }
    return reply.status(204).send();
  });
}
