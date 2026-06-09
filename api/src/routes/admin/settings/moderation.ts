import type { FastifyInstance } from 'fastify';
import { moderationSettingsSchema } from '@pantry/shared';
import { getSetting, putSetting, SETTING_KEYS } from '../../../services/admin/settings.js';

export async function adminSettingsModerationRoute(app: FastifyInstance) {
  app.get('/moderation', async () =>
    moderationSettingsSchema.parse(await getSetting(SETTING_KEYS.MODERATION, moderationSettingsSchema)),
  );

  app.patch('/moderation', async (req) => {
    const input = moderationSettingsSchema.parse(req.body);
    const before = await getSetting(SETTING_KEYS.MODERATION, moderationSettingsSchema);
    const after = await putSetting(SETTING_KEYS.MODERATION, input, moderationSettingsSchema, req.user!.id);
    await req.auditLog('settings.moderation.update', { type: 'setting', id: SETTING_KEYS.MODERATION }, {
      before: before as Record<string, unknown>,
      after: after as Record<string, unknown>,
    });
    return after;
  });
}
