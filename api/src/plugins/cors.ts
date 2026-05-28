import cors from '@fastify/cors';
import type { FastifyInstance } from 'fastify';
import { getConfig } from '../config.js';

export async function registerCors(app: FastifyInstance) {
  const cfg = getConfig();
  await app.register(cors, {
    origin: (origin, cb) => {
      // Allow no-origin (mobile native fetch) and the admin URL only
      if (!origin) return cb(null, true);
      if (origin === cfg.frontend.adminUrl) return cb(null, true);
      if (origin.startsWith('exp://') || origin.startsWith('pantry://')) return cb(null, true);
      cb(new Error('CORS: origin not allowed'), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    exposedHeaders: ['X-Request-Id'],
  });
}
