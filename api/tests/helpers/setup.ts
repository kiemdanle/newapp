import { afterAll, beforeAll, beforeEach } from 'vitest';
import { disconnectPrisma, getPrisma } from '../../src/db.js';
import { disconnectRedis, getRedis } from '../../src/redis.js';

// `.env.test` must already be loaded into `process.env` by the time this file's own
// static imports (`db.js` -> `logger.js`, which eagerly calls `getConfig()`) evaluate.
// That loading now lives in `./env.ts`, listed before this file in vitest.config.ts's
// `setupFiles` — see its header comment for why it has to be a separate, import-free
// file rather than code here.

// Truncate all tables in dependency order before each test
const tables = [
  'api_errors',
  'feedback_admin_alert_outbox',
  'feedback_messages',
  'feedback_attachments',
  'feedback_tickets',
  'notification_outbox',
  'transaction_ratings',
  'giveaway_claims',
  'giveaways',
  'referrals',
  'deal_votes',
  'deals',
  'reports',
  'review_votes',
  'reviews',
  'admin_audit_log',
  'totp_recovery_codes',
  'totp_challenges',
  'password_resets',
  'email_tokens',
  'push_logs',
  'push_tokens',
  'sessions',
  'auth_credentials',
  'media_operation_outbox',
  'moderation_notification_push_attempts',
  'moderation_notification_deliveries',
  'moderation_notification_health',
  'moderation_notification_events',
  'moderation_notification_batches',
  'product_edit_photos',
  'product_photos',
  'product_edits',
  'household_members',
  'records',
  'products',
  'households',
  'users',
  'notification_templates',
  'settings',
];

beforeAll(async () => {
  const prisma = getPrisma();
  await prisma.$executeRawUnsafe('ALTER TABLE giveaways ADD COLUMN IF NOT EXISTS quantity DOUBLE PRECISION NOT NULL DEFAULT 1;');
  await prisma.$executeRawUnsafe("ALTER TABLE giveaways ADD COLUMN IF NOT EXISTS unit VARCHAR(16) NOT NULL DEFAULT 'pcs';");
});

beforeEach(async () => {
  const prisma = getPrisma();
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${tables.map((t) => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE;`,
  );
  const redis = getRedis();
  await redis.flushdb();

  // Re-seed system user (always present in production via prisma db seed)
  await prisma.user.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      email: 'system@pantry.local',
      firstName: 'System',
      lastName: 'Bot',
      emailVerifiedAt: new Date(),
      role: 'user',
      status: 'active',
    },
  });

  // Re-seed the product_creation rollout gate (always present in production via the
  // expand migration's idempotent insert) so tests observe the same default-off
  // baseline the migration guarantees, rather than an absent row from truncation.
  await prisma.setting.upsert({
    where: { key: 'product_creation' },
    update: {},
    create: { key: 'product_creation', value: { mode: 'off' } },
  });
});

afterAll(async () => {
  await disconnectPrisma();
  await disconnectRedis();
});
