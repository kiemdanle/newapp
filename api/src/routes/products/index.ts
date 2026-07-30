import type { FastifyInstance } from 'fastify';
import { lookupRoute } from './lookup.js';
import { lookupV2Route } from './lookup-v2.js';
import { searchRoute } from './search.js';
import { getProductRoute } from './get.js';
import { createProductRoute } from './create.js';
import { patchProductRoute } from './patch.js';
import { draftsRoute } from './drafts.js';
import { draftUpdateRoute } from './draft-update.js';
import { draftSubmitRoute } from './submit.js';

export async function productRoutes(app: FastifyInstance) {
  await app.register(lookupRoute);
  await app.register(lookupV2Route);
  await app.register(searchRoute);
  await app.register(getProductRoute);
  await app.register(createProductRoute);
  await app.register(patchProductRoute);
  await app.register(draftsRoute);
  await app.register(draftUpdateRoute);
  await app.register(draftSubmitRoute);
}
