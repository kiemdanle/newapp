import { PrismaClient } from '@prisma/client';
import { logger } from './logger.js';

let _prisma: PrismaClient | undefined;

export function getPrisma(): PrismaClient {
  if (!_prisma) {
    _prisma = new PrismaClient({
      log: [
        { level: 'warn', emit: 'event' },
        { level: 'error', emit: 'event' },
      ],
    });
    _prisma.$on('warn' as never, (e: unknown) => logger.warn({ prisma: e }, 'prisma warn'));
    _prisma.$on('error' as never, (e: unknown) => logger.error({ prisma: e }, 'prisma error'));
  }
  return _prisma;
}

export async function disconnectPrisma(): Promise<void> {
  if (_prisma) {
    await _prisma.$disconnect();
    _prisma = undefined;
  }
}
