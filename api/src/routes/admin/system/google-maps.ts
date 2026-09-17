import type { FastifyInstance } from 'fastify';
import {
  googleMapsAnalyticsQuerySchema,
  googleMapsProbeRequestSchema,
} from '@expyrico/shared';
import {
  getGoogleMapsSummary,
  probeGoogleMapsCoordinates,
} from '../../../services/admin/google-maps-analytics.js';

export async function adminSystemGoogleMapsRoute(app: FastifyInstance) {
  app.get('/system/google-maps/stats', async (req) => {
    const query = googleMapsAnalyticsQuerySchema.parse(req.query);
    const summary = await getGoogleMapsSummary(query);
    return summary;
  });

  app.post('/system/google-maps/probe', async (req) => {
    const { latitude, longitude } = googleMapsProbeRequestSchema.parse(req.body);
    const adminUserId = req.user!.id;
    const probe = await probeGoogleMapsCoordinates(latitude, longitude, adminUserId);
    return probe;
  });
}
