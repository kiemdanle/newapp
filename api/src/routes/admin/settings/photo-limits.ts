import type { FastifyInstance } from 'fastify';
import { photoLimitsSettingsSchema } from '@expyrico/shared';
import { getPhotoLimits, putSetting, SETTING_KEYS } from '../../../services/admin/settings.js';

export async function adminSettingsPhotoLimitsRoute(app: FastifyInstance) {
  app.get('/photo-limits', async () => getPhotoLimits());

  app.patch('/photo-limits', async (req) => {
    const input = photoLimitsSettingsSchema.parse(req.body);
    const before = await getPhotoLimits();
    const after = await putSetting(SETTING_KEYS.PHOTO_LIMITS, input, photoLimitsSettingsSchema, req.user!.id);
    await req.auditLog('settings.photo_limits.update', { type: 'setting', id: SETTING_KEYS.PHOTO_LIMITS }, {
      before: before as unknown as Record<string, unknown>,
      after: after as unknown as Record<string, unknown>,
    });
    return after;
  });
}
