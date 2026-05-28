// apps/admin/tests/e2e/mock-api.ts
// Lightweight in-process mock for the Fastify API endpoints the admin proxies
// to. Started by Playwright's webServer block on port 4099. Avoids requiring a
// live API + Postgres + Redis for E2E.
//
// Implements only the endpoints exercised by login.spec.ts:
//   POST /v1/auth/login                     → password+TOTP enrolled, fresh-admin, or wrong-password branch
//   POST /v1/auth/totp/challenge-verify     → returns {user, tokens} on success
//   POST /v1/auth/totp/enroll               → returns {secret, qrCodeDataUrl, recoveryCodes}
//   POST /v1/auth/totp/verify-enrollment    → 204 on correct code
//   GET  /v1/auth/me                        → returns admin user when bearer matches mock token

import { createServer } from 'node:http';
import { authenticator } from 'otplib';
import {
  ACCESS_TOKEN,
  CHALLENGE_TOKEN,
  ENROLLED_USER,
  ENROLLMENT_CHALLENGE,
  ENROLLMENT_SECRET,
  E2E_ADMIN_ENROLLED,
  E2E_ADMIN_FRESH,
} from './mock-api-constants';

const PORT = Number(process.env.MOCK_API_PORT ?? 4099);

// Track which enrollmentChallenge values have been verified — verify-enrollment
// only succeeds once per challenge in real life. The mock allows multiple.
const issuedEnrollments = new Set<string>();

interface JsonResp {
  status?: number;
  body?: unknown;
}

async function readJson(req: Parameters<Parameters<typeof createServer>[0]>[0]): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
}

function send(
  res: Parameters<Parameters<typeof createServer>[0]>[1],
  { status = 200, body }: JsonResp,
): void {
  if (status === 204) {
    res.statusCode = 204;
    res.end();
    return;
  }
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(body ?? {}));
}

const server = createServer(async (req, res) => {
  const url = req.url ?? '';
  const method = req.method ?? 'GET';

  if (method === 'POST' && url === '/v1/auth/login') {
    const body = (await readJson(req)) as { email?: string; password?: string };
    if (
      body.email === E2E_ADMIN_ENROLLED.email &&
      body.password === E2E_ADMIN_ENROLLED.password
    ) {
      return send(res, { body: { requiresTotp: true, challengeToken: CHALLENGE_TOKEN } });
    }
    if (body.email === E2E_ADMIN_FRESH.email && body.password === E2E_ADMIN_FRESH.password) {
      return send(res, {
        body: { requiresTotpEnrollment: true, enrollmentChallenge: ENROLLMENT_CHALLENGE },
      });
    }
    return send(res, {
      status: 401,
      body: { code: 'invalid_credentials', detail: 'Invalid email or password' },
    });
  }

  if (method === 'POST' && url === '/v1/auth/totp/challenge-verify') {
    const body = (await readJson(req)) as { challengeToken?: string; code?: string };
    if (body.challengeToken !== CHALLENGE_TOKEN) {
      return send(res, { status: 401, body: { code: 'invalid_challenge' } });
    }
    const expected = authenticator.generate(E2E_ADMIN_ENROLLED.totpSecret);
    if (body.code !== expected) {
      return send(res, { status: 401, body: { code: 'invalid_totp' } });
    }
    return send(res, {
      body: {
        user: ENROLLED_USER,
        tokens: {
          accessToken: ACCESS_TOKEN,
          refreshToken: 'mock-refresh-token-enrolled',
          expiresIn: 900,
        },
      },
    });
  }

  if (method === 'POST' && url === '/v1/auth/totp/enroll') {
    const body = (await readJson(req)) as { enrollmentChallenge?: string };
    if (body.enrollmentChallenge !== ENROLLMENT_CHALLENGE) {
      return send(res, { status: 401, body: { code: 'invalid_enrollment_challenge' } });
    }
    issuedEnrollments.add(ENROLLMENT_CHALLENGE);
    return send(res, {
      body: {
        secret: ENROLLMENT_SECRET,
        // Tiny 1×1 PNG so <Image src> is happy.
        qrCodeDataUrl:
          'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
        recoveryCodes: [
          'AAAA-1111',
          'BBBB-2222',
          'CCCC-3333',
          'DDDD-4444',
          'EEEE-5555',
          'FFFF-6666',
          'GGGG-7777',
          'HHHH-8888',
          'IIII-9999',
          'JJJJ-0000',
        ],
      },
    });
  }

  if (method === 'POST' && url === '/v1/auth/totp/verify-enrollment') {
    const body = (await readJson(req)) as { enrollmentChallenge?: string; code?: string };
    if (!body.enrollmentChallenge || !issuedEnrollments.has(body.enrollmentChallenge)) {
      return send(res, { status: 401, body: { code: 'invalid_enrollment_challenge' } });
    }
    const expected = authenticator.generate(ENROLLMENT_SECRET);
    if (body.code !== expected) {
      return send(res, { status: 401, body: { code: 'invalid_totp' } });
    }
    return send(res, { status: 204 });
  }

  if (method === 'GET' && url === '/v1/auth/me') {
    const auth = req.headers.authorization ?? '';
    if (auth === `Bearer ${ACCESS_TOKEN}`) {
      return send(res, { body: ENROLLED_USER });
    }
    return send(res, { status: 401, body: { code: 'unauthorized' } });
  }

  return send(res, { status: 404, body: { code: 'not_found', path: url } });
});

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[mock-api] listening on :${PORT}`);
});

function shutdown(): void {
  server.close(() => process.exit(0));
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
