import type { FastifyInstance } from 'fastify';
import { reverseGeocodeRoute } from './reverse-geocode.js';

export async function geoRoutes(app: FastifyInstance) {
  await app.register(reverseGeocodeRoute);
}
