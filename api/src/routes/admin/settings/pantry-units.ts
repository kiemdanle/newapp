import type { FastifyInstance } from 'fastify';
import { pantryUnitsSettingsSchema } from '@expyrico/shared';
import { getSetting, putSetting, SETTING_KEYS } from '../../../services/admin/settings.js';

export async function adminSettingsPantryUnitsRoute(app: FastifyInstance) {
  app.get('/pantry-units', async () =>
    pantryUnitsSettingsSchema.parse(await getSetting(SETTING_KEYS.PANTRY_UNITS, pantryUnitsSettingsSchema)),
  );

  app.patch('/pantry-units', async (req) => {
    const input = pantryUnitsSettingsSchema.parse(req.body);
    const before = await getSetting(SETTING_KEYS.PANTRY_UNITS, pantryUnitsSettingsSchema);
    const after = await putSetting(SETTING_KEYS.PANTRY_UNITS, input, pantryUnitsSettingsSchema, req.user!.id);
    await req.auditLog('settings.pantry_units.update', { type: 'setting', id: SETTING_KEYS.PANTRY_UNITS }, {
      before: before as Record<string, unknown>,
      after: after as Record<string, unknown>,
    });
    return after;
  });
}
