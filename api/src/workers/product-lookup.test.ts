import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Job } from 'bullmq';

const { lookupProductForBackfillMock, getWorkerProcessor, setWorkerProcessor } = vi.hoisted(() => {
  let processor: ((job: Job) => Promise<void>) | null = null;
  return {
    lookupProductForBackfillMock: vi.fn(),
    getWorkerProcessor: () => processor,
    setWorkerProcessor: (p: ((job: Job) => Promise<void>) | null) => {
      processor = p;
    },
  };
});

vi.mock('../services/products/lookup.js', () => ({
  lookupProductForBackfill: lookupProductForBackfillMock,
}));

vi.mock('bullmq', () => {
  return {
    Worker: vi.fn().mockImplementation((_queueName, processor) => {
      setWorkerProcessor(processor);
      return {
        on: vi.fn(),
        close: vi.fn().mockResolvedValue(undefined),
      };
    }),
  };
});

import { startProductLookupWorker } from './product-lookup.js';

describe('product-lookup worker', () => {
  beforeEach(() => {
    lookupProductForBackfillMock.mockReset();
    setWorkerProcessor(null);
    startProductLookupWorker();
  });

  it('completes cleanly when product is found', async () => {
    lookupProductForBackfillMock.mockResolvedValueOnce({
      status: 'found',
      product: { id: 'prod-123', name: 'Backfilled Product' },
    });

    const fakeJob = {
      data: { barcode: '123456789012', requestedByUserId: 'user-1' },
    } as Job;

    const processor = getWorkerProcessor();
    expect(processor).not.toBeNull();
    await expect(processor!(fakeJob)).resolves.toBeUndefined();
    expect(lookupProductForBackfillMock).toHaveBeenCalledWith('123456789012');
  });

  it('completes cleanly without retry on conclusive miss', async () => {
    lookupProductForBackfillMock.mockResolvedValueOnce({
      status: 'not_found',
      product: null,
    });

    const fakeJob = {
      data: { barcode: '000000000000', requestedByUserId: 'user-2' },
    } as Job;

    const processor = getWorkerProcessor();
    expect(processor).not.toBeNull();
    await expect(processor!(fakeJob)).resolves.toBeUndefined();
    expect(lookupProductForBackfillMock).toHaveBeenCalledWith('000000000000');
  });

  it('throws an error on unavailable to trigger BullMQ retry with exponential backoff', async () => {
    lookupProductForBackfillMock.mockResolvedValueOnce({
      status: 'unavailable',
      product: null,
    });

    const fakeJob = {
      data: { barcode: '999999999999', requestedByUserId: 'user-3' },
    } as Job;

    const processor = getWorkerProcessor();
    expect(processor).not.toBeNull();
    await expect(processor!(fakeJob)).rejects.toThrow(
      'Upstream providers unavailable for barcode 999999999999',
    );
    expect(lookupProductForBackfillMock).toHaveBeenCalledWith('999999999999');
  });
});
