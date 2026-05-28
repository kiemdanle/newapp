import type { FastifyInstance } from 'fastify';
import { updateProfileSchema } from '@pantry/shared';
import { getPrisma } from '../../db.js';
import { toApiUser } from '../../services/users/repository.js';

export async function profileRoute(app: FastifyInstance) {
  app.patch('/', { onRequest: [app.requireAuth] }, async (req) => {
    const input = updateProfileSchema.parse(req.body);
    const user = await getPrisma().user.update({
      where: { id: req.user!.id },
      data: {
        ...(input.firstName !== undefined ? { firstName: input.firstName } : {}),
        ...(input.lastName !== undefined ? { lastName: input.lastName } : {}),
        ...(input.country !== undefined ? { country: input.country } : {}),
        ...(input.avatarUrl !== undefined ? { avatarUrl: input.avatarUrl } : {}),
        ...(input.themePreference !== undefined
          ? { themePreference: input.themePreference }
          : {}),
      },
    });
    return toApiUser(user);
  });
}
