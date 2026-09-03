import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { buildServer } from '../../src/server.js';
import { getPrisma } from '../../src/db.js';
import { makeUser } from '../helpers/factories.js';
import { makeAdmin } from '../helpers/admin.js';
import { issueAccessToken } from '../../src/services/auth/tokens.js';
import { dispatchFeedbackAdminAlertOutbox } from '../../src/services/feedback/admin-alert-outbox.js';
async function authUser() {
  const user = await makeUser({ emailVerified: true });
  const token = await issueAccessToken({
    sub: user.id,
    role: 'user',
    tokenVersion: user.tokenVersion,
  });
  return { user, headers: { authorization: `Bearer ${token}` } };
}

describe('Feedback & Support Integration Tests', () => {
  describe('User Endpoints (/v1/feedback)', () => {
    it('creates a feedback ticket, opening message, and enqueues admin alert', async () => {
      const app = await buildServer();
      const { admin } = await makeAdmin();
      const { user, headers } = await authUser();
      const res = await app.inject({
        method: 'POST',
        url: '/v1/feedback',
        headers,
        payload: {
          type: 'bug',
          title: 'Scanner freezes on barcode scan',
          description: 'Camera preview locks after 2 seconds on Android 14.',
          deviceInfo: {
            platform: 'android',
            osVersion: '14',
            appVersion: '1.2.0',
            deviceModel: 'Pixel 8',
          },
        },
      });
      expect(res.statusCode).toBe(201);
      const data = res.json();
      expect(data.id).toBeDefined();
      expect(data.title).toBe('Scanner freezes on barcode scan');
      expect(data.status).toBe('open');
      expect(data.type).toBe('bug');
      expect(data.messages).toHaveLength(1);
      expect(data.messages[0].message).toBe('Camera preview locks after 2 seconds on Android 14.');
      expect(data.messages[0].senderType).toBe('user');
      expect(data.messages[0].senderUserId).toBe(user.id);

      // Assert durable admin outbox alert was created in the database
      const adminAlert = await getPrisma().feedbackAdminAlertOutbox.findFirst({
        where: {
          ticketId: data.id,
        },
      });
      expect(adminAlert).toBeDefined();
      // Dispatch the outbox poller
      await dispatchFeedbackAdminAlertOutbox();
      const dispatched = await getPrisma().feedbackAdminAlertOutbox.findUniqueOrThrow({
        where: { id: adminAlert!.id },
      });
      expect(dispatched.status).toBe('sent');
      expect(dispatched.dispatchedAt).toBeDefined();
      expect(dispatched.attempts).toBeGreaterThanOrEqual(1);
    });

    it('lists tickets for the authenticated user only', async () => {
      const app = await buildServer();
      const { user: userA, headers: headersA } = await authUser();
      const { headers: headersB } = await authUser();

      // Create ticket for User A
      await app.inject({
        method: 'POST',
        url: '/v1/feedback',
        headers: headersA,
        payload: {
          type: 'suggestion',
          title: 'Dark mode in pantry',
          description: 'Would love a quick toggle for dark mode in the home screen.',
        },
      });

      // User A sees ticket
      const resA = await app.inject({ method: 'GET', url: '/v1/feedback', headers: headersA });
      expect(resA.statusCode).toBe(200);
      expect(resA.json().items.length).toBeGreaterThanOrEqual(1);

      // User B does not see User A's ticket
      const resB = await app.inject({ method: 'GET', url: '/v1/feedback', headers: headersB });
      expect(resB.statusCode).toBe(200);
      expect(resB.json().items).toHaveLength(0);

      await app.close();
    });

    it('retrieves ticket detail and prevents cross-user access', async () => {
      const app = await buildServer();
      const { headers: headersA } = await authUser();
      const { headers: headersB } = await authUser();

      const createRes = await app.inject({
        method: 'POST',
        url: '/v1/feedback',
        headers: headersA,
        payload: {
          type: 'feedback',
          title: 'Love the app!',
          description: 'The expiry tracking saved me hundreds on groceries already.',
        },
      });
      const ticketId = createRes.json().id;

      // User A can view ticket
      const getResA = await app.inject({
        method: 'GET',
        url: `/v1/feedback/${ticketId}`,
        headers: headersA,
      });
      expect(getResA.statusCode).toBe(200);
      expect(getResA.json().id).toBe(ticketId);

      // User B cannot view User A's ticket
      const getResB = await app.inject({
        method: 'GET',
        url: `/v1/feedback/${ticketId}`,
        headers: headersB,
      });
      expect(getResB.statusCode).toBe(404);

      await app.close();
    });

    it('allows user to append messages and blocks replies on closed cases', async () => {
      const app = await buildServer();
      const { headers } = await authUser();

      const createRes = await app.inject({
        method: 'POST',
        url: '/v1/feedback',
        headers,
        payload: {
          type: 'bug',
          title: 'Crash on photo upload',
          description: 'App crashes when uploading a 5MB PNG image.',
        },
      });
      const ticketId = createRes.json().id;

      // User appends message
      const replyRes = await app.inject({
        method: 'POST',
        url: `/v1/feedback/${ticketId}/messages`,
        headers,
        payload: { message: 'Here is an update: happens on both Wi-Fi and LTE.' },
      });
      expect(replyRes.statusCode).toBe(201);
      expect(replyRes.json().message).toBe('Here is an update: happens on both Wi-Fi and LTE.');

      // Mark ticket resolved directly in DB to test locking
      await getPrisma().feedbackTicket.update({
        where: { id: ticketId },
        data: { status: 'resolved' },
      });

      // User reply on resolved ticket is rejected
      const blockedRes = await app.inject({
        method: 'POST',
        url: `/v1/feedback/${ticketId}/messages`,
        headers,
        payload: { message: 'Can I reopen this?' },
      });
      expect(blockedRes.statusCode).toBe(400);
      expect(blockedRes.json().code).toBe('feedback_case_closed');

      await app.close();
    });
  });

  describe('Attachment Upload and Streaming', () => {
    it('uploads an image and streams it with access control', async () => {
      const app = await buildServer();
      const { user, headers: userHeaders } = await authUser();
      const { headers: strangerHeaders } = await authUser();
      const { headers: adminHeaders } = await makeAdmin();

      const pngBuffer = await sharp({
        create: {
          width: 20,
          height: 20,
          channels: 4,
          background: { r: 75, g: 174, b: 138, alpha: 1 },
        },
      })
        .png()
        .toBuffer();

      // Multipart upload via boundary
      const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
      const multipartBody = Buffer.concat([
        Buffer.from(
          `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="test.png"\r\nContent-Type: image/png\r\n\r\n`,
        ),
        pngBuffer,
        Buffer.from(`\r\n--${boundary}--\r\n`),
      ]);

      const uploadRes = await app.inject({
        method: 'POST',
        url: '/v1/feedback/attachments',
        headers: {
          ...userHeaders,
          'content-type': `multipart/form-data; boundary=${boundary}`,
        },
        payload: multipartBody,
      });

      expect(uploadRes.statusCode).toBe(201);
      const attachment = uploadRes.json();
      expect(attachment.id).toBeDefined();
      expect(attachment.mimeType).toBe('image/webp');
      expect(attachment.uploaderId).toBe(user.id);

      // Stream attachment as uploader
      const streamRes = await app.inject({
        method: 'GET',
        url: `/v1/feedback/attachments/${attachment.id}`,
        headers: userHeaders,
      });
      expect(streamRes.statusCode).toBe(200);
      expect(streamRes.headers['content-type']).toBe('image/webp');
      expect(streamRes.headers['x-content-type-options']).toBe('nosniff');

      // Admin can also stream
      const adminStreamRes = await app.inject({
        method: 'GET',
        url: `/v1/feedback/attachments/${attachment.id}`,
        headers: adminHeaders,
      });
      expect(adminStreamRes.statusCode).toBe(200);

      // Stranger cannot stream
      const strangerStreamRes = await app.inject({
        method: 'GET',
        url: `/v1/feedback/attachments/${attachment.id}`,
        headers: strangerHeaders,
      });
      expect(strangerStreamRes.statusCode).toBe(403);

      await app.close();
    });
  });

  describe('Admin Endpoints (/v1/admin/feedback)', () => {
    it('lists feedback with search and status filters, and returns counts', async () => {
      const app = await buildServer();
      const { user, headers: userHeaders } = await authUser();
      const { headers: adminHeaders } = await makeAdmin();

      await app.inject({
        method: 'POST',
        url: '/v1/feedback',
        headers: userHeaders,
        payload: {
          type: 'bug',
          title: 'Notification sound missing',
          description: 'No audio alert triggers when pantry items expire.',
        },
      });

      // Admin list
      const listRes = await app.inject({
        method: 'GET',
        url: '/v1/admin/feedback?status=open&search=Notification',
        headers: adminHeaders,
      });
      expect(listRes.statusCode).toBe(200);
      const listData = listRes.json();
      expect(listData.items.length).toBeGreaterThanOrEqual(1);
      expect(listData.items[0].user.id).toBe(user.id);

      // Admin counts
      const countRes = await app.inject({
        method: 'GET',
        url: '/v1/admin/feedback/counts',
        headers: adminHeaders,
      });
      expect(countRes.statusCode).toBe(200);
      const counts = countRes.json();
      expect(counts.total).toBeGreaterThanOrEqual(1);
      expect(counts.open).toBeGreaterThanOrEqual(1);

      await app.close();
    });

    it('admin replies to user and resolves case, queueing notifications', async () => {
      const app = await buildServer();
      const { headers: userHeaders } = await authUser();
      const { admin, headers: adminHeaders } = await makeAdmin();
      const prisma = getPrisma();

      const createRes = await app.inject({
        method: 'POST',
        url: '/v1/feedback',
        headers: userHeaders,
        payload: {
          type: 'bug',
          title: 'Crash on recipe import',
          description: 'Importing recipe from URL crashes the app immediately.',
        },
      });
      const ticketId = createRes.json().id;

      // 1. Admin sends reply
      const replyRes = await app.inject({
        method: 'POST',
        url: `/v1/admin/feedback/${ticketId}/reply`,
        headers: adminHeaders,
        payload: {
          message: 'Thank you for reporting. We deployed a patch in v1.2.2.',
        },
      });
      expect(replyRes.statusCode).toBe(201);
      expect(replyRes.json().senderType).toBe('admin');
      expect(replyRes.json().senderUserId).toBe(admin.id);

      // Verify ticket status changed to replied
      const updatedTicket = await prisma.feedbackTicket.findUniqueOrThrow({
        where: { id: ticketId },
      });
      expect(updatedTicket.status).toBe('replied');

      // Verify notification outbox entry created for feedback_reply
      const outboxReply = await prisma.notificationOutbox.findFirst({
        where: {
          userId: updatedTicket.userId,
          templateKey: 'feedback_reply',
        },
      });
      expect(outboxReply).toBeDefined();

      // 2. Admin marks case resolved
      const statusRes = await app.inject({
        method: 'PATCH',
        url: `/v1/admin/feedback/${ticketId}/status`,
        headers: adminHeaders,
        payload: {
          status: 'resolved',
          resolutionNotes: 'Root cause was URL parser regex failure on encoded queries.',
        },
      });
      expect(statusRes.statusCode).toBe(200);
      expect(statusRes.json().status).toBe('resolved');
      expect(statusRes.json().resolvedBy).toBe(admin.id);

      // Verify notification outbox entry created for feedback_case_resolved
      const outboxResolved = await prisma.notificationOutbox.findFirst({
        where: {
          userId: updatedTicket.userId,
          templateKey: 'feedback_case_resolved',
        },
      });
      expect(outboxResolved).toBeDefined();

      await app.close();
    });
  });
});
