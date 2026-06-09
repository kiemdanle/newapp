import type { FastifyInstance } from 'fastify';
import { createHouseholdRoute } from './create.js';
import { mineHouseholdsRoute } from './mine.js';
import { getHouseholdRoute } from './get.js';
import { patchHouseholdRoute } from './patch.js';
import { dissolveHouseholdRoute } from './dissolve.js';
import { membersAddRoute, membersListRoute, membersRemoveRoute } from './members.js';

export async function householdsRoutes(app: FastifyInstance) {
  await app.register(createHouseholdRoute);
  await app.register(mineHouseholdsRoute);
  await app.register(getHouseholdRoute);
  await app.register(patchHouseholdRoute);
  await app.register(dissolveHouseholdRoute);
  await app.register(membersAddRoute);
  await app.register(membersListRoute);
  await app.register(membersRemoveRoute);
}
