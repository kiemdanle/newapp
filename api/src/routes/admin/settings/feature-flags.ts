import type { FastifyInstance } from 'fastify';
import { featureFlagsSchema } from '@pantry/shared';
import { getSetting, putSetting, SETTING_KEYS } from '../../../services/admin/settings.js';

export async function adminSettingsFeatureFlagsRoute(app: FastifyInstance) {
  app.get('/feature-flags', async () =>
    featureFlagsSchema.parse(await getSetting(SETTING_KEYS.FEATURE_FLAGS, featureFlagsSchema)),
  );

  app.patch('/feature-flags', async (req) => {
    const input = featureFlagsSchema.parse(req.body);
    const before = await getSetting(SETTING_KEYS.FEATURE_FLAGS, featureFlagsSchema);
    const after = await putSetting(SETTING_KEYS.FEATURE_FLAGS, input, featureFlagsSchema, req.user!.id);
    await req.auditLog('settings.feature_flags.update', { type: 'setting', id: SETTING_KEYS.FEATURE_FLAGS }, {
      before: before as Record<string, unknown>,
      after: after as Record<string, unknown>,
    });
    return after;
  });
}
