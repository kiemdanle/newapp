import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, beforeEach } from 'vitest';
import { disconnectPrisma, getPrisma } from '../../src/db.js';
import { disconnectRedis, getRedis } from '../../src/redis.js';

// Load .env.test if present, falling back to .env.test.example.
// Vitest runs from the api package root, so resolve relative to cwd.
// We OVERRIDE any pre-existing values because the dev .env may already be loaded
// in the parent shell or by tooling, and tests must use the .env.test values.
const envPath = existsSync(resolve('.env.test')) ? '.env.test' : '.env.test.example';
for (const line of readFileSync(envPath, 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) {
    let val = m[2]!.trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    process.env[m[1]!] = val;
  }
}

// Truncate all tables in dependency order before each test
const tables = [
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
  'product_edits',
  'records',
  'products',
  'users',
];

beforeAll(async () => {
  // Run pending migrations
  const { execSync } = await import('node:child_process');
  execSync('pnpm --filter @pantry/api exec prisma migrate deploy', {
    stdio: 'pipe',
    env: { ...process.env },
  });
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
});

afterAll(async () => {
  await disconnectPrisma();
  await disconnectRedis();
});
