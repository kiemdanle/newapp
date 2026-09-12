import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { getBaseUrl } from '../../api/client';

export type ConnectionStatus = 'checking' | 'ready' | 'offline' | 'server_unreachable';

export interface ConnectionEvaluationResult {
  status: ConnectionStatus;
  clientOnline: boolean;
  serverReady: boolean;
  errorDetail?: string;
}

export const HEALTH_CHECK_TIMEOUT_MS = 4000;

/**
 * Probe server readiness via GET /health/ready.
 * Verifies both PostgreSQL and Redis are active and responsive.
 */
export async function probeServerHealth(
  baseUrl: string = getBaseUrl(),
  timeoutMs: number = HEALTH_CHECK_TIMEOUT_MS,
): Promise<{ ok: boolean; detail?: string }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const cleanUrl = baseUrl.replace(/\/+$/, '');
    const res = await fetch(`${cleanUrl}/health/ready`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      signal: controller.signal,
    });

    if (!res.ok) {
      return { ok: false, detail: `HTTP ${res.status}` };
    }

    const data = (await res.json()) as { status?: string };
    if (data?.status === 'ready' || data?.status === 'ok') {
      return { ok: true };
    }

    return { ok: false, detail: `Unexpected status: ${String(data?.status)}` };
  } catch (err: unknown) {
    if (err instanceof Error) {
      if (err.name === 'AbortError') {
        return { ok: false, detail: 'Connection timeout' };
      }
      return { ok: false, detail: err.message };
    }
    return { ok: false, detail: 'Unknown network error' };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Evaluate dual-layer connectivity:
 * 1. Physical network interface + internet reachability (NetInfo)
 * 2. Server readiness (/health/ready)
 */
export async function evaluateConnection(
  baseUrl: string = getBaseUrl(),
  timeoutMs: number = HEALTH_CHECK_TIMEOUT_MS,
): Promise<ConnectionEvaluationResult> {
  try {
    const netState: NetInfoState = await NetInfo.fetch();
    const clientOnline = Boolean(netState.isConnected && netState.isInternetReachable !== false);

    if (!clientOnline) {
      return {
        status: 'offline',
        clientOnline: false,
        serverReady: false,
        errorDetail: 'No active internet connection',
      };
    }

    const serverProbe = await probeServerHealth(baseUrl, timeoutMs);
    if (serverProbe.ok) {
      return {
        status: 'ready',
        clientOnline: true,
        serverReady: true,
      };
    }

    return {
      status: 'server_unreachable',
      clientOnline: true,
      serverReady: false,
      errorDetail: serverProbe.detail ?? 'Server unreachable',
    };
  } catch (err: unknown) {
    return {
      status: 'offline',
      clientOnline: false,
      serverReady: false,
      errorDetail: err instanceof Error ? err.message : 'Evaluation failed',
    };
  }
}
