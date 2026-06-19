/**
 * Seed (or upsert) the first admin account.
 *
 * Usage:
 *   pnpm --filter @expyrico/api seed:admin -- --email=you@example.com --password='Str0ng-pass!' [--first=Dan --last=Owner]
 *
 * Env fallback (handy for one-shot ops without flags):
 *   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='Str0ng-pass!' \
 *   pnpm --filter @expyrico/api seed:admin
 *
 * Behavior:
 *  - Creates the user with role=admin, status=active, emailVerifiedAt=now (login
 *    refuses unverified emails). Hash uses the same argon2id config as register.
 *  - If the email already exists: updates passwordHash + promotes to admin +
 *    marks email verified. Existing TOTP / sessions / IDs are left untouched.
 *  - Always ensures an AuthCredential(type='password') row, mirroring register.
 *  - Admin login still forces TOTP enrollment on first sign-in via the API.
 */
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/services/auth/passwords.js';

const prisma = new PrismaClient();

type Args = { email: string; password: string; first: string; last: string };

function parseArgs(argv: string[]): Args {
  const map = new Map<string, string>();
  for (const arg of argv.slice(2)) {
    const m = arg.match(/^--([^=]+)=(.*)$/);
    if (m) map.set(m[1]!, m[2]!);
  }
  const email = (map.get('email') ?? process.env.ADMIN_EMAIL ?? '').trim().toLowerCase();
  const password = map.get('password') ?? process.env.ADMIN_PASSWORD ?? '';
  const first = (map.get('first') ?? process.env.ADMIN_FIRST_NAME ?? 'Admin').trim();
  const last = (map.get('last') ?? process.env.ADMIN_LAST_NAME ?? 'User').trim();

  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    throw new Error('Missing or invalid --email (or ADMIN_EMAIL env)');
  }
  if (password.length < 10 || password.length > 128) {
    throw new Error('--password (or ADMIN_PASSWORD) must be 10-128 characters');
  }
  if (!first || !last) {
    throw new Error('First and last name must be non-empty');
  }
  return { email, password, first, last };
}

async function seedSettings(adminId?: string) {
  await prisma.setting.upsert({
    where: { key: 'feature_flags' },
    update: {},
    create: {
      key: 'feature_flags',
      value: {
        reviewsEnabled: true,
        passkeysEnabled: true,
        ocrEnabled: true,
        maintenanceBanner: null,
      },
    },
  });
  await prisma.setting.upsert({
    where: { key: 'moderation' },
    update: {},
    create: {
      key: 'moderation',
      value: {
        autoHideReportThreshold: 3,
        profanitySensitivity: 'medium',
      },
    },
  });

  const templates = [
    { key: 'expiry_7d', title: 'Expires in 7 days', body: '{name} expires on {date}.' },
    { key: 'expiry_1d', title: 'Expires tomorrow', body: '{name} expires tomorrow.' },
    { key: 'expiry_today', title: 'Expires today', body: '{name} expires today.' },
  ];
  for (const t of templates) {
    await prisma.notificationTemplate.upsert({
      where: { key: t.key },
      update: {},
      create: t,
    });
  }

  if (adminId) {
    await prisma.setting.updateMany({
      where: { key: { in: ['feature_flags', 'moderation'] } },
      data: { updatedBy: adminId },
    });
  }
}

async function main() {
  const { email, password, first, last } = parseArgs(process.argv);
  const passwordHash = await hashPassword(password);
  const now = new Date();

  const user = await prisma.$transaction(async (tx) => {
    const u = await tx.user.upsert({
      where: { email },
      update: {
        passwordHash,
        role: 'admin',
        status: 'active',
        emailVerifiedAt: now,
      },
      create: {
        email,
        passwordHash,
        firstName: first,
        lastName: last,
        role: 'admin',
        status: 'active',
        emailVerifiedAt: now,
      },
    });
    const existingCred = await tx.authCredential.findFirst({
      where: { userId: u.id, type: 'password' },
    });
    if (!existingCred) {
      await tx.authCredential.create({ data: { userId: u.id, type: 'password' } });
    }
    return u;
  });

  await seedSettings(user.id);

  // eslint-disable-next-line no-console
  console.log(
    `Admin ready: ${user.email} (id=${user.id}). ` +
      `Sign in at the admin URL — first login will force TOTP enrollment.`,
  );
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
