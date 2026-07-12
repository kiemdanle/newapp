import type { FastifyInstance } from 'fastify';
import { ERROR_CODES, verifyResetCodeSchema, verifyResetCodeResponseSchema } from '@expyrico/shared';
import { AppError } from '../../errors.js';
import { getPrisma } from '../../db.js';
import { hashToken, randomToken } from '../../utils/random.js';

const MAX_ATTEMPTS = 5;
const TICKET_TTL_MS = 10 * 60 * 1000; // 10 min

// One generic error for every failure mode (no row / wrong / expired / capped),
// so the response never distinguishes them (RT-1/RT-4 no-enumeration).
const INVALID = new AppError({
  status: 400,
  code: ERROR_CODES.INVALID_TOKEN,
  title: 'Invalid or expired code',
});

export async function verifyResetCodeRoute(app: FastifyInstance) {
  app.post('/verify-reset-code', async (req, reply) => {
    const input = verifyResetCodeSchema.parse(req.body);
    const prisma = getPrisma();

    const user = await prisma.user.findUnique({
      where: { email: input.email },
      select: { id: true },
    });
    if (!user) {
      // Do a throwaway hash so the not-found path isn't trivially instant, then
      // fail with the same generic error as every other case (RT-1/RT-4). Status
      // and body are identical across all failures; note this does NOT fully
      // equalize timing — the user-exists path additionally issues a DB UPDATE.
      hashToken(`no-user:${input.code}`);
      throw INVALID;
    }

    // RT-2: enforce the attempt cap inside the write. The row lock Postgres takes
    // for the UPDATE serializes concurrent requests, so at most MAX_ATTEMPTS pass
    // — a read-then-check would race under READ COMMITTED. Lookup is by userId +
    // active-state (RT-1), NOT by code hash, so a wrong guess still resolves to a
    // real row and increments `attempts`.
    const rows = await prisma.$queryRaw<
      Array<{ id: string; codeHash: string }>
    >`
      UPDATE password_resets
         SET "attempts" = "attempts" + 1
       WHERE "userId" = ${user.id}::uuid
         AND "consumedAt" IS NULL
         AND "verifiedAt" IS NULL
         AND "expiresAt" > (now() AT TIME ZONE 'UTC')
         AND "attempts" < ${MAX_ATTEMPTS}
      RETURNING id, "codeHash"
    `;

    const row = rows[0];
    if (!row) throw INVALID; // no active row, expired, or attempt cap hit

    if (row.codeHash !== hashToken(`${user.id}:${input.code}`)) {
      // Wrong code — attempt already counted by the UPDATE above.
      throw INVALID;
    }

    // Correct code: mark verified and issue a single-use reset ticket.
    const ticket = randomToken(32);
    await prisma.passwordReset.update({
      where: { id: row.id },
      data: {
        verifiedAt: new Date(),
        ticketHash: hashToken(ticket),
        ticketExpiresAt: new Date(Date.now() + TICKET_TTL_MS),
      },
    });

    return reply.send(verifyResetCodeResponseSchema.parse({ resetTicket: ticket }));
  });
}
