import { describe, expect, it, vi, beforeEach } from 'vitest';
import { detectCountryFromIp } from '../../src/services/country/detect.js';

describe('detectCountryFromIp', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('returns ISO-2 from primary on success', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ country_code: 'GB' }),
    });
    const cc = await detectCountryFromIp('1.2.3.4', { fetch: fetchMock as never });
    expect(cc).toBe('GB');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('falls back to secondary on primary failure', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce({ ok: true, json: async () => ({ countryCode: 'US' }) });
    const cc = await detectCountryFromIp('1.2.3.4', { fetch: fetchMock as never });
    expect(cc).toBe('US');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('returns null on both failures', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('boom'));
    const cc = await detectCountryFromIp('1.2.3.4', { fetch: fetchMock as never });
    expect(cc).toBeNull();
  });

  it('returns null for invalid/private IPs', async () => {
    const fetchMock = vi.fn();
    expect(await detectCountryFromIp('127.0.0.1', { fetch: fetchMock as never })).toBeNull();
    expect(await detectCountryFromIp('10.0.0.1', { fetch: fetchMock as never })).toBeNull();
    expect(await detectCountryFromIp('::1', { fetch: fetchMock as never })).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
