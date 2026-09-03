import { getPrisma } from '../../db.js';
import { getConfig } from '../../config.js';
import { logger } from '../../logger.js';
import { sendAdminFeedbackAlertEmail } from './admin-alert.js';
const MAX_ALERT_ATTEMPTS = 5;

export interface DispatchFeedbackAdminAlertsResult {
  claimed: number;
  sent: number;
  failed: number;
}

/**
 * Claims pending feedback admin alert outbox rows, queries active admins,
 * sends the formatted HTML alert email, and stamps the row as sent.
 * Atomic claim ensures concurrent pollers cannot duplicate email delivery.
 */
export async function dispatchFeedbackAdminAlertOutbox(
  limit = 20,
): Promise<DispatchFeedbackAdminAlertsResult> {
  const prisma = getPrisma();

  const pendingRows = await prisma.feedbackAdminAlertOutbox.findMany({
    where: { status: 'pending' },
    orderBy: { createdAt: 'asc' },
    take: limit,
    include: {
      ticket: {
        include: { user: true },
      },
    },
  });

  const result: DispatchFeedbackAdminAlertsResult = {
    claimed: pendingRows.length,
    sent: 0,
    failed: 0,
  };

  if (pendingRows.length === 0) return result;

  // Query all active admins
  const admins = await prisma.user.findMany({
    where: { role: 'admin', status: 'active' },
    select: { email: true, firstName: true },
  });
  const recipientEmails = admins.map((a) => a.email).filter(Boolean);

  for (const row of pendingRows) {
    // Atomically increment attempts to prevent duplicate processing
    const updated = await prisma.feedbackAdminAlertOutbox.updateMany({
      where: { id: row.id, status: 'pending' },
      data: {
        attempts: { increment: 1 },
      },
    });
    if (updated.count === 0) continue;

    const ticket = row.ticket;
    const reporter = ticket.user;
    const reporterName = [reporter.firstName, reporter.lastName].filter(Boolean).join(' ');

    try {
      if (recipientEmails.length === 0) {
        logger.warn(
          { ticketId: ticket.id },
          'No active admins found; dispatching feedback alert to fallback SMTP_FROM',
        );
      }

      const cfg = getConfig();
      const targets = recipientEmails.length > 0 ? recipientEmails : [cfg.smtp.from];

      for (const target of targets) {
        const sendRes = await sendAdminFeedbackAlertEmail({
          ticketId: ticket.id,
          type: ticket.type,
          title: ticket.title,
          description: ticket.description,
          reporterEmail: reporter.email,
          reporterName,
          to: target,
        });
        if (!sendRes.sent) {
          throw new Error(`Failed to deliver admin alert to ${target}`);
        }
      }
      await prisma.feedbackAdminAlertOutbox.update({
        where: { id: row.id },
        data: {
          status: 'sent',
          dispatchedAt: new Date(),
          lastError: null,
        },
      });

      result.sent++;
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.error(
        { err, outboxId: row.id, ticketId: ticket.id },
        'Failed to dispatch feedback admin alert email',
      );

      const nextAttempts = row.attempts + 1;
      const isFailed = nextAttempts >= MAX_ALERT_ATTEMPTS;

      await prisma.feedbackAdminAlertOutbox.update({
        where: { id: row.id },
        data: {
          status: isFailed ? 'failed' : 'pending',
          lastError: errorMsg,
        },
      });

      result.failed++;
    }
  }

  return result;
}

let _pollerInterval: NodeJS.Timeout | null = null;

export function startFeedbackAdminAlertPoller(): void {
  if (_pollerInterval) return;
  _pollerInterval = setInterval(() => {
    void dispatchFeedbackAdminAlertOutbox().catch((err) => {
      logger.error({ err }, 'Error in feedback admin alert poller');
    });
  }, 30_000);
  _pollerInterval.unref();
}

export function stopFeedbackAdminAlertPoller(): void {
  if (_pollerInterval) {
    clearInterval(_pollerInterval);
    _pollerInterval = null;
  }
}
