import type { FastifyInstance } from 'fastify';
import { contributorLevelsSettingSchema } from '@expyrico/shared';
import { getSetting, putSetting, SETTING_KEYS } from '../../../services/admin/settings.js';

export async function adminSettingsContributorLevelsRoute(app: FastifyInstance) {
  app.get('/contributor-levels', async () =>
    contributorLevelsSettingSchema.parse(
      await getSetting(SETTING_KEYS.CONTRIBUTOR_LEVELS, contributorLevelsSettingSchema),
    ),
  );

  app.patch('/contributor-levels', async (req) => {
    const input = contributorLevelsSettingSchema.parse(req.body);
    const before = await getSetting(SETTING_KEYS.CONTRIBUTOR_LEVELS, contributorLevelsSettingSchema);
    const after = await putSetting(
      SETTING_KEYS.CONTRIBUTOR_LEVELS,
      input,
      contributorLevelsSettingSchema,
      req.user!.id,
    );
    await req.auditLog(
      'settings.contributor_levels.update',
      { type: 'setting', id: SETTING_KEYS.CONTRIBUTOR_LEVELS },
      {
        before: before as unknown as Record<string, unknown>,
        after: after as unknown as Record<string, unknown>,
      },
    );
    return after;
  });
}
