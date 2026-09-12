import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { AppState, type EmitterSubscription } from 'react-native';
import {
  useConnectionStore,
  initConnectionMonitoring,
  teardownConnectionMonitoring,
} from '../connectionStore';
import * as connectionService from '../../services/network/connection-service';

jest.mock('@react-native-community/netinfo', () => ({
  fetch: jest.fn(),
  addEventListener: jest.fn(),
}));

describe('connectionStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    teardownConnectionMonitoring();
    useConnectionStore.getState().reset();
  });

  afterEach(() => {
    teardownConnectionMonitoring();
  });

  it('initializes with default checking state', () => {
    const state = useConnectionStore.getState();
    expect(state.status).toBe('checking');
    expect(state.clientOnline).toBe(false);
    expect(state.serverReady).toBe(false);
    expect(state.initialized).toBe(false);
  });

  it('updates state on successful checkConnection', async () => {
    jest.spyOn(connectionService, 'evaluateConnection').mockResolvedValue({
      status: 'ready',
      clientOnline: true,
      serverReady: true,
    });

    const result = await useConnectionStore.getState().checkConnection();
    expect(result.status).toBe('ready');

    const state = useConnectionStore.getState();
    expect(state.status).toBe('ready');
    expect(state.clientOnline).toBe(true);
    expect(state.serverReady).toBe(true);
    expect(state.initialized).toBe(true);
    expect(state.lastCheckedAt).toBeGreaterThan(0);
  });

  it('updates state to offline on failed checkConnection', async () => {
    jest.spyOn(connectionService, 'evaluateConnection').mockResolvedValue({
      status: 'offline',
      clientOnline: false,
      serverReady: false,
      errorDetail: 'No active internet connection',
    });

    const result = await useConnectionStore.getState().checkConnection();
    expect(result.status).toBe('offline');

    const state = useConnectionStore.getState();
    expect(state.status).toBe('offline');
    expect(state.clientOnline).toBe(false);
    expect(state.serverReady).toBe(false);
  });

  it('tracks isRetrying during retry action', async () => {
    let resolveEval: (val: connectionService.ConnectionEvaluationResult) => void;
    const evalPromise = new Promise<connectionService.ConnectionEvaluationResult>((resolve) => {
      resolveEval = resolve;
    });

    jest.spyOn(connectionService, 'evaluateConnection').mockImplementation(() => evalPromise);

    const retryPromise = useConnectionStore.getState().retry();
    expect(useConnectionStore.getState().isRetrying).toBe(true);

    resolveEval!({
      status: 'ready',
      clientOnline: true,
      serverReady: true,
    });

    await retryPromise;
    expect(useConnectionStore.getState().isRetrying).toBe(false);
    expect(useConnectionStore.getState().status).toBe('ready');
  });

  it('registers NetInfo and AppState listeners on initConnectionMonitoring', () => {
    (NetInfo.addEventListener as jest.Mock).mockImplementation(() => jest.fn());

    const appStateSpy = jest.spyOn(AppState, 'addEventListener').mockReturnValue({
      remove: jest.fn(),
    } as unknown as EmitterSubscription);

    const checkSpy = jest.spyOn(useConnectionStore.getState(), 'checkConnection');

    initConnectionMonitoring();

    expect(NetInfo.addEventListener).toHaveBeenCalled();
    expect(appStateSpy).toHaveBeenCalledWith('change', expect.any(Function));
    expect(checkSpy).toHaveBeenCalled();
  });
});
