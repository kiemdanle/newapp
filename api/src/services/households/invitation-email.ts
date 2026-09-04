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
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
    ...(cfg.smtp.user ? { auth: { user: cfg.smtp.user, pass: cfg.smtp.pass } } : {}),
  });
  return _transport;
}

const PALETTE = {
  primary: '#4BAE8A',
  primaryDark: '#3A8F6F',
  primaryLight: '#D6F0E6',
  bg: '#FAFAF8',
  stone: '#F0F0ED',
  pebble: '#8C8C85',
  ink: '#2C2C28',
} as const;

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function sendHouseholdInvitationEmail(params: {
  to: string;
  inviterName: string;
  householdName: string;
  token: string;
}): Promise<void> {
  const cfg = getConfig();
  const acceptUrl = `https://expyrico.com/household/invite?token=${encodeURIComponent(params.token)}`;
  const subject = `${params.inviterName} invited you to join ${params.householdName} on Expyrico`;

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(subject)}</title>
  </head>
  <body style="margin:0; padding:0; background-color:${PALETTE.bg}; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color:${PALETTE.ink};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${PALETTE.bg}; padding:40px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px; background-color:#FFFFFF; border:1px solid ${PALETTE.stone}; border-radius:16px; overflow:hidden; padding:32px;">
            <tr>
              <td align="center">
                <h1 style="margin:0 0 12px; font-size:20px; font-weight:700; color:${PALETTE.primaryDark};">Shared Pantry Invitation</h1>
                <p style="margin:0 0 24px; font-size:15px; line-height:22px; color:${PALETTE.ink};">
                  <strong>${escapeHtml(params.inviterName)}</strong> has invited you to join <strong>${escapeHtml(params.householdName)}</strong>.
                </p>
                <div style="background-color:${PALETTE.primaryLight}; padding:16px; border-radius:12px; margin-bottom:24px; text-align:left;">
                  <p style="margin:0; font-size:13px; line-height:18px; color:${PALETTE.primaryDark};">
                    Joining lets you share grocery tracking, collaborate on pantries, and receive expiry reminders together.
                  </p>
                </div>
                <a href="${acceptUrl}" style="display:inline-block; background-color:${PALETTE.primary}; color:#FFFFFF; padding:14px 28px; border-radius:12px; text-decoration:none; font-weight:700; font-size:15px;">
                  Accept Invitation
                </a>
                <p style="margin:24px 0 0; font-size:12px; color:${PALETTE.pebble};">
                  This invitation expires in 7 days. If you did not expect this invite, you can safely ignore this email.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  try {
    await getTransport().sendMail({
      from: cfg.smtp.from,
      to: params.to,
      subject,
      html,
    });
  } catch (err) {
    logger.error({ err, to: params.to }, 'Failed to send household invitation email');
  }
}

export async function sendHouseholdJoinedConfirmationEmail(params: {
  to: string;
  householdName: string;
}): Promise<void> {
  const cfg = getConfig();
  const subject = `Welcome to ${params.householdName}'s shared pantry!`;

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(subject)}</title>
  </head>
  <body style="margin:0; padding:0; background-color:${PALETTE.bg}; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color:${PALETTE.ink};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${PALETTE.bg}; padding:40px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px; background-color:#FFFFFF; border:1px solid ${PALETTE.stone}; border-radius:16px; overflow:hidden; padding:32px;">
            <tr>
              <td align="center">
                <h1 style="margin:0 0 12px; font-size:20px; font-weight:700; color:${PALETTE.primaryDark};">You've Joined the Household!</h1>
                <p style="margin:0 0 24px; font-size:15px; line-height:22px; color:${PALETTE.ink};">
                  You are now an active member of <strong>${escapeHtml(params.householdName)}</strong>.
                </p>
                <div style="background-color:${PALETTE.primaryLight}; padding:16px; border-radius:12px; margin-bottom:24px; text-align:left;">
                  <p style="margin:0; font-size:13px; line-height:18px; color:${PALETTE.primaryDark};">
                    You can now view all shared grocery items, add new items directly to this household, and receive shared expiry alerts.
                  </p>
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  try {
    await getTransport().sendMail({
      from: cfg.smtp.from,
      to: params.to,
      subject,
      html,
    });
  } catch (err) {
    logger.error({ err, to: params.to }, 'Failed to send household confirmation email');
  }
}
