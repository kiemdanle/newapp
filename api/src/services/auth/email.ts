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

// Expyrico brand palette (§ design system). Kept inline because email clients
// strip <style> and external CSS — every colour must live on the element.
const PALETTE = {
  primary: '#4BAE8A', // Fresh Sage
  primaryDark: '#3A8F6F', // Deep Sage
  primaryLight: '#D6F0E6', // Mint Mist
  bg: '#FAFAF8', // Warm White
  accent: '#F5A623', // Honey
  accentLight: '#FEEFC3', // Soft Butter
  stone: '#F0F0ED', // Neutral Light
  pebble: '#8C8C85', // Neutral Mid
  ink: '#2C2C28', // Almost Black
} as const;

interface CodeEmailParts {
  /** Card heading, e.g. "Verify your email". */
  heading: string;
  /** One-line lead under the heading. */
  intro: string;
  /** The 6-digit code. */
  code: string;
  /** Small reassurance line in the footer. */
  footnote: string;
}

/**
 * Professional, client-safe HTML for a one-time-code email. Table-based layout
 * with fully inline styles (Gmail/Outlook strip <style> and class selectors),
 * built on the Expyrico palette so it reads as the same brand as the app.
 */
function codeEmailHtml({ heading, intro, code, footnote }: CodeEmailParts): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light" />
    <title>${heading}</title>
  </head>
  <body style="margin:0; padding:0; background-color:${PALETTE.bg}; -webkit-text-size-adjust:100%;">
    <div style="display:none; max-height:0; overflow:hidden; opacity:0;">Your Expyrico code is ${code} — expires in 10 minutes.</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${PALETTE.bg};">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px; background-color:#FFFFFF; border:1px solid ${PALETTE.stone}; border-radius:16px; overflow:hidden;">
            <!-- Brand bar -->
            <tr>
              <td style="background-color:${PALETTE.primary}; padding:20px 32px;">
                <span style="font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif; font-size:20px; font-weight:600; letter-spacing:0.5px; color:#FFFFFF;">expyrico</span>
              </td>
            </tr>
            <!-- Heading + intro -->
            <tr>
              <td style="padding:32px 32px 0; font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
                <h1 style="margin:0; font-size:22px; line-height:28px; font-weight:600; color:${PALETTE.ink};">${heading}</h1>
                <p style="margin:12px 0 0; font-size:15px; line-height:22px; color:${PALETTE.pebble};">${intro}</p>
              </td>
            </tr>
            <!-- Code panel -->
            <tr>
              <td style="padding:24px 32px 8px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${PALETTE.primaryLight}; border:1px solid ${PALETTE.primary}; border-radius:12px;">
                  <tr>
                    <td align="center" style="padding:22px 16px; font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif; font-size:34px; font-weight:700; letter-spacing:10px; color:${PALETTE.primaryDark};">${code}</td>
                  </tr>
                </table>
              </td>
            </tr>
            <!-- Expiry pill -->
            <tr>
              <td align="center" style="padding:8px 32px 28px;">
                <span style="display:inline-block; background-color:${PALETTE.accentLight}; color:${PALETTE.ink}; font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif; font-size:13px; font-weight:600; padding:7px 14px; border-radius:999px;">⏱ This code expires in 10 minutes</span>
              </td>
            </tr>
            <!-- Footer -->
            <tr>
              <td style="border-top:1px solid ${PALETTE.stone}; padding:20px 32px 28px; font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
                <p style="margin:0; font-size:13px; line-height:20px; color:${PALETTE.pebble};">${footnote}</p>
                <p style="margin:12px 0 0; font-size:12px; line-height:18px; color:${PALETTE.pebble};">© Expyrico · Fresh food, tracked.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
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
    text: `Welcome to Expyrico!\n\nYour verification code is ${code}. It expires in 10 minutes.\n\nEnter it in the app to finish setting up your account. If you didn't create an account, you can safely ignore this email.`,
    html: codeEmailHtml({
      heading: 'Verify your email',
      intro: 'Enter this code in the Expyrico app to finish setting up your account.',
      code,
      footnote: "Didn't create an Expyrico account? You can safely ignore this email — no account will be created.",
    }),
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
    text: `Reset your Expyrico password.\n\nYour reset code is ${code}. It expires in 10 minutes.\n\nEnter it in the app to choose a new password. If you didn't request this, you can safely ignore this email — your password won't change.`,
    html: codeEmailHtml({
      heading: 'Reset your password',
      intro: 'Enter this code in the Expyrico app to choose a new password.',
      code,
      footnote: "Didn't request a password reset? You can safely ignore this email — your password won't change.",
    }),
  });
}
