import { createTransport, type Transporter } from 'nodemailer';
import { getConfig } from '../../config.js';
import { renderModerationTemplateHtml, type ModerationQueueCounts } from './moderation-template.js';

const SMTP_DEADLINE_MS = 30_000;

let _transport: Transporter | null = null;

function moderationTransport(): Transporter {
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

function withDeadline<T>(promise: Promise<T>, timeoutMs: number, abort: () => void): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => {
      // Nodemailer has no AbortSignal for sendMail. Closing this transport tears
      // down its socket so a timed-out request cannot keep running after the
      // fenced delivery lease is released for recovery.
      abort();
      reject(new Error('moderation email deadline exceeded'));
    }, timeoutMs);
    timeout.unref();
    promise.then(
      (value) => {
        clearTimeout(timeout);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timeout);
        reject(error);
      },
    );
  });
}

/**
 * Sends the count-only moderation email through a timeout-bound SMTP transport.
 * The recipient address is passed directly to nodemailer and is intentionally
 * never logged or stored in the moderation delivery ledger.
 */
export async function sendModerationQueueEmail(input: {
  to: string;
  template: { title: string; body: string };
  counts: ModerationQueueCounts;
  queueUrl: string;
}): Promise<{ messageId: string | null }> {
  const cfg = getConfig();
  const rendered = renderModerationTemplateHtml(input.template, input.counts, input.queueUrl);
  if (cfg.env === 'test') return { messageId: null };
  const transport = moderationTransport();
  const result = await withDeadline(
    transport.sendMail({
      from: cfg.smtp.from,
      to: input.to,
      subject: rendered.subject,
      text: rendered.text,
      html: rendered.html,
    }),
    SMTP_DEADLINE_MS,
    () => {
      transport.close();
      _transport = null;
    },
  );
  return { messageId: result.messageId ?? null };
}

export function resetModerationEmailTransportForTests(): void {
  _transport = null;
}
