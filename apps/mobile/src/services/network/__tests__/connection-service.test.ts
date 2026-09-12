import NetInfo from '@react-native-community/netinfo';
import {
  evaluateConnection,
  probeServerHealth,
} from '../connection-service';

jest.mock('@react-native-community/netinfo', () => ({
  fetch: jest.fn(),
  addEventListener: jest.fn(() => jest.fn()),
}));

describe('connection-service', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('probeServerHealth', () => {
    it('returns ok: true when /health/ready returns 200 with status ready', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ status: 'ready' }),
      });

      const result = await probeServerHealth('https://api.test.com', 1000);
      expect(result).toEqual({ ok: true });
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.test.com/health/ready',
        expect.objectContaining({ method: 'GET' }),
      );
    });

    it('returns ok: false when /health/ready returns non-200 status', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 503,
        json: async () => ({ status: 'not_ready' }),
      });

      const result = await probeServerHealth('https://api.test.com', 1000);
      expect(result.ok).toBe(false);
      expect(result.detail).toBe('HTTP 503');
    });

    it('returns ok: false when fetch throws network error', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Failed to connect'));

      const result = await probeServerHealth('https://api.test.com', 1000);
      expect(result.ok).toBe(false);
      expect(result.detail).toBe('Failed to connect');
    });
  });

  describe('evaluateConnection', () => {
    it('returns offline when NetInfo indicates disconnected', async () => {
      (NetInfo.fetch as jest.Mock).mockResolvedValue({
        isConnected: false,
        isInternetReachable: false,
      });

      const result = await evaluateConnection('https://api.test.com', 1000);
      expect(result).toEqual({
        status: 'offline',
        clientOnline: false,
        serverReady: false,
        errorDetail: 'No active internet connection',
      });
    });

    it('returns offline when NetInfo is connected but internet is unreachable', async () => {
      (NetInfo.fetch as jest.Mock).mockResolvedValue({
        isConnected: true,
        isInternetReachable: false,
      });

      const result = await evaluateConnection('https://api.test.com', 1000);
      expect(result.status).toBe('offline');
      expect(result.clientOnline).toBe(false);
    });

    it('returns server_unreachable when NetInfo is online but server returns 503', async () => {
      (NetInfo.fetch as jest.Mock).mockResolvedValue({
        isConnected: true,
        isInternetReachable: true,
      });
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 503,
        json: async () => ({ status: 'not_ready' }),
      });

      const result = await evaluateConnection('https://api.test.com', 1000);
      expect(result.status).toBe('server_unreachable');
      expect(result.clientOnline).toBe(true);
      expect(result.serverReady).toBe(false);
      expect(result.errorDetail).toBe('HTTP 503');
    });

    it('returns ready when NetInfo is online and server returns ready', async () => {
      (NetInfo.fetch as jest.Mock).mockResolvedValue({
        isConnected: true,
        isInternetReachable: true,
      });
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ status: 'ready' }),
      });

      const result = await evaluateConnection('https://api.test.com', 1000);
      expect(result).toEqual({
        status: 'ready',
        clientOnline: true,
        serverReady: true,
      });
    });
  });
});
