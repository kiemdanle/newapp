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
  const html = [
    `<h1 style="margin:0 0 16px;font-size:20px;line-height:1.3;">${safeTitle}</h1>`,
    `<p style="margin:0 0 24px;font-size:15px;line-height:1.5;">${safeBody}</p>`,
    `<p style="margin:0;"><a href="${safeUrl}" style="display:inline-block;padding:12px 20px;background-color:#4BAE8A;color:#FAFAF8;text-decoration:none;border-radius:6px;font-weight:600;">Review moderation queue</a></p>`,
  ].join('');
  return { subject: title, html, text };
}
