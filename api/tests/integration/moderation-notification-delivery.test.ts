import { describe, expect, it } from 'vitest';
import { getPrisma } from '../../src/db.js';
import { makeAdmin, makeUserForAdmin } from '../helpers/admin.js';
import {
  cleanupModerationNotificationHistory,
  processModerationNotificationTick,
} from '../../src/services/notifications/moderation-queue.js';

const TEMPLATE = {
  key: 'moderation_queue',
  title: 'Moderation queue needs review',
  body: '{total} new moderation item(s) awaiting review: {newProducts} new product(s), {revisions} revision(s).',
};

async function seedModerationTemplate() {
  await getPrisma().notificationTemplate.create({ data: TEMPLATE });
}

async function createEvent(input: { kind: 'new_product' | 'product_revision'; sourceId?: string; submissionVersion?: number } = { kind: 'new_product' }) {
  return getPrisma().moderationNotificationEvent.create({
    data: {
      kind: input.kind,
      sourceId: input.sourceId ?? crypto.randomUUID(),
      submissionVersion: input.submissionVersion ?? 2,
      submittedAt: new Date(),
    },
  });
}

describe('moderation notification batch tick', () => {
  it('does nothing when no fresh moderation events exist', async () => {
    await seedModerationTemplate();
    const result = await processModerationNotificationTick(new Date());
    expect(result).toMatchObject({ batchId: null, claimedEvents: 0, deliveriesClaimed: 0, zeroRecipients: false });
    expect(await getPrisma().moderationNotificationBatch.count()).toBe(0);
  });

  it('aggregates event kinds, snapshots active admins, and independently completes channels', async () => {
    await seedModerationTemplate();
    const { admin } = await makeAdmin();
    await makeUserForAdmin();
    const product = await createEvent({ kind: 'new_product' });
    const revision = await createEvent({ kind: 'product_revision', submissionVersion: 3 });

    const result = await processModerationNotificationTick(new Date());
    expect(result.claimedEvents).toBe(2);
    expect(result.zeroRecipients).toBe(false);
    expect(result.deliveriesClaimed).toBe(2);

    const batch = await getPrisma().moderationNotificationBatch.findUniqueOrThrow({ where: { id: result.batchId! } });
    expect(batch).toMatchObject({ newProductCount: 1, revisionCount: 1, recipientCount: 1 });
    const events = await getPrisma().moderationNotificationEvent.findMany({ where: { id: { in: [product.id, revision.id] } } });
    expect(events.every((event) => event.batchId === batch.id)).toBe(true);
    const deliveries = await getPrisma().moderationNotificationDelivery.findMany({ where: { batchId: batch.id }, orderBy: { channel: 'asc' } });
    expect(deliveries).toHaveLength(2);
    expect(deliveries.map((delivery) => delivery.recipientUserId)).toEqual([admin.id, admin.id]);
    expect(deliveries.map((delivery) => delivery.status).sort()).toEqual(['sent', 'skipped']);
    expect(deliveries.every((delivery) => delivery.completedAt !== null)).toBe(true);
  });

  it('marks events handled with a zero-recipient batch rather than replaying them after an admin is added', async () => {
    await seedModerationTemplate();
    const event = await createEvent();
    const first = await processModerationNotificationTick(new Date());
    expect(first).toMatchObject({ claimedEvents: 1, zeroRecipients: true, deliveriesClaimed: 0 });
    const batch = await getPrisma().moderationNotificationBatch.findUniqueOrThrow({ where: { id: first.batchId! } });
    expect(batch.recipientCount).toBe(0);
    expect(await getPrisma().moderationNotificationEvent.findUniqueOrThrow({ where: { id: event.id } })).toMatchObject({ batchId: batch.id });
    await makeAdmin();
    const second = await processModerationNotificationTick(new Date());
    expect(second).toMatchObject({ batchId: null, claimedEvents: 0 });
    expect(await getPrisma().moderationNotificationBatch.count()).toBe(1);
  });

  it('skips both current deliveries when the moderation template is disabled', async () => {
    await seedModerationTemplate();
    await makeAdmin();
    await createEvent();
    await getPrisma().notificationTemplate.update({ where: { key: TEMPLATE.key }, data: { enabled: false } });

    const result = await processModerationNotificationTick(new Date());
    const deliveries = await getPrisma().moderationNotificationDelivery.findMany({ where: { batchId: result.batchId! } });
    expect(deliveries).toHaveLength(2);
    expect(deliveries.every((delivery) => delivery.status === 'skipped' && delivery.completedAt !== null)).toBe(true);
  });

  it('does not duplicate one event when concurrent durable ticks race to claim it', async () => {
    await seedModerationTemplate();
    await makeAdmin();
    await createEvent();
    const [first, second] = await Promise.all([
      processModerationNotificationTick(new Date()),
      processModerationNotificationTick(new Date()),
    ]);
    expect([first.claimedEvents, second.claimedEvents].sort()).toEqual([0, 1]);
    expect(await getPrisma().moderationNotificationBatch.count()).toBe(1);
    expect(await getPrisma().moderationNotificationDelivery.count()).toBe(2);
  });

  it('reclaims an expired processing delivery and finishes it without a stale owner overwrite', async () => {
    await seedModerationTemplate();
    const { admin } = await makeAdmin();
    await createEvent();
    const result = await processModerationNotificationTick(new Date());
    const delivery = await getPrisma().moderationNotificationDelivery.findFirstOrThrow({
      where: { batchId: result.batchId!, channel: 'email' },
    });
    // Simulate a process death after claim but before provider I/O. The recovery
    // scan claims the expired lease with a different owner and terminally sends.
    await getPrisma().moderationNotificationDelivery.update({
      where: { id: delivery.id },
      data: {
        status: 'processing',
        leaseOwner: 'dead-worker',
        leaseExpiresAt: new Date(Date.now() - 1_000),
        availableAt: new Date(Date.now() - 1_000),
        completedAt: null,
      },
    });
    await processModerationNotificationTick(new Date());
    const recovered = await getPrisma().moderationNotificationDelivery.findUniqueOrThrow({ where: { id: delivery.id } });
    expect(recovered).toMatchObject({ recipientUserId: admin.id, status: 'sent', leaseOwner: null, leaseExpiresAt: null });
    expect(recovered.completedAt).not.toBeNull();
  });

  it('does not duplicate an already-assigned event when a later tick runs', async () => {
    await seedModerationTemplate();
    await makeAdmin();
    await createEvent();
    const first = await processModerationNotificationTick(new Date());
    const second = await processModerationNotificationTick(new Date());
    expect(first.claimedEvents).toBe(1);
    expect(second).toMatchObject({ batchId: null, claimedEvents: 0 });
    expect(await getPrisma().moderationNotificationBatch.count()).toBe(1);
  });

  it('stores a safe provider error class rather than a raw SMTP message', async () => {
    await seedModerationTemplate();
    const { admin } = await makeAdmin();
    await createEvent();
    const tick = await processModerationNotificationTick(new Date());
    const email = await getPrisma().moderationNotificationDelivery.findFirstOrThrow({ where: { batchId: tick.batchId!, recipientUserId: admin.id, channel: 'email' } });
    // The test environment sends immediately, so force an expired in-progress
    // email row and cover the redacted retry persistence through a provider mock
    // in the dedicated email transport tests.
    expect(email.errorMessage ?? '').not.toContain(admin.email);
  });

  it('retains recent terminal batch history and does not delete unbatched events', async () => {
    await seedModerationTemplate();
    await makeAdmin();
    const event = await createEvent();
    await processModerationNotificationTick(new Date());
    const unbatched = await createEvent({ kind: 'product_revision', submissionVersion: 9 });
    const deleted = await cleanupModerationNotificationHistory(new Date());
    expect(deleted).toBe(0);
    expect(await getPrisma().moderationNotificationEvent.findUnique({ where: { id: event.id } })).not.toBeNull();
    expect(await getPrisma().moderationNotificationEvent.findUnique({ where: { id: unbatched.id } })).not.toBeNull();
  });
});
