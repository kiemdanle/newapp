/**
 * Disaster Recovery CLI tool for server operators: Reset 2FA for an Admin account.
 *
 * Usage:
 *   pnpm --filter @expyrico/api admin:reset-2fa -- --email=admin@example.com
 *
 * Env fallback:
 *   ADMIN_EMAIL=admin@example.com pnpm --filter @expyrico/api admin:reset-2fa
 *
 * Behavior:
 *   - Verifies the user exists and has role=admin.
 *   - Atomically clears totpSecret and totpEnabledAt.
 *   - Increments tokenVersion (invalidating existing JWTs).
 *   - Deletes all TotpRecoveryCode rows for the user.
 *   - Revokes all active AdminTrustedDevice entries.
 *   - Revokes all active Session entries.
 *   - Deletes any lingering TotpChallenge rows.
 *   - On next sign-in, the admin is immediately prompted to scan a new QR code.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function parseArgs(argv: string[]): { email: string } {
  const map = new Map<string, string>();
  for (const arg of argv.slice(2)) {
    const m = arg.match(/^--([^=]+)=(.*)$/);
    if (m) map.set(m[1]!, m[2]!);
  }
  const email = (map.get('email') ?? process.env.ADMIN_EMAIL ?? '').trim().toLowerCase();
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    throw new Error('Missing or invalid --email (or ADMIN_EMAIL environment variable)');
  }
  return { email };
}

async function main() {
  const { email } = parseArgs(process.argv);

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new Error(`User with email "${email}" not found.`);
  }

  if (user.role !== 'admin') {
    throw new Error(`User "${email}" is not an admin (role is "${user.role}").`);
  }

  if (!user.totpSecret && !user.totpEnabledAt) {
    // eslint-disable-next-line no-console
    console.log(`Notice: User "${email}" does not have 2FA enabled currently.`);
  }

  const now = new Date();
  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: {
        totpSecret: null,
        totpEnabledAt: null,
        tokenVersion: { increment: 1 },
      },
    }),
    prisma.totpRecoveryCode.deleteMany({
      where: { userId: user.id },
    }),
    prisma.adminTrustedDevice.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: now },
    }),
    prisma.session.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: now },
    }),
    prisma.totpChallenge.deleteMany({
      where: { userId: user.id },
    }),
  ]);

  // eslint-disable-next-line no-console
  console.log(`\n✅ 2FA successfully reset for admin: ${user.email} (ID: ${user.id})`);
  // eslint-disable-next-line no-console
  console.log('• Authenticator secret cleared.');
  // eslint-disable-next-line no-console
  console.log('• Recovery codes purged.');
  // eslint-disable-next-line no-console
  console.log('• All active sessions and trusted devices revoked.');
  // eslint-disable-next-line no-console
  console.log('• Token version bumped (active JWTs invalidated).');
  // eslint-disable-next-line no-console
  console.log('\n👉 The admin can now sign in with email and password at the admin portal.');
  // eslint-disable-next-line no-console
  console.log('   The system will automatically present a fresh QR code and new recovery codes.\n');
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(`\n❌ Error: ${e instanceof Error ? e.message : e}\n`);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
