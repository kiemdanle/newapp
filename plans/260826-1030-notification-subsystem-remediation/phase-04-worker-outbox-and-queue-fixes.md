---
phase: 4
title: "Worker Outbox and Queue Fixes"
status: pending
priority: P1
dependencies: [3]
---

# Phase 4: Worker Outbox and Queue Fixes

## Overview
Remediates critical background notification delivery bugs and Redis scalability bottlenecks. Fixes the giveaway payload mismatch in `notification-send` worker, integrates database-driven notification templates with injection-safe string replacement, enqueues notification schedule jobs during offline synchronization via BullMQ `addBulk`, replaces unbounded $O(N)$ Redis job scans with deterministic job cancellation, implements an atomic outbox claim pattern, and schedules a recurring outbox sweeper.

<!-- Updated: Red-Team Review - Added safe regex replacement, addBulk sync scheduling, atomic outbox claim, and lockscreen privacy support -->

---

## Requirements

### Functional Requirements
- `processSendJob` must distinguish between record expiry reminders and giveaway notifications, querying the appropriate database entity (`Record` vs `Giveaway`) and looking up custom templates in `notification_templates`.
- Template placeholder replacement must use safe replacer functions (`replace(/\{name\}/g, () => name)`) to avoid special character (`$`, `$&`) syntax corruption.
- Support `hideItemNames: true` in user notification preferences to display generic copy ("An item in your pantry expires today") for lockscreen privacy.
- Seed standard notification templates (`expiry_reminder`, `giveaway_new_claim`, `giveaway_selected`, `giveaway_rejected`, `giveaway_handed_off`, `giveaway_completed`, `giveaway_rate_prompt`) in PostgreSQL.
- Batch offline sync (`syncRecords` in `api/src/services/records/sync.ts`) must add jobs to `notificationScheduleQueue` using `addBulk` in a single Redis multi-transaction.
- Add a periodic BullMQ repeatable job or independent interval in `runner.ts` to sweep `notification_outbox` every 60 seconds with atomic row claiming.

### Non-Functional Requirements
- Eliminate $O(N)$ full queue scans (`getJobs(['delayed', 'waiting'])`) in `notification-schedule.ts`, `delete.ts`, and `household-reminders.ts` by using deterministic job IDs for direct removal.
- All BullMQ workers must handle database and network outages gracefully with exponential backoff.

---

## Architecture & Code Changes

### 1. Multi-Template & Entity Support in Send Worker
* **`api/src/workers/notification-send.ts`**:
  Refactor `processSendJob` with safe string replacers and privacy preference checks:
  ```typescript
  export async function processSendJob(data: NotificationSendJob): Promise<void> {
    const prisma = getPrisma();
    const tokens = await activeTokensForUser(data.userId);
    if (tokens.length === 0) return;

    const user = await prisma.user.findUnique({
      where: { id: data.userId },
      select: { notificationPreferences: true },
    });
    const hideItemNames = Boolean(
      user?.notificationPreferences &&
      typeof user.notificationPreferences === 'object' &&
      (user.notificationPreferences as { hideItemNames?: boolean }).hideItemNames
    );

    let title = 'Expyrico';
    let body = '';
    let payloadData: Record<string, string> = {};

    // 1. Giveaway notifications
    if (data.templateKey.startsWith('giveaway_')) {
      const giveaway = await prisma.giveaway.findUnique({
        where: { id: data.recordId },
        include: { product: true },
      });
      if (!giveaway) return;
      const itemName = giveaway.title || giveaway.product?.name || 'Item';
      const template = await prisma.notificationTemplate.findUnique({
        where: { key: data.templateKey },
      });
      title = template?.title ?? 'Expyrico Community';
      const rawBody = template?.body ?? `Update on giveaway for {name}`;
      body = rawBody.replace(/\{name\}/g, () => itemName);
      payloadData = { giveawayId: giveaway.id, type: data.templateKey };
    } 
    // 2. Expiry reminder notifications
    else {
      const record = await prisma.record.findUnique({
        where: { id: data.recordId },
        include: { product: true },
      });
      if (!record || record.status !== 'active') return;
      const name = hideItemNames ? 'An item' : (record.customName ?? record.product?.name ?? 'Item');
      const template = await prisma.notificationTemplate.findUnique({
        where: { key: data.templateKey },
      });
      title = template?.title ?? 'Expyrico';
      const rawBody = template?.body ?? (
        data.offsetDays === 0 ? '{name} expires today' :
        data.offsetDays === 1 ? '{name} expires tomorrow' :
        `{name} expires in {days} days`
      );
      body = rawBody
        .replace(/\{name\}/g, () => name)
        .replace(/\{days\}/g, () => String(data.offsetDays));
      payloadData = { recordId: record.id, type: 'expiry' };
    }

    const results = await sendFcmPush({
      tokens: tokens.map((t) => t.deviceToken),
      title,
      body,
      data: payloadData,
    });

    // Revoke dead tokens and record push_logs
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i]!;
      const result = results[i]!;
      if (isInvalidFcmTokenError(result.errorCode)) {
        await revokePushTokenById(token.id);
      }
      await prisma.pushLog.create({
        data: {
          userId: data.userId,
          recordId: data.templateKey.startsWith('giveaway_') ? null : data.recordId,
          providerMessageId: result.providerMessageId,
          templateKey: data.templateKey,
          status: result.errorCode === null ? 'sent' : 'failed',
          errorMessage: result.errorMessage,
        },
      });
    }
  }
  ```

