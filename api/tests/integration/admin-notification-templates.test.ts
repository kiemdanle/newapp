import { describe, expect, it } from 'vitest';
import { buildServer } from '../../src/server.js';
import { getPrisma } from '../../src/db.js';
import { makeAdmin } from '../helpers/admin.js';

const BASE = '/v1/admin/settings/notification-templates';

async function seedTemplates() {
  const prisma = getPrisma();
  const expiry = await prisma.notificationTemplate.upsert({
    where: { key: 'expiry_7d' },
    update: { title: 'Expires in 7 days', body: '{name} expires on {date}.' },
    create: { key: 'expiry_7d', title: 'Expires in 7 days', body: '{name} expires on {date}.' },
  });
  const moderation = await prisma.notificationTemplate.upsert({
    where: { key: 'moderation_queue' },
    update: {
      title: 'Moderation queue needs review',
      body: '{total} new moderation item(s) awaiting review: {newProducts} new product(s), {revisions} revision(s).',
    },
    create: {
      key: 'moderation_queue',
      title: 'Moderation queue needs review',
      body: '{total} new moderation item(s) awaiting review: {newProducts} new product(s), {revisions} revision(s).',
    },
  });
  return { expiry, moderation };
}

describe.sequential('PATCH /v1/admin/settings/notification-templates/:id', () => {
  it('applies generic bounds to non-moderation templates (existing {name}/{date} placeholders untouched)', async () => {
    const app = await buildServer();
    const { headers } = await makeAdmin();
    const { expiry } = await seedTemplates();

    const res = await app.inject({
      method: 'PATCH',
      url: `${BASE}/${expiry.id}`,
      headers,
      payload: { body: '{name} expires on {date} — grab it soon.' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().body).toContain('{name}');
    await app.close();
  });

  it('accepts a valid moderation template edit using only allowed placeholders', async () => {
    const app = await buildServer();
    const { headers } = await makeAdmin();
    const { moderation } = await seedTemplates();

    const res = await app.inject({
      method: 'PATCH',
      url: `${BASE}/${moderation.id}`,
      headers,
      payload: { body: '{total} item(s) to review: {newProducts} products, {revisions} revisions.' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().body).toContain('{total}');
    await app.close();
  });

  it('rejects a moderation template with an unsupported placeholder', async () => {
    const app = await buildServer();
    const { headers } = await makeAdmin();
    const { moderation } = await seedTemplates();

    const res = await app.inject({
      method: 'PATCH',
      url: `${BASE}/${moderation.id}`,
      headers,
      payload: { body: '{total} items by {creatorName}.' },
    });
    expect(res.statusCode).toBe(400);
    const stored = await getPrisma().notificationTemplate.findUniqueOrThrow({ where: { id: moderation.id } });
    expect(stored.body).not.toContain('{creatorName}');
    await app.close();
  });

  it('rejects a moderation template that drops the {total} placeholder', async () => {
    const app = await buildServer();
    const { headers } = await makeAdmin();
    const { moderation } = await seedTemplates();

    const res = await app.inject({
      method: 'PATCH',
      url: `${BASE}/${moderation.id}`,
      headers,
      payload: { body: 'Some products need review.' },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('rejects markup and links in the moderation template', async () => {
    const app = await buildServer();
    const { headers } = await makeAdmin();
    const { moderation } = await seedTemplates();

    for (const body of [
      '{total} items <script>alert(1)</script>',
      '{total} items — see https://evil.example/phish',
      '{total} items — visit www.evil.example',
      '{total items',
    ]) {
      const res = await app.inject({
        method: 'PATCH',
        url: `${BASE}/${moderation.id}`,
        headers,
        payload: { body },
      });
      expect(res.statusCode).toBe(400);
    }
    await app.close();
  });

  it('rejects an oversized moderation template body', async () => {
    const app = await buildServer();
    const { headers } = await makeAdmin();
    const { moderation } = await seedTemplates();

    const res = await app.inject({
      method: 'PATCH',
      url: `${BASE}/${moderation.id}`,
      headers,
      payload: { body: `{total} ${'x'.repeat(600)}` },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('requires admin auth', async () => {
    const app = await buildServer();
    const { moderation } = await seedTemplates();
    const res = await app.inject({
      method: 'PATCH',
      url: `${BASE}/${moderation.id}`,
      payload: { body: '{total} items.' },
    });
    expect(res.statusCode).toBe(401);
    await app.close();
  });
});

describe('moderation template renderer', () => {
  it('escapes HTML and builds the only anchor from the canonical queue URL', async () => {
    const { renderModerationTemplateHtml } = await import('../../src/services/notifications/moderation-template.js');
    const out = renderModerationTemplateHtml(
      { title: 'Queue <b>needs</b> review', body: '{total} new item(s): {newProducts} product(s), {revisions} revision(s).' },
      { newProducts: 2, revisions: 3 },
      'https://admin.example/products/pending',
    );
    expect(out.subject).toBe('Queue <b>needs</b> review');
    expect(out.html).toContain('&lt;b&gt;');
    expect(out.html).not.toContain('<b>needs</b>');
    expect(out.html).toContain('5 new item(s): 2 product(s), 3 revision(s)');
    expect(out.html).toContain('href="https://admin.example/products/pending"');
    // Both anchors point to the server-owned canonical queue URL.
    expect(out.html.match(/<a /g)).toHaveLength(2);
  });

  it('renders plain text with correct counts', async () => {
    const { renderModerationTemplateText } = await import('../../src/services/notifications/moderation-template.js');
    const out = renderModerationTemplateText(
      { title: 'Moderation queue needs review', body: '{total} item(s): {newProducts}/{revisions}.' },
      { newProducts: 4, revisions: 1 },
    );
    expect(out.body).toBe('5 item(s): 4/1.');
  });
});
