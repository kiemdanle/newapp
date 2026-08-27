import { AppError } from '../../errors.js';
import { ERROR_CODES } from '@expyrico/shared';

export const MODERATION_QUEUE_TEMPLATE_KEY = 'moderation_queue';

// The moderation summary is deliberately count-only: the template may reference
// exactly these server-derived integer placeholders and nothing else. Keeping the
// allowlist this small is what lets the renderer prove the final copy can never
// carry creator PII, product names, tokens, or URLs.
const ALLOWED_PLACEHOLDERS = new Set(['newProducts', 'revisions', 'total']);
const PLACEHOLDER_PATTERN = /\{([a-zA-Z][a-zA-Z0-9]*)\}/g;

const MAX_TITLE_LENGTH = 120;
const MAX_BODY_LENGTH = 500;

// Reject anything that could become markup or a navigable target once rendered:
// angle brackets (tags), and URL syntax (scheme, protocol-relative, or a bare
// `www.` host). The only link in the final output is constructed server-side.
const FORBIDDEN_CONTENT = /[<>]|\b(?:https?|ftp|mailto|javascript|data):|\/\/|\bwww\./i;

function assertPlainTextField(field: 'title' | 'body', value: string, maxLength: number): void {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new AppError({ status: 400, code: ERROR_CODES.VALIDATION, title: `The moderation template ${field} cannot be empty` });
  }
  if (value.length > maxLength) {
    throw new AppError({
      status: 400,
      code: ERROR_CODES.VALIDATION,
      title: `The moderation template ${field} must be ${maxLength} characters or fewer`,
    });
  }
  if (FORBIDDEN_CONTENT.test(value)) {
    throw new AppError({
      status: 400,
      code: ERROR_CODES.VALIDATION,
      title: `The moderation template ${field} must be plain text with no links or markup`,
    });
  }
}

function assertAllowedPlaceholders(field: 'title' | 'body', value: string): void {
  const placeholders = [...value.matchAll(PLACEHOLDER_PATTERN)];
  const recognizedText = placeholders.map((match) => match[0]).join('');
  if ((value.match(/[{}]/g)?.length ?? 0) !== (recognizedText.match(/[{}]/g)?.length ?? 0)) {
    throw new AppError({
      status: 400,
      code: ERROR_CODES.VALIDATION,
      title: `The moderation template ${field} contains an incomplete placeholder`,
    });
  }
  for (const match of placeholders) {
    if (!ALLOWED_PLACEHOLDERS.has(match[1]!)) {
      throw new AppError({
        status: 400,
        code: ERROR_CODES.VALIDATION,
        title: `The moderation template ${field} only supports {newProducts}, {revisions}, and {total}`,
      });
    }
  }
}

/**
 * Keyed validation applied only to the `moderation_queue` template. Existing
 * templates (expiry reminders with `{name}`/`{date}`) are validated by the
 * generic bounds in the shared schema and never pass through here.
 */
export function assertValidModerationTemplatePatch(patch: { title?: string | undefined; body?: string | undefined }): void {
  if (patch.title !== undefined) {
    assertPlainTextField('title', patch.title, MAX_TITLE_LENGTH);
    assertAllowedPlaceholders('title', patch.title);
  }
  if (patch.body !== undefined) {
    assertPlainTextField('body', patch.body, MAX_BODY_LENGTH);
    assertAllowedPlaceholders('body', patch.body);
    if (!patch.body.includes('{total}')) {
      throw new AppError({
        status: 400,
        code: ERROR_CODES.VALIDATION,
        title: 'The moderation template body must include the {total} placeholder',
      });
    }
  }
}

export type ModerationQueueCounts = {
  newProducts: number;
  revisions: number;
};

function substitute(template: string, counts: ModerationQueueCounts): string {
  const total = counts.newProducts + counts.revisions;
  return template.replace(PLACEHOLDER_PATTERN, (_, name: string) => {
    if (name === 'newProducts') return String(counts.newProducts);
    if (name === 'revisions') return String(counts.revisions);
    if (name === 'total') return String(total);
    // Unreachable for validated templates, but render defensively: an
    // unrecognized placeholder collapses to empty rather than leaking through.
    return '';
  });
}

