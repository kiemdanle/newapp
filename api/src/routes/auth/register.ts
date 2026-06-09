import type { FastifyInstance } from 'fastify';
import { registerSchema, authResultSchema, ERROR_CODES } from '@pantry/shared';
import { getConfig } from '../../config.js';
import { getPrisma } from '../../db.js';
import { AppError } from '../../errors.js';
import { hashPassword } from '../../services/auth/passwords.js';
import { issueAccessToken } from '../../services/auth/tokens.js';
import { createSession } from '../../services/auth/sessions.js';
import { sendVerificationEmail } from '../../services/auth/email.js';
import { detectCountryFromIp } from '../../services/country/detect.js';
import { toApiUser } from '../../services/users/repository.js';
import { hashToken, randomToken } from '../../utils/random.js';
import { generateUniqueReferralCode } from '../../services/referrals/referral-code.js';

export async function registerRoute(app: FastifyInstance) {
  app.post('/register', async (req, reply) => {
    const input = registerSchema.parse(req.body);
    const prisma = getPrisma();

    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing) {
      throw new AppError({
        status: 409,
        code: ERROR_CODES.EMAIL_ALREADY_REGISTERED,
        title: 'Email already registered',
      });
    }

    // Resolve referrer when a referralCode is supplied.
    let referrer: { id: string; referralCode: string } | null = null;
    if (input.referralCode) {
      const r = await prisma.user.findUnique({
        where: { referralCode: input.referralCode },
        select: { id: true, referralCode: true },
      });
      if (!r) {
        throw new AppError({
          status: 404,
          code: ERROR_CODES.REFERRAL_CODE_NOT_FOUND,
          title: 'Referral code not found',
        });
      }
      referrer = { id: r.id, referralCode: r.referralCode! };
    }

    const passwordHash = await hashPassword(input.password);
    const country = await detectCountryFromIp(req.ip).catch(() => null);
    const newUserCode = await generateUniqueReferralCode();

    const user = await prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: {
          email: input.email,
          passwordHash,
          firstName: input.firstName,
          lastName: input.lastName,
          country,
          referralCode: newUserCode,
          ...(referrer ? { referredByUserId: referrer.id } : {}),
        },
      });
      await tx.authCredential.create({ data: { userId: u.id, type: 'password' } });
      // Attribution: create a pending referral row if a referrer was supplied.
      if (referrer) {
        await tx.referral.create({
          data: {
            referrerUserId: referrer.id,
            referredUserId: u.id,
            referralCode: referrer.referralCode!,
            signupIp: req.ip ?? null,
          },
        });
      }
      return u;
    });

    const verifyToken = randomToken(32);
    await prisma.emailToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(verifyToken),
        purpose: 'verify_email',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
    await sendVerificationEmail(user.email, verifyToken);

    const accessToken = await issueAccessToken({ sub: user.id, role: user.role });
    const { refreshToken } = await createSession(user.id, { ip: req.ip });

    return reply.status(201).send(
      authResultSchema.parse({
        user: toApiUser(user),
        tokens: {
          accessToken,
          refreshToken,
          expiresIn: getConfig().jwt.accessTtlSeconds,
        },
      }),
    );
  });
}
