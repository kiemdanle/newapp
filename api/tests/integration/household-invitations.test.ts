import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { buildServer } from '../../src/server.js';
import { makeUser, makeHousehold, makeMembership } from '../helpers/factories.js';
import { issueAccessToken } from '../../src/services/auth/tokens.js';
import { getPrisma } from '../../src/db.js';

async function headersFor(userId: string) {
  return {
    authorization: `Bearer ${await issueAccessToken({ sub: userId, role: 'user', tokenVersion: 0 })}`,
    'idempotency-key': randomUUID(),
  };
}

describe('Household Invitation Lifecycle', () => {
  it('owner creates invitation, invitee previews and accepts', async () => {
    const app = await buildServer();
    const owner = await makeUser({ emailVerified: true });
    const invitee = await makeUser({ emailVerified: true, email: 'invitee@test.local' });
    const hh = await makeHousehold(owner.id, { name: 'Happy Family' });
    const prisma = getPrisma();

    // 1. Owner creates invite
    const createRes = await app.inject({
      method: 'POST',
      url: `/v1/households/${hh.id}/invitations`,
      headers: await headersFor(owner.id),
      payload: { email: invitee.email },
    });

    expect(createRes.statusCode).toBe(201);
    const createdBody = createRes.json();
    expect(createdBody.invitation.invitedEmail).toBe(invitee.email);
    expect(createdBody.invitation.status).toBe('pending');
    expect(createdBody.invitation.householdName).toBe('Happy Family');

    // Fetch token from DB
    const invRow = await prisma.householdInvitation.findUniqueOrThrow({
      where: { id: createdBody.invitation.id },
    });
    expect(invRow.token).toBeTruthy();

    // 2. Invitee checks "mine" pending invitations
    const mineRes = await app.inject({
      method: 'GET',
      url: '/v1/households/invitations/mine',
      headers: await headersFor(invitee.id),
    });
    expect(mineRes.statusCode).toBe(200);
    expect(mineRes.json().items).toHaveLength(1);
    expect(mineRes.json().items[0].id).toBe(invRow.id);

    // 3. Preview invite by token
    const previewRes = await app.inject({
      method: 'GET',
      url: `/v1/households/invitations/${invRow.token}`,
    });
    expect(previewRes.statusCode).toBe(200);
    expect(previewRes.json().householdName).toBe('Happy Family');
    expect(previewRes.json().inviterName).toBe(owner.firstName);

    // 4. Invitee accepts invite
    const acceptRes = await app.inject({
      method: 'POST',
      url: `/v1/households/invitations/${invRow.token}/accept`,
      headers: await headersFor(invitee.id),
    });
    expect(acceptRes.statusCode).toBe(200);
    expect(acceptRes.json().status).toBe('accepted');

    // Verify membership in DB
    const member = await prisma.householdMember.findUnique({
      where: { householdId_userId: { householdId: hh.id, userId: invitee.id } },
    });
    expect(member).not.toBeNull();
    expect(member?.role).toBe('member');

    // Verify invitation status updated
    const updatedInv = await prisma.householdInvitation.findUniqueOrThrow({
      where: { id: invRow.id },
    });
    expect(updatedInv.status).toBe('accepted');

    await app.close();
  });

  it('rejects accept if user email does not match invited email', async () => {
    const app = await buildServer();
    const owner = await makeUser({ emailVerified: true });
    const stranger = await makeUser({ emailVerified: true, email: 'stranger@test.local' });
    const hh = await makeHousehold(owner.id, { name: 'Private House' });
    const prisma = getPrisma();

    const createRes = await app.inject({
      method: 'POST',
      url: `/v1/households/${hh.id}/invitations`,
      headers: await headersFor(owner.id),
      payload: { email: 'partner@test.local' },
    });
    expect(createRes.statusCode).toBe(201);
    const invId = createRes.json().invitation.id;

    const invRow = await prisma.householdInvitation.findUniqueOrThrow({ where: { id: invId } });

    // Stranger tries to accept
    const acceptRes = await app.inject({
      method: 'POST',
      url: `/v1/households/invitations/${invRow.token}/accept`,
      headers: await headersFor(stranger.id),
    });

    expect(acceptRes.statusCode).toBe(403);
    await app.close();
  });

  it('allows invitee to decline invitation', async () => {
    const app = await buildServer();
    const owner = await makeUser({ emailVerified: true });
    const invitee = await makeUser({ emailVerified: true, email: 'busy@test.local' });
    const hh = await makeHousehold(owner.id);
    const prisma = getPrisma();

    const createRes = await app.inject({
      method: 'POST',
      url: `/v1/households/${hh.id}/invitations`,
      headers: await headersFor(owner.id),
      payload: { email: invitee.email },
    });
    const invId = createRes.json().invitation.id;
    const invRow = await prisma.householdInvitation.findUniqueOrThrow({ where: { id: invId } });

    // Decline
    const declineRes = await app.inject({
      method: 'POST',
      url: `/v1/households/invitations/${invRow.token}/decline`,
      headers: await headersFor(invitee.id),
    });

    expect(declineRes.statusCode).toBe(200);
    expect(declineRes.json().status).toBe('declined');

    const updatedInv = await prisma.householdInvitation.findUniqueOrThrow({ where: { id: invId } });
    expect(updatedInv.status).toBe('declined');

    await app.close();
  });

  it('owner can list and revoke pending invitations', async () => {
    const app = await buildServer();
    const owner = await makeUser({ emailVerified: true });
    const hh = await makeHousehold(owner.id);
    const prisma = getPrisma();

    const createRes = await app.inject({
      method: 'POST',
      url: `/v1/households/${hh.id}/invitations`,
      headers: await headersFor(owner.id),
      payload: { email: 'revokeme@test.local' },
    });
    const invId = createRes.json().invitation.id;

    // List invitations
    const listRes = await app.inject({
      method: 'GET',
      url: `/v1/households/${hh.id}/invitations`,
      headers: await headersFor(owner.id),
    });
    expect(listRes.statusCode).toBe(200);
    expect(listRes.json().items.some((i: any) => i.id === invId)).toBe(true);

    // Revoke
    const revokeRes = await app.inject({
      method: 'DELETE',
      url: `/v1/households/${hh.id}/invitations/${invId}`,
      headers: await headersFor(owner.id),
    });
    expect(revokeRes.statusCode).toBe(204);

    const afterRevoke = await prisma.householdInvitation.findUniqueOrThrow({ where: { id: invId } });
    expect(afterRevoke.status).toBe('revoked');

    await app.close();
  });

  it('rejects duplicate pending invitation for same email with 409', async () => {
    const app = await buildServer();
    const owner = await makeUser({ emailVerified: true });
    const hh = await makeHousehold(owner.id);

    await app.inject({
      method: 'POST',
      url: `/v1/households/${hh.id}/invitations`,
      headers: await headersFor(owner.id),
      payload: { email: 'dupe@test.local' },
    });

    const secondRes = await app.inject({
      method: 'POST',
      url: `/v1/households/${hh.id}/invitations`,
      headers: await headersFor(owner.id),
      payload: { email: 'dupe@test.local' },
    });

    expect(secondRes.statusCode).toBe(409);
    await app.close();
  });

  it('non-owner cannot send invitations (403)', async () => {
    const app = await buildServer();
    const owner = await makeUser({ emailVerified: true });
    const member = await makeUser({ emailVerified: true });
    const hh = await makeHousehold(owner.id);
    await makeMembership(hh.id, member.id, { role: 'member' });

    const res = await app.inject({
      method: 'POST',
      url: `/v1/households/${hh.id}/invitations`,
      headers: await headersFor(member.id),
      payload: { email: 'new@test.local' },
    });

    expect(res.statusCode).toBe(403);
    await app.close();
  });

  it('links invitedUserId on pending invitations when user verifies email', async () => {
    const app = await buildServer();
    const owner = await makeUser({ emailVerified: true });
    const hh = await makeHousehold(owner.id);
    const prisma = getPrisma();
    const targetEmail = 'newuser@test.local';

    // Send invite to not-yet-registered email
    const createRes = await app.inject({
      method: 'POST',
      url: `/v1/households/${hh.id}/invitations`,
      headers: await headersFor(owner.id),
      payload: { email: targetEmail },
    });
    expect(createRes.statusCode).toBe(201);
    const invId = createRes.json().invitation.id;

    // User signs up (unverified)
    const newUser = await makeUser({ email: targetEmail, emailVerified: false });

    // Create verification code
    const code = '123456';
    const { hashToken } = await import('../../src/utils/random.js');
    await prisma.emailToken.create({
      data: {
        userId: newUser.id,
        tokenHash: hashToken(`${newUser.id}:${code}`),
        purpose: 'verify_email',
        expiresAt: new Date(Date.now() + 600000),
      },
    });

    // User verifies email
    const verifyRes = await app.inject({
      method: 'POST',
      url: '/v1/auth/verify-email',
      payload: { email: targetEmail, code },
    });
    expect(verifyRes.statusCode).toBe(200);

    // Assert invitedUserId was linked to newUser.id
    const invRow = await prisma.householdInvitation.findUniqueOrThrow({ where: { id: invId } });
    expect(invRow.invitedUserId).toBe(newUser.id);

    await app.close();
  });
});
