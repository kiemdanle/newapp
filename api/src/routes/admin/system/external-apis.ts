import type { FastifyInstance } from 'fastify';
import { externalApiStateSchema } from '@pantry/shared';
import { snapshotBreakers } from '../../../services/admin/breakers.js';

export async function adminSystemExternalApisRoute(app: FastifyInstance) {
  app.get('/external-apis', async () =>
    externalApiStateSchema.parse({ breakers: snapshotBreakers() }),
  );
}
