import { describe, expect, it } from 'vitest';
import {
  createSession,
  rotateSession,
  revokeSession,
  findActiveSessionByToken,
} from '../../src/services/auth/sessions.js';
import { makeUser } from '../helpers/factories.js';

describe('sessions', () => {
  it('creates a session and finds it by token', async () => {
    const user = await makeUser();
    const { refreshToken, session } = await createSession(user.id, { ip: '1.2.3.4' });
    expect(session.userId).toBe(user.id);
    const found = await findActiveSessionByToken(refreshToken);
    expect(found?.id).toBe(session.id);
  });

  it('rotates a session: returns new token, marks old hash unusable', async () => {
    const user = await makeUser();
    const { refreshToken } = await createSession(user.id);
    const next = await rotateSession(refreshToken);
    expect(next.refreshToken).not.toBe(refreshToken);
    expect(await findActiveSessionByToken(refreshToken)).toBeNull();
    expect((await findActiveSessionByToken(next.refreshToken))?.id).toBe(next.session.id);
  });

  it('revoke makes the token no longer findable', async () => {
    const user = await makeUser();
    const { refreshToken, session } = await createSession(user.id);
    await revokeSession(session.id);
    expect(await findActiveSessionByToken(refreshToken)).toBeNull();
  });
});
