import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  externalApiStateSchema,
  barcodeApiStatsSchema,
  barcodeApiRequestsQuerySchema,
  barcodeApiRequestsListSchema,
  barcodeApiCallLogDetailSchema,
  barcodeApiProbeRequestSchema,
  barcodeApiProbeResponseSchema,
  barcodeApiConfigSchema,
  barcodeApiConfigPatchSchema,
  barcodeApiResetActionSchema,
  ERROR_CODES,
} from '@expyrico/shared';
import { AppError } from '../../../errors.js';
import { snapshotBreakers } from '../../../services/admin/breakers.js';
import {
  getBarcodeApiStats,
  getBarcodeApiRequests,
  getBarcodeApiRequestDetail,
} from '../../../services/admin/barcode-api-analytics.js';
import { probeBarcodeProvider } from '../../../services/admin/barcode-probe.js';
import {
  getBarcodeProviderSettings,
  updateBarcodeProviderSettings,
  resetProviderCooldown,
  resetProviderBreaker,
} from '../../../services/external/barcode-provider-settings.js';

export async function adminSystemExternalApisRoute(app: FastifyInstance) {
  // Legacy / backward-compatible route for circuit breaker status
  app.get('/external-apis', async () =>
    externalApiStateSchema.parse({ breakers: snapshotBreakers() }),
  );

  // Stats aggregation across range (24h, 7d, 30d)
  app.get('/external-apis/stats', async (req) => {
    const query = z
      .object({
        range: z.enum(['24h', '7d', '30d']).default('24h'),
      })
      .parse(req.query);

    const stats = await getBarcodeApiStats(query.range);
    return barcodeApiStatsSchema.parse(stats);
  });

  // Granular paginated request logs with filters
  app.get('/external-apis/requests', async (req) => {
    const query = barcodeApiRequestsQuerySchema.parse(req.query);
    const result = await getBarcodeApiRequests(query);
    return barcodeApiRequestsListSchema.parse(result);
  });

  // Detail inspection for a single log row (including headers and raw preview)
  app.get('/external-apis/requests/:id', async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const detail = await getBarcodeApiRequestDetail(id);
    if (!detail) {
      throw new AppError({
        status: 404,
        code: ERROR_CODES.NOT_FOUND,
        title: 'Barcode API call log not found',
      });
    }
    return barcodeApiCallLogDetailSchema.parse(detail);
  });

  // Live diagnostic probe for testing any barcode against a provider
  app.post('/external-apis/probe', async (req) => {
    const input = barcodeApiProbeRequestSchema.parse(req.body);
    const adminUserId = req.user?.id ?? '00000000-0000-0000-0000-000000000000';
    const result = await probeBarcodeProvider(input.barcode, input.provider, adminUserId);
    return barcodeApiProbeResponseSchema.parse(result);
  });

  // Update provider settings (timeouts, limits, retention days)
  app.patch('/external-apis/config', async (req) => {
    const patch = barcodeApiConfigPatchSchema.parse(req.body);
    const adminUserId = req.user?.id ?? '00000000-0000-0000-0000-000000000000';

    const before = await getBarcodeProviderSettings();
    const after = await updateBarcodeProviderSettings(patch, adminUserId);

    await req.auditLog(
      'settings.external_barcode_providers.update',
      { type: 'setting', id: 'external_barcode_providers' },
      {
        before: before as unknown as Record<string, unknown>,
        after: after as unknown as Record<string, unknown>,
      },
    );

    return barcodeApiConfigSchema.parse(after);
  });

  // Reset provider cooldown or circuit breaker
  app.post('/external-apis/reset', async (req) => {
    const input = barcodeApiResetActionSchema.parse(req.body);

    if (input.target === 'cooldown' || input.target === 'all') {
      resetProviderCooldown(input.provider);
    }
    if (input.target === 'breaker' || input.target === 'all') {
      resetProviderBreaker(input.provider);
    }

    await req.auditLog(
      'external_api.reset',
      { type: 'provider', id: input.provider },
      { before: null, after: { target: input.target } },
    );

    return { ok: true, provider: input.provider, target: input.target };
  });
}
