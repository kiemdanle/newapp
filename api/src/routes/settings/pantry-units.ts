import type { FastifyInstance } from 'fastify';
import { pantryUnitsSettingsSchema } from '@expyrico/shared';
import { getSetting, SETTING_KEYS } from '../../services/admin/settings.js';

export async function pantryUnitsClientRoute(app: FastifyInstance) {
  app.get('/settings/pantry-units', async () =>
    pantryUnitsSettingsSchema.parse(await getSetting(SETTING_KEYS.PANTRY_UNITS, pantryUnitsSettingsSchema)),
  );
}
