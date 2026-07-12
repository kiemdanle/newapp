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

export async function sendVerificationEmail(to: string, code: string): Promise<void> {
  const cfg = getConfig();
  if (cfg.env === 'test') {
    logger.info({ to, code }, 'TEST: would send verification email');
    return;
  }
  await getTransport().sendMail({
    from: cfg.smtp.from,
    to,
    subject: 'Verify your Expyrico email',
    text: `Your Expyrico verification code is ${code}. It expires in 10 minutes.\n\nIf you didn't create an account, ignore this email.`,
    html: `<p>Your Expyrico verification code is <strong style="font-size:24px;letter-spacing:4px">${code}</strong>.</p><p>It expires in 10 minutes.</p><p style="color:#8C8C85;font-size:13px;margin-top:16px">If you didn't create an account, you can safely ignore this email.</p>`,
  });
}

export async function sendPasswordResetCodeEmail(to: string, code: string): Promise<void> {
  const cfg = getConfig();
  if (cfg.env === 'test') {
    // Never log the raw code — tests read it from the mocked module, not logs.
    logger.info({ to }, 'TEST: would send password reset code email');
    return;
  }
  await getTransport().sendMail({
    from: cfg.smtp.from,
    to,
    subject: 'Reset your Expyrico password',
    text: `Your Expyrico password reset code is ${code}. It expires in 10 minutes.\n\nIf you didn't request this, ignore this email.`,
    html: `<p>Your Expyrico password reset code is <strong style="font-size:24px;letter-spacing:4px">${code}</strong>.</p><p>It expires in 10 minutes.</p><p style="color:#8C8C85;font-size:13px;margin-top:16px">If you didn't request this, you can safely ignore this email.</p>`,
  });
}
