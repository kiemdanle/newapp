import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  bufferBarcodeApiCallLog,
  flushBarcodeApiCallLogs,
  getBarcodeApiTrackerBufferSize,
  clearBarcodeApiTrackerBuffer,
  pruneExpiredBarcodeApiLogs,
} from './barcode-api-tracker.js';
import { getPrisma } from '../../db.js';

describe('barcode-api-tracker', () => {
  beforeEach(() => {
    clearBarcodeApiTrackerBuffer();
  });

  it('buffers calls in memory without immediately writing to database', () => {
    bufferBarcodeApiCallLog({
      provider: 'off',
      barcode: '123456789012',
      endpoint: 'https://world.openfoodfacts.org/api/v2/product/123456789012.json',
      status: 'hit',
      httpStatus: 200,
      durationMs: 230,
    });

    expect(getBarcodeApiTrackerBufferSize()).toBe(1);
  });

  it('flushes immediately when buffer reaches batch limit (25 items)', async () => {
    const prisma = getPrisma();
    const createManySpy = vi.spyOn(prisma.barcodeApiCallLog, 'createMany').mockResolvedValue({ count: 25 });

    for (let i = 0; i < 25; i++) {
      bufferBarcodeApiCallLog({
        provider: 'upcitemdb',
        barcode: `0123456789${i.toString().padStart(2, '0')}`,
        endpoint: 'https://api.upcitemdb.com/prod/trial/lookup',
        status: 'hit',
        httpStatus: 200,
        durationMs: 150,
      });
    }

    await flushBarcodeApiCallLogs();

    expect(createManySpy).toHaveBeenCalled();
    expect(getBarcodeApiTrackerBufferSize()).toBe(0);

    createManySpy.mockRestore();
  });

  it('safely swallows database write errors without crashing caller', async () => {
    const prisma = getPrisma();
    const createManySpy = vi.spyOn(prisma.barcodeApiCallLog, 'createMany').mockRejectedValue(new Error('DB Connection Refused'));

    bufferBarcodeApiCallLog({
      provider: 'off',
      barcode: '999999999999',
      endpoint: 'https://world.openfoodfacts.org/api/v2/product/999999999999.json',
      status: 'error',
      durationMs: 50,
    });

    // Explicit flush should resolve cleanly without throwing
    await expect(flushBarcodeApiCallLogs()).resolves.toBeUndefined();

    createManySpy.mockRestore();
  });

  it('skips log pruning when retentionDays is null (unlimited retention)', async () => {
    const prisma = getPrisma();
    const deleteManySpy = vi.spyOn(prisma.barcodeApiCallLog, 'deleteMany');

    const deleted = await pruneExpiredBarcodeApiLogs(null);
    expect(deleted).toBe(0);
    expect(deleteManySpy).not.toHaveBeenCalled();

    deleteManySpy.mockRestore();
  });

  it('executes deleteMany when retentionDays is a positive number', async () => {
    const prisma = getPrisma();
    const deleteManySpy = vi.spyOn(prisma.barcodeApiCallLog, 'deleteMany').mockResolvedValue({ count: 42 });

    const deleted = await pruneExpiredBarcodeApiLogs(14);
    expect(deleted).toBe(42);
    expect(deleteManySpy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          createdAt: expect.objectContaining({
            lt: expect.any(Date),
          }),
        },
      }),
    );

    deleteManySpy.mockRestore();
  });
});
