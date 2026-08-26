import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { buildServer } from '../../src/server.js';
import { getPrisma } from '../../src/db.js';

const BOUNDARY = '----expyricoTestBoundary';

function multipartBody(parts: Array<{ name: string; filename?: string; contentType?: string; content: Buffer | string }>): Buffer {
  const chunks: Buffer[] = [];
  for (const part of parts) {
    let header = `--${BOUNDARY}\r\nContent-Disposition: form-data; name="${part.name}"`;
    if (part.filename) header += `; filename="${part.filename}"`;
    header += '\r\n';
    if (part.contentType) header += `Content-Type: ${part.contentType}\r\n`;
    header += '\r\n';
    chunks.push(Buffer.from(header, 'utf8'));
    chunks.push(Buffer.isBuffer(part.content) ? part.content : Buffer.from(part.content, 'utf8'));
    chunks.push(Buffer.from('\r\n', 'utf8'));
  }
  chunks.push(Buffer.from(`--${BOUNDARY}--\r\n`, 'utf8'));
  return Buffer.concat(chunks);
}

async function createAuthenticatedUser(
  app: Awaited<ReturnType<typeof buildServer>>,
  email: string,
  password?: string,
) {
  const prisma = getPrisma();
  if (password) {
    await app.inject({
      method: 'POST',
      url: '/v1/auth/register',
      payload: {
        email,
        password,
        firstName: 'Test',
        lastName: 'User',
      },
    });
    await prisma.user.update({
      where: { email },
      data: { emailVerifiedAt: new Date() },
    });
    const loginRes = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email, password },
    });
    const tokens = loginRes.json().tokens as { accessToken: string; refreshToken: string };
    const user = loginRes.json().user;
    return { tokens, user };
  } else {
    // Create passwordless user (e.g. Google OAuth)
    const user = await prisma.user.create({
      data: {
        email,
        emailVerifiedAt: new Date(),
        firstName: 'OAuth',
        lastName: 'User',
        passwordHash: null,
      },
    });
    const { issueAccessToken } = await import('../../src/services/auth/tokens.js');
    const accessToken = await issueAccessToken({
      sub: user.id,
      role: user.role,
      tokenVersion: user.tokenVersion,
    });
    return {
      tokens: { accessToken, refreshToken: 'dummy-refresh' },
      user,
    };
  }
}