/** Plain-text rendering for the push body. */
export function renderModerationTemplateText(template: { title: string; body: string }, counts: ModerationQueueCounts): { title: string; body: string } {
  return { title: substitute(template.title, counts), body: substitute(template.body, counts) };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * HTML rendering for email: every character of template text is escaped, and the
 * single anchor is built from the server-owned canonical queue URL — never from
 * template content.
 */
export function renderModerationTemplateHtml(
  template: { title: string; body: string },
  counts: ModerationQueueCounts,
  queueUrl: string,
): { subject: string; html: string; text: string } {
  const { title, body } = renderModerationTemplateText(template, counts);
  const safeTitle = escapeHtml(title);
  const safeBody = escapeHtml(body);
  const safeUrl = escapeHtml(queueUrl);
  const text = `${title}\n\n${body}\n\nReview the moderation queue: ${queueUrl}`;

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${safeTitle}</title>
  </head>
  <body style="margin:0;padding:0;background-color:#FAFAF8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#2C2C28;-webkit-font-smoothing:antialiased;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#FAFAF8;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:540px;background-color:#FFFFFF;border:1px solid #E5E5E0;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(44,44,40,0.04);">
            <!-- Brand Header -->
            <tr>
              <td style="padding:24px 32px;border-bottom:1px solid #F0F0ED;background-color:#FFFFFF;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td>
                      <span style="font-size:18px;font-weight:700;color:#2C2C28;letter-spacing:-0.02em;">expyrico <span style="font-weight:500;color:#8C8C85;">Admin</span></span>
                    </td>
                    <td align="right">
                      <span style="display:inline-block;padding:4px 10px;background-color:#D6F0E6;color:#3A8F6F;font-size:11px;font-weight:700;border-radius:20px;text-transform:uppercase;letter-spacing:0.05em;">Moderation Alert</span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Content Area -->
            <tr>
              <td style="padding:32px;">
                <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;line-height:1.3;color:#2C2C28;">
                  ${safeTitle}
                </h1>
                <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#555550;">
                  ${safeBody}
                </p>

                <!-- Counts Breakdown Card -->
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#FAFAF8;border:1px solid #F0F0ED;border-radius:12px;margin-bottom:28px;">
                  <tr>
                    <td style="padding:16px;text-align:center;border-right:1px solid #F0F0ED;width:33%;">
                      <div style="font-size:11px;font-weight:700;color:#8C8C85;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px;">New Products</div>
                      <div style="font-size:20px;font-weight:700;color:#2C2C28;">${counts.newProducts}</div>
                    </td>
                    <td style="padding:16px;text-align:center;border-right:1px solid #F0F0ED;width:33%;">
                      <div style="font-size:11px;font-weight:700;color:#8C8C85;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px;">Revisions</div>
                      <div style="font-size:20px;font-weight:700;color:#2C2C28;">${counts.revisions}</div>
                    </td>
                    <td style="padding:16px;text-align:center;width:34%;">
                      <div style="font-size:11px;font-weight:700;color:#8C8C85;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px;">Total Items</div>
                      <div style="font-size:20px;font-weight:700;color:#4BAE8A;">${counts.newProducts + counts.revisions}</div>
                    </td>
                  </tr>
                </table>

                <!-- Action Button -->
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td align="center">
                      <a href="${safeUrl}" style="display:inline-block;padding:14px 28px;background-color:#4BAE8A;color:#FFFFFF;text-decoration:none;border-radius:10px;font-size:15px;font-weight:600;box-shadow:0 1px 3px rgba(75,174,138,0.3);">
                        Review Moderation Queue &rarr;
                      </a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Footer Note -->
            <tr>
              <td style="padding:20px 32px;background-color:#FAFAF8;border-top:1px solid #F0F0ED;text-align:center;">
                <p style="margin:0;font-size:12px;color:#8C8C85;line-height:1.5;">
                  You received this email because your account has administrator privileges on Expyrico.<br />
                  <a href="${safeUrl}" style="color:#4BAE8A;text-decoration:none;font-weight:500;">Go to Admin Console</a>
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { subject: title, html, text };
}
