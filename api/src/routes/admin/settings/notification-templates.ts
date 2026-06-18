import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { notificationTemplateSchema, notificationTemplatePatchSchema, ERROR_CODES } from '@expyrico/shared';
import { getPrisma } from '../../../db.js';
import { AppError } from '../../../errors.js';

const paramsSchema = z.object({ id: z.string().uuid() });

export async function adminSettingsNotificationTemplatesRoute(app: FastifyInstance) {
  app.get('/notification-templates', async () => {
    const rows = await getPrisma().notificationTemplate.findMany({ orderBy: { key: 'asc' } });
    return { items: rows.map((t) => notificationTemplateSchema.parse({ ...t, updatedAt: t.updatedAt.toISOString() })) };
  });

  app.patch('/notification-templates/:id', async (req) => {
    const { id } = paramsSchema.parse(req.params);
    const input = notificationTemplatePatchSchema.parse(req.body);
    const tmpl = await getPrisma().notificationTemplate.findUnique({ where: { id } });
    if (!tmpl) throw new AppError({ status: 404, code: ERROR_CODES.NOT_FOUND, title: 'Template not found' });
    const updated = await getPrisma().notificationTemplate.update({
      where: { id },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.body !== undefined ? { body: input.body } : {}),
        ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
        updatedBy: req.user!.id,
      },
    });
    await req.auditLog('settings.notification_template.update', { type: 'notification_template', id }, {
      before: { title: tmpl.title, body: tmpl.body, enabled: tmpl.enabled },
      after: input as Record<string, unknown>,
    });
    return notificationTemplateSchema.parse({ ...updated, updatedAt: updated.updatedAt.toISOString() });
  });
}
