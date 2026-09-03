import { describe, expect, it, afterEach } from 'vitest';
import { getPrisma } from '../../db.js';
import { makeUser } from '../../../tests/helpers/factories.js';
import { makeAdmin } from '../../../tests/helpers/admin.js';
import {
  dispatchFeedbackAdminAlertOutbox,
} from './admin-alert-outbox.js';
import {
  setSimulateSmtpFailureForTests,
  resetAlertTransportForTests,
} from './admin-alert.js';

afterEach(() => {
  resetAlertTransportForTests();
});

describe('Feedback Admin Alert Outbox', () => {
  it('handles empty outbox cleanly', async () => {
    const result = await dispatchFeedbackAdminAlertOutbox();
    expect(result.claimed).toBe(0);
    expect(result.sent).toBe(0);
  });

  it('claims pending outbox rows and routes to active admin emails', async () => {
    const prisma = getPrisma();
    const user = await makeUser({ emailVerified: true });
    const { admin } = await makeAdmin();

    const ticket = await prisma.feedbackTicket.create({
      data: {
        userId: user.id,
        type: 'bug',
        title: 'Outbox Test Bug',
        description: 'Test description for outbox dispatch',
        status: 'open',
      },
    });

    const outboxRow = await prisma.feedbackAdminAlertOutbox.create({
      data: {
        ticketId: ticket.id,
        status: 'pending',
      },
    });

    const result = await dispatchFeedbackAdminAlertOutbox();
    expect(result.claimed).toBeGreaterThanOrEqual(1);
    expect(result.sent).toBeGreaterThanOrEqual(1);

    const refreshed = await prisma.feedbackAdminAlertOutbox.findUniqueOrThrow({
      where: { id: outboxRow.id },
    });
    expect(refreshed.status).toBe('sent');
    expect(refreshed.dispatchedAt).toBeDefined();
    expect(refreshed.attempts).toBe(1);
    expect(refreshed.lastError).toBeNull();
  });

  it('retains pending status and logs error on SMTP delivery failure, then recovers on retry', async () => {
    const prisma = getPrisma();
    const user = await makeUser({ emailVerified: true });
    await makeAdmin();

    const ticket = await prisma.feedbackTicket.create({
      data: {
        userId: user.id,
        type: 'bug',
        title: 'Failing Delivery Bug',
        description: 'Testing failure handling',
        status: 'open',
      },
    });

    const outboxRow = await prisma.feedbackAdminAlertOutbox.create({
      data: {
        ticketId: ticket.id,
        status: 'pending',
      },
    });

    // 1. Simulate failure
    setSimulateSmtpFailureForTests(true);
    const failResult = await dispatchFeedbackAdminAlertOutbox();
    expect(failResult.failed).toBeGreaterThanOrEqual(1);

    const failedRow = await prisma.feedbackAdminAlertOutbox.findUniqueOrThrow({
      where: { id: outboxRow.id },
    });
    expect(failedRow.status).toBe('pending');
    expect(failedRow.attempts).toBe(1);
    expect(failedRow.lastError).toContain('Simulated SMTP');
    expect(failedRow.dispatchedAt).toBeNull();

    // 2. Clear failure simulation and run dispatch again to test retry recovery
    setSimulateSmtpFailureForTests(false);
    const retryResult = await dispatchFeedbackAdminAlertOutbox();
    expect(retryResult.sent).toBeGreaterThanOrEqual(1);

    const recoveredRow = await prisma.feedbackAdminAlertOutbox.findUniqueOrThrow({
      where: { id: outboxRow.id },
    });
    expect(recoveredRow.status).toBe('sent');
    expect(recoveredRow.attempts).toBe(2);
    expect(recoveredRow.dispatchedAt).toBeDefined();
    expect(recoveredRow.lastError).toBeNull();
  });
});
