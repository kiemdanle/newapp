import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Reserved UUID for the synthetic "system" user that owns server-generated
 * reports (e.g., profanity auto-flags). Never logs in — no credentials.
 */
export const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000001';

async function main() {
  await prisma.user.upsert({
    where: { id: SYSTEM_USER_ID },
    update: {},
    create: {
      id: SYSTEM_USER_ID,
      email: 'system@pantry.local',
      firstName: 'System',
      lastName: 'Bot',
      emailVerifiedAt: new Date(),
      role: 'user',
      status: 'active',
    },
  });
  // eslint-disable-next-line no-console
  console.log('Seeded system user', SYSTEM_USER_ID);
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
