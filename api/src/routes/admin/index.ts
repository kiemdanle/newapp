import type { FastifyInstance } from 'fastify';
import { adminOnlyPlugin } from '../../plugins/admin-only.js';
import { auditPlugin } from '../../plugins/audit.js';
import { adminUsersListRoute } from './users/list.js';
import { adminUsersGetRoute } from './users/get.js';
import { adminUsersPatchRoute } from './users/patch.js';
import { adminUsersRevokeSessionsRoute } from './users/revoke-sessions.js';
import { adminUsersImpersonateRoute } from './users/impersonate.js';
import { adminProductsListRoute } from './products/list.js';
import { adminProductsGetRoute } from './products/get.js';
import { adminProductsPatchRoute } from './products/patch.js';
import { adminProductsMergeRoute } from './products/merge.js';
import { adminProductsPendingListRoute } from './products/pending.js';
import { adminProductsPendingResolveRoute } from './products/pending-resolve.js';
import { adminReviewsListRoute } from './reviews/list.js';
import { adminReviewsGetRoute } from './reviews/get.js';
import { adminReviewsStatusRoute } from './reviews/status.js';
import { adminReportsListRoute } from './reports/list.js';
import { adminReportsResolveRoute } from './reports/resolve.js';
import { adminAnalyticsOverviewRoute } from './analytics/overview.js';
import { adminAnalyticsScansRoute } from './analytics/scans.js';
import { adminAnalyticsReviewsRoute } from './analytics/reviews.js';
import { adminAnalyticsGeographyRoute } from './analytics/geography.js';
import { adminSystemQueueHealthRoute } from './system/queue-health.js';
import { adminSystemPushLogsRoute } from './system/push-logs.js';
import { adminSystemApiErrorsRoute } from './system/api-errors.js';
import { adminSystemExternalApisRoute } from './system/external-apis.js';
import { adminBullBoardRoute } from './system/bullboard.js';
import { adminReferralsOverviewRoute } from './referrals.js';
import { adminSettingsFeatureFlagsRoute } from './settings/feature-flags.js';
import { adminSettingsModerationRoute } from './settings/moderation.js';
import { adminSettingsNotificationTemplatesRoute } from './settings/notification-templates.js';
import { adminSettingsAdminsRoute } from './settings/admins.js';

export async function adminRoutes(app: FastifyInstance) {
  await app.register(adminOnlyPlugin);
  await app.register(auditPlugin);

  app.get('/_ping', async () => ({ ok: true }));

  await app.register(adminUsersListRoute, { prefix: '/users' });
  await app.register(adminUsersGetRoute, { prefix: '/users' });
  await app.register(adminUsersPatchRoute, { prefix: '/users' });
  await app.register(adminUsersRevokeSessionsRoute, { prefix: '/users' });
  await app.register(adminUsersImpersonateRoute, { prefix: '/users' });

  await app.register(adminProductsPendingListRoute, { prefix: '/products' });
  await app.register(adminProductsPendingResolveRoute, { prefix: '/products' });
  await app.register(adminProductsListRoute, { prefix: '/products' });
  await app.register(adminProductsGetRoute, { prefix: '/products' });
  await app.register(adminProductsPatchRoute, { prefix: '/products' });
  await app.register(adminProductsMergeRoute, { prefix: '/products' });

  await app.register(adminReviewsListRoute, { prefix: '/reviews' });
  await app.register(adminReviewsGetRoute, { prefix: '/reviews' });
  await app.register(adminReviewsStatusRoute, { prefix: '/reviews' });

  await app.register(adminReportsListRoute, { prefix: '/reports' });
  await app.register(adminReportsResolveRoute, { prefix: '/reports' });

  await app.register(adminAnalyticsOverviewRoute, { prefix: '/analytics' });
  await app.register(adminAnalyticsScansRoute, { prefix: '/analytics' });
  await app.register(adminAnalyticsReviewsRoute, { prefix: '/analytics' });
  await app.register(adminAnalyticsGeographyRoute, { prefix: '/analytics' });

  await app.register(adminSystemQueueHealthRoute, { prefix: '/system' });
  await app.register(adminSystemPushLogsRoute, { prefix: '/system' });
  await app.register(adminSystemApiErrorsRoute, { prefix: '/system' });
  await app.register(adminSystemExternalApisRoute, { prefix: '/system' });
  await app.register(adminBullBoardRoute);

  await app.register(adminSettingsFeatureFlagsRoute, { prefix: '/settings' });
  await app.register(adminSettingsModerationRoute, { prefix: '/settings' });
  await app.register(adminSettingsNotificationTemplatesRoute, { prefix: '/settings' });
  await app.register(adminSettingsAdminsRoute, { prefix: '/settings' });
  await app.register(adminReferralsOverviewRoute);
}
