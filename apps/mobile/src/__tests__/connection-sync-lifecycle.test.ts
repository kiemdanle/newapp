jest.unmock('../db/triggers');

import { useConnectionStore } from '../store/connectionStore';
import * as syncModule from '../db/sync';
import { startSyncTriggers, stopSyncTriggers } from '../db/triggers';
jest.mock('../db/sync', () => ({
  runSync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@react-native-community/netinfo', () => ({
  fetch: jest.fn(),
  addEventListener: jest.fn(() => jest.fn()),
}));
describe('connection-sync-lifecycle', () => {
  beforeEach(() => {
    stopSyncTriggers();
    useConnectionStore.getState().reset();
  });
  afterEach(() => {
    stopSyncTriggers();
  });

  it('triggers runSync when connection transitions from offline to ready', async () => {
    useConnectionStore.setState({ status: 'offline' });
    startSyncTriggers();

    expect(syncModule.runSync).not.toHaveBeenCalled();

    // Transition to ready
    useConnectionStore.setState({ status: 'ready' });

    expect(syncModule.runSync).toHaveBeenCalledTimes(1);
  });

  it('triggers runSync when connection transitions from server_unreachable to ready', async () => {
    useConnectionStore.setState({ status: 'server_unreachable' });
    startSyncTriggers();

    expect(syncModule.runSync).not.toHaveBeenCalled();

    // Transition to ready
    useConnectionStore.setState({ status: 'ready' });

    expect(syncModule.runSync).toHaveBeenCalledTimes(1);
  });

  it('does not trigger runSync on rapid subsequent ready updates within cooldown', async () => {
    useConnectionStore.setState({ status: 'offline' });
    startSyncTriggers();

    // First transition to ready
    useConnectionStore.setState({ status: 'ready' });
    expect(syncModule.runSync).toHaveBeenCalledTimes(1);

    // Rapid flip back and forth within cooldown window
    useConnectionStore.setState({ status: 'offline' });
    useConnectionStore.setState({ status: 'ready' });

    // Should still only be called once due to cooldown
    expect(syncModule.runSync).toHaveBeenCalledTimes(1);
  });
});
