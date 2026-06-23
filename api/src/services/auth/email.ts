import { createTransport, type Transporter } from 'nodemailer';
import { getConfig } from '../../config.js';
import { logger } from '../../logger.js';

let _transport: Transporter | null = null;

function getTransport(): Transporter {
  if (_transport) return _transport;
  const cfg = getConfig();
  _transport = createTransport({
    host: cfg.smtp.host,
    port: cfg.smtp.port,
    secure: cfg.smtp.port === 465,
    ...(cfg.smtp.user ? { auth: { user: cfg.smtp.user, pass: cfg.smtp.pass } } : {}),
  });
  return _transport;
}

export async function sendVerificationEmail(to: string, token: string): Promise<void> {
  const cfg = getConfig();
  // Primary link: app deep link — opens the Expyrico mobile app directly.
  const link = `${cfg.frontend.appDeepLink}verify-email?token=${encodeURIComponent(token)}`;
  if (cfg.env === 'test') {
    logger.info({ to, link }, 'TEST: would send verification email');
    return;
  }
  await getTransport().sendMail({
    from: cfg.smtp.from,
    to,
    subject: 'Verify your Expyrico email',
    text: `Verify your email by opening this link in the Expyrico app: ${link}\n\nIf you didn't create an account, ignore this email.`,
    html: `<p>Verify your email by opening <a href="${link}">this link</a> in the Expyrico app.</p><p style="color:#8C8C85;font-size:13px;margin-top:16px">If you didn't create an account, you can safely ignore this email.</p>`,
  });
}

export async function sendPasswordResetEmail(to: string, token: string): Promise<void> {
  const cfg = getConfig();
  const link = `${cfg.frontend.appDeepLink}reset-password?token=${encodeURIComponent(token)}`;
  if (cfg.env === 'test') {
    logger.info({ to, link }, 'TEST: would send password reset email');
    return;
  }
  await getTransport().sendMail({
    from: cfg.smtp.from,
    to,
    subject: 'Reset your Expyrico password',
    text: `Reset your password: ${link}\n\nIf you didn't request this, ignore this email.`,
    html: `<p>Reset your password: <a href="${link}">${link}</a></p>`,
  });
}
