import type { FastifyInstance } from 'fastify';
import { getPhotoLimits } from '../../services/admin/settings.js';

export async function photoLimitsClientRoute(app: FastifyInstance) {
  app.get('/settings/photo-limits', async () => getPhotoLimits());
}
