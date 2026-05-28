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
  const link = `${cfg.frontend.adminUrl.replace('admin.', 'app.')}/verify-email?token=${encodeURIComponent(token)}`;
  const fallbackDeepLink = `${cfg.frontend.appDeepLink}verify-email?token=${encodeURIComponent(token)}`;
  if (cfg.env === 'test') {
    logger.info({ to, link }, 'TEST: would send verification email');
    return;
  }
  await getTransport().sendMail({
    from: cfg.smtp.from,
    to,
    subject: 'Verify your Pantry email',
    text: `Verify your email by opening this link: ${link}\n\nOr in the app: ${fallbackDeepLink}`,
    html: `<p>Verify your email by clicking <a href="${link}">this link</a>.</p><p>Or open in the app: <a href="${fallbackDeepLink}">${fallbackDeepLink}</a></p>`,
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
    subject: 'Reset your Pantry password',
    text: `Reset your password: ${link}\n\nIf you didn't request this, ignore this email.`,
    html: `<p>Reset your password: <a href="${link}">${link}</a></p>`,
  });
}