### 2. Batch Sync Notification Scheduling with `addBulk`
* **`api/src/services/records/sync.ts`**:
  Collect modified record IDs and enqueue with `addBulk` in a single Redis transaction:
  ```typescript
  // Collect modified record IDs during batch processing
  const scheduledRecordIds: string[] = [];

  // After applying upserts:
  if (scheduledRecordIds.length > 0) {
    const scheduleQ = notificationScheduleQueue();
    const bulkJobs = scheduledRecordIds.map((recId) => ({
      name: 'schedule',
      data: { recordId: recId },
      opts: { jobId: `schedule__${recId}`, removeOnComplete: true, removeOnFail: 100 },
    }));
    await scheduleQ.addBulk(bulkJobs);
  }
  ```

### 3. Atomic Outbox Dispatch Pattern
* **`api/src/services/notifications/outbox.ts`**:
  Claim rows atomically before enqueuing to prevent duplicate notifications:
  ```typescript
  export async function dispatchOutbox(limit = 50): Promise<number> {
    const prisma = getPrisma();
    const rows = await prisma.notificationOutbox.findMany({
      where: { dispatchedAt: null },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
    let dispatched = 0;
    for (const row of rows) {
      // Atomic claim
      const claimed = await prisma.notificationOutbox.updateMany({
        where: { id: row.id, dispatchedAt: null },
        data: { dispatchedAt: new Date() },
      });
      if (claimed.count === 0) continue; // Claimed by another worker

      try {
        await notificationSendQueue().add(
          'send',
          {
            recordId: (row.payload as Record<string, unknown>).giveawayId as string ?? '',
            userId: row.userId,
            fireAt: new Date().toISOString(),
            offsetDays: 0,
            templateKey: row.templateKey,
          },
          { jobId: `outbox-${row.id}`, removeOnComplete: 1000, removeOnFail: 100 },
        );
        dispatched++;
      } catch (err) {
        logger.warn({ err, outboxId: row.id }, 'outbox dispatch failed');
      }
    }
    return dispatched;
  }
  ```

### 4. Deterministic Job Cancellation (Redis Optimization)
* **`api/src/workers/notification-schedule.ts` & `api/src/services/households/household-reminders.ts`**:
  Instead of calling `sendQ.getJobs(['delayed', 'waiting'])` (which fetches all jobs in Redis), cancel existing jobs by deterministic IDs:
  ```typescript
  const sendQ = notificationSendQueue();
  const existingNotifyAt = (record.notifyAt as string[]) ?? [];
  for (const isoTs of existingNotifyAt) {
    const jobId = record.householdId
      ? `send__${record.id}__${userId}__${isoTs}`
      : `send__${record.id}__${isoTs}`;
    const job = await sendQ.getJob(jobId);
    if (job) await job.remove();
  }
  ```

### 5. Recurring Outbox Sweeper
* **`api/src/workers/runner.ts`**:
  Register recurring outbox worker poller:
  ```typescript
  export function startWorkers(): Worker[] {
    // ... existing workers ...
    // Start periodic outbox sweeper (every 60s)
    const outboxInterval = setInterval(() => {
      void sweepOutbox();
    }, 60_000);
    outboxInterval.unref();
  }
  ```

---

## Related Code Files
- Modify: `api/src/workers/notification-send.ts`
- Modify: `api/src/workers/notification-schedule.ts`
- Modify: `api/src/services/records/sync.ts`
- Modify: `api/src/services/notifications/outbox.ts`
- Modify: `api/src/services/households/household-reminders.ts`
- Modify: `api/src/routes/records/delete.ts`
- Modify: `api/src/workers/runner.ts`
- Modify: `api/prisma/seed.ts`
- Test: `api/tests/unit/workers-notification-send.test.ts`
- Test: `api/tests/unit/workers-notification-schedule.test.ts`
- Test: `api/tests/unit/records-sync-notifications.test.ts`

---

## Implementation Steps
1. Refactor `processSendJob` in `notification-send.ts` to support both record expiry and giveaway notification keys with safe replacers and privacy preference support.
2. Add batch notification schedule enqueuing with `addBulk` in `api/src/services/records/sync.ts`.
3. Add atomic `updateMany` claim in `api/src/services/notifications/outbox.ts`.
4. Replace unbounded `getJobs` scans with deterministic job retrieval and removal across schedule and delete flows.
5. Add recurring outbox sweeper in `runner.ts`.
6. Add default template seed data in `seed.ts` and run migration/seed.
7. Write unit tests for giveaway dispatch, template rendering, and sync notification scheduling.

---

## Success Criteria
- [ ] Giveaway claims and status updates successfully dispatch push notifications without being dropped.
- [ ] Special replacement characters in item names do not corrupt template rendering.
- [ ] Records synchronized from offline mobile clients schedule delayed notification jobs in BullMQ via `addBulk`.
- [ ] Record deletion and rescheduling cancel specific jobs without scanning all Redis delayed keys.
- [ ] Outbox table entries are processed automatically within 60 seconds without race conditions.

---

## Risk Assessment
- **Redis connection limits:** `addBulk` batches all pipeline operations into 1 network round-trip, significantly reducing latency during large syncs.
