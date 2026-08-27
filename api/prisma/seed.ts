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

  const defaultTemplates = [
    { key: 'expiry_reminder', title: 'Expyrico', body: '{name} expires in {days} days' },
    { key: 'giveaway_new_claim', title: 'New Giveaway Claim', body: 'Someone requested {name}' },
    { key: 'giveaway_selected', title: 'Giveaway Claim Selected', body: 'You were selected for {name}!' },
    { key: 'giveaway_rejected', title: 'Giveaway Claim Update', body: 'Another claim was selected for {name}' },
    { key: 'giveaway_handed_off', title: 'Giveaway Handed Off', body: '{name} has been handed off' },
    { key: 'giveaway_completed', title: 'Giveaway Completed', body: '{name} is complete. Please rate your experience!' },
    { key: 'giveaway_rate_prompt', title: 'Rate Transaction', body: 'Please leave a rating for {name}' },
  ];

  for (const t of defaultTemplates) {
    await prisma.notificationTemplate.upsert({
      where: { key: t.key },
      update: {},
      create: { key: t.key, title: t.title, body: t.body, enabled: true },
    });
  }
  // eslint-disable-next-line no-console
  console.log('Seeded default notification templates');

  await prisma.setting.upsert({
    where: { key: 'product_creation' },
    update: { value: { mode: 'all' } },
    create: { key: 'product_creation', value: { mode: 'all' } },
  });
  // eslint-disable-next-line no-console
  console.log('Seeded product_creation setting to mode: all');
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
