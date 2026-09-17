import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { reverseGeocodeCoordinates } from '../../services/geo/google-maps-geocoder.js';

const reverseGeocodeQuerySchema = z.object({
  lat: z.coerce.number().min(-90, 'Latitude must be >= -90').max(90, 'Latitude must be <= 90'),
  lng: z.coerce.number().min(-180, 'Longitude must be >= -180').max(180, 'Longitude must be <= 180'),
});

export async function reverseGeocodeRoute(app: FastifyInstance) {
  app.get(
    '/geo/reverse-geocode',
    {
      onRequest: [app.requireAuth],
      config: {
        rateLimit: {
          max: 10,
          timeWindow: '1 minute',
        },
      },
    },
    async (req, reply) => {
      const { lat, lng } = reverseGeocodeQuerySchema.parse(req.query);
      const userId = req.user?.id ?? null;

      const result = await reverseGeocodeCoordinates(lat, lng, userId, 'profile_location');

      return reply.send({
        address: result.address,
        country: result.countryCode,
        latitude: result.latitude,
        longitude: result.longitude,
        cached: result.cached,
      });
    },
  );
}
