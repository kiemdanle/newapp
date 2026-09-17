import type { FastifyInstance } from 'fastify';
import {
  giveawayDistanceSettingsSchema,
  type GiveawayDistanceSettings,
} from '@expyrico/shared';
import {
  getSetting,
  putSetting,
  SETTING_KEYS,
} from '../../../services/admin/settings.js';
import { writeAuditLog } from '../../../services/audit/log.js';

export async function adminSettingsGiveawaysRoute(app: FastifyInstance) {
  app.get('/settings/giveaways', async () => {
    const settings = await getSetting(
      SETTING_KEYS.GIVEAWAY_DISTANCE,
      giveawayDistanceSettingsSchema,
    );
    return settings;
  });

  app.patch('/settings/giveaways', async (req) => {
    const input = giveawayDistanceSettingsSchema.parse(req.body);
    const adminUserId = req.user!.id;

    const previous = await getSetting(
      SETTING_KEYS.GIVEAWAY_DISTANCE,
      giveawayDistanceSettingsSchema,
    );

    const updated = await putSetting(
      SETTING_KEYS.GIVEAWAY_DISTANCE,
      input,
      giveawayDistanceSettingsSchema,
      adminUserId,
    );

    await writeAuditLog({
      adminId: adminUserId,
      action: 'update_setting',
      targetType: 'setting',
      targetId: SETTING_KEYS.GIVEAWAY_DISTANCE,
      diff: {
        setting: SETTING_KEYS.GIVEAWAY_DISTANCE,
        before: previous,
        after: updated,
      },
      requestId: req.id,
      ip: req.ip,
    });

    return updated;
  });
}
