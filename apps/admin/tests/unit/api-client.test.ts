import { describe, expect, it, vi, beforeEach } from 'vitest';
import { apiBrowserFetch } from '@/lib/api-client';

describe('apiBrowserFetch', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('deduplicates concurrent 401 refresh requests to a single /api/auth/refresh call', async () => {
    let refreshCalls = 0;
    let endpoint1Calls = 0;
    let endpoint2Calls = 0;
    let resolveRefresh!: () => void;
    const refreshGate = new Promise<void>((resolve) => {
      resolveRefresh = resolve;
    });
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/auth/refresh') {
        refreshCalls++;
        await refreshGate;
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }

      if (url === '/api/data1') {
        endpoint1Calls++;
        if (endpoint1Calls === 1) {
          // First attempt 401s
          return new Response(JSON.stringify({ code: 'unauthorized' }), { status: 401 });
        }
        return new Response(JSON.stringify({ data: 'one' }), { status: 200 });
      }

      if (url === '/api/data2') {
        endpoint2Calls++;
        if (endpoint2Calls === 1) {
          // First attempt 401s
          return new Response(JSON.stringify({ code: 'unauthorized' }), { status: 401 });
        }
        return new Response(JSON.stringify({ data: 'two' }), { status: 200 });
      }

      return new Response(null, { status: 404 });
    }) as unknown as typeof fetch;

    // Fire both requests concurrently while unauthenticated
    const p1 = apiBrowserFetch<{ data: string }>('/api/data1');
    const p2 = apiBrowserFetch<{ data: string }>('/api/data2');

    // Open the gate allowing the refresh to complete
    resolveRefresh();

    const [res1, res2] = await Promise.all([p1, p2]);
    expect(res1.data).toBe('one');
    expect(res2.data).toBe('two');
    // Crucial: Only 1 refresh request was made despite 2 concurrent 401 responses
    expect(refreshCalls).toBe(1);
    expect(endpoint1Calls).toBe(2);
    expect(endpoint2Calls).toBe(2);
  });
});
