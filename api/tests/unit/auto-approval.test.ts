import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  hasExceededDailyAutoApprovalQuota,
  recordAutoApprovedSubmission,
  DAILY_AUTO_APPROVAL_CAP,
} from '../../src/services/products/auto-approval.js';
import * as redisModule from '../../src/redis.js';

describe('auto-approval service', () => {
  const fakeRedis = {
    get: vi.fn(),
    incr: vi.fn(),
    expire: vi.fn(),
    flushdb: vi.fn().mockResolvedValue('OK'),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(redisModule, 'getRedis').mockReturnValue(fakeRedis as never);
  });

  describe('hasExceededDailyAutoApprovalQuota', () => {
    it('returns false when user has no submissions today', async () => {
      fakeRedis.get.mockResolvedValue(null);
      const res = await hasExceededDailyAutoApprovalQuota('user-1');
      expect(res).toBe(false);
    });

    it('returns false when user count is below the daily cap', async () => {
      fakeRedis.get.mockResolvedValue(String(DAILY_AUTO_APPROVAL_CAP - 1));
      const res = await hasExceededDailyAutoApprovalQuota('user-1');
      expect(res).toBe(false);
    });

    it('returns true when user count reaches or exceeds the daily cap', async () => {
      fakeRedis.get.mockResolvedValue(String(DAILY_AUTO_APPROVAL_CAP));
      const res = await hasExceededDailyAutoApprovalQuota('user-1');
      expect(res).toBe(true);

      fakeRedis.get.mockResolvedValue(String(DAILY_AUTO_APPROVAL_CAP + 5));
      const res2 = await hasExceededDailyAutoApprovalQuota('user-1');
      expect(res2).toBe(true);
    });

    it('fails open (returns false) if Redis throws', async () => {
      fakeRedis.get.mockRejectedValue(new Error('Redis connection lost'));
      const res = await hasExceededDailyAutoApprovalQuota('user-1');
      expect(res).toBe(false);
    });
  });

  describe('recordAutoApprovedSubmission', () => {
    it('sets TTL on first increment of the day', async () => {
      fakeRedis.incr.mockResolvedValue(1);
      await recordAutoApprovedSubmission('user-1');
      expect(fakeRedis.incr).toHaveBeenCalledWith(expect.stringContaining('user-1'));
      expect(fakeRedis.expire).toHaveBeenCalledWith(expect.any(String), 2 * 86400);
    });

    it('does not reset TTL on subsequent increments', async () => {
      fakeRedis.incr.mockResolvedValue(2);
      await recordAutoApprovedSubmission('user-1');
      expect(fakeRedis.expire).not.toHaveBeenCalled();
    });
  });
});
