import { getPrisma } from '../../db.js';
import { computeNotifyAt, resolveOffsetsForUser } from '../records/notify-at.js';
import { notificationSendQueue } from '../../queues/index.js';

/**
 * Schedule expiry reminders for EVERY current member of a household record.
 * Each member gets their own notification offsets (from notificationPreferences.offsetsDays,
 * falling back to the default). Replaces any previously enqueued send jobs for
 * this record (the notification-schedule worker also clears pending jobs, but
 * we cancel eagerly here so in-flight rescheduling is immediate).
 */
export async function fanOutHouseholdRecordReminders(recordId: string, householdId: string): Promise<void> {
  const prisma = getPrisma();
  const record = await prisma.record.findUnique({ where: { id: recordId } });
  if (!record || record.status !== 'active') return;

  const sendQ = notificationSendQueue();
  // Cancel any pending send jobs for this record (all members) before re-scheduling.
  const pending = await sendQ.getJobs(['delayed', 'waiting', 'paused']);
  for (const job of pending) {
    if (job.data?.recordId === recordId) {
      await job.remove();
    }
  }

  const members = await prisma.householdMember.findMany({
    where: { householdId },
    include: { user: { select: { id: true, notificationPreferences: true } } },
  });

  const now = Date.now();
  for (const m of members) {
    const offsets = resolveOffsetsForUser(m.user.notificationPreferences);
    const notifyAt = computeNotifyAt(record.expiryDate, offsets);
    for (const isoTs of notifyAt) {
      const fireAt = new Date(isoTs).getTime();
      const delay = Math.max(0, fireAt - now);
      const expiryMs = record.expiryDate.getTime();
      const offsetDays = Math.round((expiryMs - fireAt) / (24 * 3600 * 1000));
      await sendQ.add(
        'send',
        {
          recordId: record.id,
          userId: m.userId,
          fireAt: isoTs,
          offsetDays,
          templateKey: 'expiry_reminder',
        },
        {
          delay,
          jobId: `send__${record.id}__${m.userId}__${isoTs}`,
          attempts: 5,
          backoff: { type: 'exponential', delay: 60_000 },
          removeOnComplete: 1000,
          removeOnFail: 1000,
        },
      );
    }
  }
}

/**
 * Cancel a specific member's pending expiry reminders for ALL records of a
 * given household. Used when a member leaves or is removed.
 */
export async function cancelMemberRemindersForHousehold(userId: string, householdId: string): Promise<void> {
  const prisma = getPrisma();
  const records = await prisma.record.findMany({
    where: { householdId, status: 'active' },
    select: { id: true },
  });

  const sendQ = notificationSendQueue();
  const pending = await sendQ.getJobs(['delayed', 'waiting', 'paused']);
  for (const job of pending) {
    if (job.data?.userId === userId && records.some((r) => r.id === job.data?.recordId)) {
      await job.remove();
    }
  }
}

/**
 * Cancel ALL pending reminders for ALL records of a household. Used on dissolve.
 */
export async function cancelAllRemindersForHousehold(householdId: string): Promise<void> {
  const prisma = getPrisma();
  const recordIds = (
    await prisma.record.findMany({
      where: { householdId },
      select: { id: true },
    })
  ).map((r) => r.id);

  if (recordIds.length === 0) return;

  const sendQ = notificationSendQueue();
  const pending = await sendQ.getJobs(['delayed', 'waiting', 'paused']);
  for (const job of pending) {
    if (job.data?.recordId && recordIds.includes(job.data.recordId)) {
      await job.remove();
    }
  }
}

/**
 * Schedule a newly-added member into every active household record's reminders,
 * using that member's own notification offsets.
 */
export async function scheduleNewMemberReminders(userId: string, householdId: string): Promise<void> {
  const prisma = getPrisma();
  const records = await prisma.record.findMany({
    where: { householdId, status: 'active' },
  });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { notificationPreferences: true },
  });
  const offsets = resolveOffsetsForUser(user?.notificationPreferences);

  const sendQ = notificationSendQueue();
  const now = Date.now();
  for (const record of records) {
    const notifyAt = computeNotifyAt(record.expiryDate, offsets);
    for (const isoTs of notifyAt) {
      const fireAt = new Date(isoTs).getTime();
      const delay = Math.max(0, fireAt - now);
      const expiryMs = record.expiryDate.getTime();
      const offsetDays = Math.round((expiryMs - fireAt) / (24 * 3600 * 1000));
      await sendQ.add(
        'send',
        {
          recordId: record.id,
          userId,
          fireAt: isoTs,
          offsetDays,
          templateKey: 'expiry_reminder',
        },
        {
          delay,
          jobId: `send__${record.id}__${userId}__${isoTs}`,
          attempts: 5,
          backoff: { type: 'exponential', delay: 60_000 },
          removeOnComplete: 1000,
          removeOnFail: 1000,
        },
      );
    }
  }
}

/**
 * After a member leaves/dissolve, any records that reverted from household
 * scope back to the creator's personal scope need their single-owner
 * (creator-only) schedule re-established.
 */
export async function reschedulePersonalRecordReminders(recordIds: string[]): Promise<void> {
  const prisma = getPrisma();
  for (const id of recordIds) {
    const record = await prisma.record.findUnique({
      where: { id },
      include: { user: { select: { id: true, notificationPreferences: true } } },
    });
    if (!record || record.status !== 'active') continue;

    const sendQ = notificationSendQueue();
    const pending = await sendQ.getJobs(['delayed', 'waiting', 'paused']);
    for (const job of pending) {
      if (job.data?.recordId === id) {
        await job.remove();
      }
    }

    const offsets = resolveOffsetsForUser(record.user.notificationPreferences);
    const notifyAt = computeNotifyAt(record.expiryDate, offsets);
    const now = Date.now();
    for (const isoTs of notifyAt) {
      const fireAt = new Date(isoTs).getTime();
      const delay = Math.max(0, fireAt - now);
      const expiryMs = record.expiryDate.getTime();
      const offsetDays = Math.round((expiryMs - fireAt) / (24 * 3600 * 1000));
      await sendQ.add(
        'send',
        {
          recordId: record.id,
          userId: record.userId,
          fireAt: isoTs,
          offsetDays,
          templateKey: 'expiry_reminder',
        },
        {
          delay,
          jobId: `send__${record.id}__${isoTs}`,
          attempts: 5,
          backoff: { type: 'exponential', delay: 60_000 },
          removeOnComplete: 1000,
          removeOnFail: 1000,
        },
      );
    }
  }
}