describe('Me Profile & Security Routes', () => {
  it('PATCH /v1/me updates address, name, and country', async () => {
    const app = await buildServer();
    const { tokens } = await createAuthenticatedUser(app, 'profile-test@example.com', 'password123456');

    const res = await app.inject({
      method: 'PATCH',
      url: '/v1/me',
      headers: { authorization: `Bearer ${tokens.accessToken}` },
      payload: {
        firstName: 'UpdatedFirst',
        lastName: 'UpdatedLast',
        address: '123 Test Street, Suite 100',
        country: 'VN',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.firstName).toBe('UpdatedFirst');
    expect(body.lastName).toBe('UpdatedLast');
    expect(body.address).toBe('123 Test Street, Suite 100');
    expect(body.country).toBe('VN');
    expect(body.hasPassword).toBe(true);

    await app.close();
  });

  it('PUT /v1/me/password validates current password and updates credentials', async () => {
    const app = await buildServer();
    const { tokens } = await createAuthenticatedUser(app, 'pw-change@example.com', 'initialPassword123');

    // 1. Rejects if current password is wrong
    const failRes = await app.inject({
      method: 'PUT',
      url: '/v1/me/password',
      headers: { authorization: `Bearer ${tokens.accessToken}` },
      payload: {
        currentPassword: 'wrongPassword999',
        newPassword: 'brandNewSecurePassword456',
        confirmPassword: 'brandNewSecurePassword456',
      },
    });
    expect(failRes.statusCode).toBe(400);
    expect(failRes.json().code).toBe('invalid_current_password');

    // 2. Succeeds with correct current password
    const successRes = await app.inject({
      method: 'PUT',
      url: '/v1/me/password',
      headers: { authorization: `Bearer ${tokens.accessToken}` },
      payload: {
        currentPassword: 'initialPassword123',
        newPassword: 'brandNewSecurePassword456',
        confirmPassword: 'brandNewSecurePassword456',
      },
    });
    expect(successRes.statusCode).toBe(200);
    const successBody = successRes.json();
    expect(successBody.tokens.accessToken).toBeDefined();
    expect(successBody.tokens.refreshToken).toBeDefined();
    expect(successBody.user.hasPassword).toBe(true);

    // 3. Verifies that user can login with new password and old password fails
    const oldLogin = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'pw-change@example.com', password: 'initialPassword123' },
    });
    expect(oldLogin.statusCode).toBe(401);

    const newLogin = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'pw-change@example.com', password: 'brandNewSecurePassword456' },
    });
    expect(newLogin.statusCode).toBe(200);

    await app.close();
  });

  it('PUT /v1/me/password allows passwordless user to set a password directly', async () => {
    const app = await buildServer();
    const { tokens } = await createAuthenticatedUser(app, 'oauth-pw@example.com');

    const res = await app.inject({
      method: 'PUT',
      url: '/v1/me/password',
      headers: { authorization: `Bearer ${tokens.accessToken}` },
      payload: {
        newPassword: 'newOAuthSetPassword123',
        confirmPassword: 'newOAuthSetPassword123',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.user.hasPassword).toBe(true);

    // Login with new password works
    const loginRes = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'oauth-pw@example.com', password: 'newOAuthSetPassword123' },
    });
    expect(loginRes.statusCode).toBe(200);

    await app.close();
  });

  it('POST /v1/me/avatar and DELETE /v1/me/avatar uploads and deletes avatar', async () => {
    const app = await buildServer();
    const { tokens } = await createAuthenticatedUser(app, 'avatar-test@example.com', 'password123456');

    // Create a 100x100 PNG sample image buffer
    const imageBuffer = await sharp({
      create: {
        width: 100,
        height: 100,
        channels: 3,
        background: { r: 75, g: 174, b: 138 }, // Fresh Sage
      },
    })
      .png()
      .toBuffer();

    const body = multipartBody([
      {
        name: 'file',
        filename: 'avatar.png',
        contentType: 'image/png',
        content: imageBuffer,
      },
    ]);

    const uploadRes = await app.inject({
      method: 'POST',
      url: '/v1/me/avatar',
      headers: {
        authorization: `Bearer ${tokens.accessToken}`,
        'content-type': `multipart/form-data; boundary=${BOUNDARY}`,
      },
      payload: body,
    });

    expect(uploadRes.statusCode).toBe(200);
    const uploadBody = uploadRes.json();
    expect(uploadBody.avatarUrl).toContain('/display.webp');
    expect(uploadBody.user.avatarUrl).toContain('/display.webp');

    // Delete avatar
    const deleteRes = await app.inject({
      method: 'DELETE',
      url: '/v1/me/avatar',
      headers: { authorization: `Bearer ${tokens.accessToken}` },
    });

    expect(deleteRes.statusCode).toBe(200);
    expect(deleteRes.json().avatarUrl).toBeNull();

    await app.close();
  });
  it('POST /v1/me/avatar handles smartphone portrait photos with EXIF orientation', async () => {
    const app = await buildServer();
    const { tokens } = await createAuthenticatedUser(app, 'avatar-exif@example.com', 'password123456');

    // Create 400x300 JPEG with EXIF orientation 6 (portrait photo taken on mobile camera)
    const imageBuffer = await sharp({
      create: {
        width: 400,
        height: 300,
        channels: 3,
        background: 'green',
      },
    })
      .withMetadata({ orientation: 6 })
      .jpeg()
      .toBuffer();

    const body = multipartBody([
      {
        name: 'file',
        filename: 'camera-photo.jpg',
        contentType: 'image/jpeg',
        content: imageBuffer,
      },
    ]);

    const uploadRes = await app.inject({
      method: 'POST',
      url: '/v1/me/avatar',
      headers: {
        authorization: `Bearer ${tokens.accessToken}`,
        'content-type': `multipart/form-data; boundary=${BOUNDARY}`,
      },
      payload: body,
    });

    expect(uploadRes.statusCode).toBe(200);
    const uploadBody = uploadRes.json();
    expect(uploadBody.avatarUrl).toContain('/display.webp');

    await app.close();
  });
});
