import type { FastifyInstance } from 'fastify';
import { countrySuggestionSchema } from '@expyrico/shared';
import { detectCountryFromIp } from '../../services/country/detect.js';

export async function countrySuggestionRoute(app: FastifyInstance) {
  app.get('/country-suggestion', { onRequest: app.requireAuth }, async (req, reply) => {
    const country = await detectCountryFromIp(req.ip).catch(() => null);
    return reply.send(countrySuggestionSchema.parse({ country }));
  });
}
