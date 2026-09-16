import type { FastifyInstance } from 'fastify';
import { adminPantryItemsListRoute } from './list.js';
import { adminPantryItemsFilterOptionsRoute } from './filter-options.js';
import { adminPantryItemsGetRoute } from './get.js';
import { adminPantryItemsPatchRoute } from './patch.js';
import { adminPantryItemsDeleteRoute } from './delete.js';

export async function adminPantryItemsRoutes(app: FastifyInstance) {
  await app.register(adminPantryItemsFilterOptionsRoute);
  await app.register(adminPantryItemsListRoute);
  await app.register(adminPantryItemsGetRoute);
  await app.register(adminPantryItemsPatchRoute);
  await app.register(adminPantryItemsDeleteRoute);
}
