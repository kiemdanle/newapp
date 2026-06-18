import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { reputationSchema, ERROR_CODES } from '@expyrico/shared';
import { getPrisma } from '../../db.js';
import { AppError } from '../../errors.js';
import { toApiReputation } from '../../services/reputation/repository.js';

const paramsSchema = z.object({ id: z.string().uuid() });

export async function userReputationRoute(app: FastifyInstance) {
  app.get('/users/:id/reputation', async (req) => {
    const { id } = paramsSchema.parse(req.params);
    const user = await getPrisma().user.findUnique({ where: { id } });
    if (!user) throw new AppError({ status: 404, code: ERROR_CODES.NOT_FOUND, title: 'User not found' });
    return reputationSchema.parse(toApiReputation(user));
  });
}
