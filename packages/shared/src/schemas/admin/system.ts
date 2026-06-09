import { z } from 'zod';
import { cursorQuerySchema, cursorPageSchema } from './common.js';

export const queueHealthSchema = z.object({
  queues: z.array(z.object({
    name: z.string(),
    waiting: z.number().int(),
    active: z.number().int(),
    completed: z.number().int(),
    failed: z.number().int(),
    delayed: z.number().int(),
  })),
});

export const pushLogRowSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  templateKey: z.string(),
  status: z.enum(['sent', 'failed']),
  errorMessage: z.string().nullable(),
  createdAt: z.string().datetime(),
});

export const pushLogsQuerySchema = cursorQuerySchema.extend({
  userId: z.string().uuid().optional(),
  status: z.enum(['sent', 'failed']).optional(),
});

export const pushLogsListSchema = cursorPageSchema(pushLogRowSchema);

export const apiErrorsQuerySchema = z.object({
  range: z.enum(['24h', '7d', '30d']).default('24h'),
});

export const apiErrorsAggSchema = z.object({
  range: z.enum(['24h', '7d', '30d']),
  rows: z.array(z.object({
    route: z.string(),
    method: z.string(),
    status: z.number().int(),
    count: z.number().int(),
  })),
});

export const externalApiStateSchema = z.object({
  breakers: z.array(z.object({
    name: z.string(),
    state: z.enum(['closed', 'open', 'halfOpen']),
    fires: z.number().int(),
    failures: z.number().int(),
    successes: z.number().int(),
    lastFailureAt: z.string().datetime().nullable(),
  })),
});
