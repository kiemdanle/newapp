import type { FastifyInstance } from 'fastify';
import { pantryLimitsPatchSchema } from '@expyrico/shared';
import { getPantryLimitsDirect, updatePantryLimits } from '../../../services/admin/settings.js';

export async function adminSettingsPantryLimitsRoute(app: FastifyInstance) {
  app.get('/pantry-limits', async () => getPantryLimitsDirect());

  app.patch('/pantry-limits', async (req) => {
    const input = pantryLimitsPatchSchema.parse(req.body);
    const updated = await updatePantryLimits(input, req.user!.id, {
      requestId: req.id,
      ip: req.ip,
    });
    return updated;
  });
}
