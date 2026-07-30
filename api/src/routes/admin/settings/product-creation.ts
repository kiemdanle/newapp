import type { FastifyInstance } from 'fastify';
import { productCreationSettingsSchema } from '@expyrico/shared';
import { getSetting, putSetting, SETTING_KEYS } from '../../../services/admin/settings.js';

export async function adminSettingsProductCreationRoute(app: FastifyInstance) {
  app.get('/product-creation', async () =>
    productCreationSettingsSchema.parse(await getSetting(SETTING_KEYS.PRODUCT_CREATION, productCreationSettingsSchema)),
  );

  app.patch('/product-creation', async (req) => {
    const input = productCreationSettingsSchema.parse(req.body);
    const before = await getSetting(SETTING_KEYS.PRODUCT_CREATION, productCreationSettingsSchema);
    const after = await putSetting(SETTING_KEYS.PRODUCT_CREATION, input, productCreationSettingsSchema, req.user!.id);
    await req.auditLog('settings.product_creation.update', { type: 'setting', id: SETTING_KEYS.PRODUCT_CREATION }, {
      before: before as Record<string, unknown>,
      after: after as Record<string, unknown>,
    });
    return after;
  });
}
