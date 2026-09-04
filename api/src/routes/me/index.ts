import type { FastifyInstance } from 'fastify';
import { profileRoute } from './profile.js';
import { pushTokenRoutes } from './push-token.js';
import { usageRoute } from './usage.js';
import { countrySuggestionRoute } from './country-suggestion.js';
import { avatarRoutes } from './avatar.js';
import { passwordRoute } from './password.js';
import { preferencesRoute } from './preferences.js';

export async function meRoutes(app: FastifyInstance) {
  await app.register(profileRoute);
  await app.register(pushTokenRoutes);
  await app.register(usageRoute);
  await app.register(countrySuggestionRoute);
  await app.register(avatarRoutes);
  await app.register(passwordRoute);
  await app.register(preferencesRoute);
}
