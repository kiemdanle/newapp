import { createTransport, type Transporter } from 'nodemailer';
import { getConfig } from '../../config.js';
import { logger } from '../../logger.js';

let _transport: Transporter | null = null;
let _simulateSmtpFailureForTests = false;

export function setSimulateSmtpFailureForTests(fail: boolean): void {
  _simulateSmtpFailureForTests = fail;
}

function getAlertTransport(): Transporter {
  if (_transport) return _transport;
  const cfg = getConfig();
  _transport = createTransport({
    host: cfg.smtp.host,
    port: cfg.smtp.port,
    secure: cfg.smtp.port === 465,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
    ...(cfg.smtp.user ? { auth: { user: cfg.smtp.user, pass: cfg.smtp.pass } } : {}),
  });
  return _transport;
}

export function resetAlertTransportForTests(): void {
  _transport = null;
  _simulateSmtpFailureForTests = false;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export interface SendAdminFeedbackAlertEmailInput {
  ticketId: string;
  type: string;
  title: string;
  description: string;
  reporterEmail: string;
  reporterName?: string;
  to: string;
}

export async function sendAdminFeedbackAlertEmail(
  input: SendAdminFeedbackAlertEmailInput,
): Promise<{ sent: boolean; messageId?: string | null; to: string }> {
  const cfg = getConfig();
  const safeTicketId = encodeURIComponent(input.ticketId.trim());
  const directLink = `${cfg.frontend.adminUrl}/feedback/${safeTicketId}`;
  const safeSubjectTitle = input.title.replace(/[\r\n]/g, ' ').trim();
  const subject = `[Expyrico ${input.type.toUpperCase()}] ${safeSubjectTitle}`;

  const safeType = escapeHtml(input.type);
  const safeTitle = escapeHtml(input.title);
  const safeDesc = escapeHtml(input.description);
  const safeReporterEmail = escapeHtml(input.reporterEmail);
  const safeReporterName = input.reporterName ? escapeHtml(input.reporterName) : safeReporterEmail;

  logger.info(
    { ticketId: input.ticketId, type: input.type, to: input.to, reporter: input.reporterEmail },
    'Dispatching admin feedback alert email',
  );

  if (cfg.env === 'test') {
    if (_simulateSmtpFailureForTests) {
      throw new Error('Simulated SMTP transport connection failure for testing');
    }
    return { sent: true, messageId: 'test-mock-id', to: input.to };
  }

  const transport = getAlertTransport();
  const result = await transport.sendMail({
    from: cfg.smtp.from,
    to: input.to,
    subject,
    text: `New ${input.type.toUpperCase()} submitted by ${input.reporterName || input.reporterEmail} (${input.reporterEmail}):\n\n${input.title}\n\n${input.description}\n\nView case in Admin Console: ${directLink}`,
    html: `
      <!doctype html>
      <html>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #FAFAF8; padding: 24px; color: #2C2C28;">
          <div style="max-width: 560px; margin: 0 auto; background-color: #FFFFFF; border-radius: 16px; border: 1px solid #F0F0ED; padding: 24px;">
            <span style="display: inline-block; background-color: #D6F0E6; color: #3A8F6F; padding: 4px 10px; border-radius: 9999px; font-size: 12px; font-weight: bold; text-transform: uppercase;">
              ${safeType}
            </span>
            <h2 style="margin-top: 12px; margin-bottom: 8px; color: #2C2C28;">${safeTitle}</h2>
            <p style="font-size: 13px; color: #8C8C85; margin-bottom: 16px;">
              Submitted by <strong>${safeReporterName}</strong> (${safeReporterEmail})
            </p>
            <div style="background-color: #FAFAF8; border-radius: 12px; padding: 16px; font-size: 14px; line-height: 1.5; color: #2C2C28; margin-bottom: 24px; white-space: pre-wrap;">
${safeDesc}
            </div>
            <a href="${directLink}" style="display: inline-block; background-color: #4BAE8A; color: #FFFFFF; text-decoration: none; padding: 10px 20px; border-radius: 12px; font-weight: bold; font-size: 14px;">
              View in Admin Console →
            </a>
          </div>
        </body>
      </html>
    `,
  });

  return { sent: true, messageId: result.messageId, to: input.to };
}
