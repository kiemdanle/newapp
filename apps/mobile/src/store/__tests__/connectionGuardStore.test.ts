import { useConnectionStore } from '../connectionStore';
import { useConnectionGuardStore } from '../connectionGuardStore';

jest.mock('@react-native-community/netinfo', () => ({
  fetch: jest.fn(),
  addEventListener: jest.fn(() => jest.fn()),
}));

describe('connectionGuardStore', () => {
  beforeEach(() => {
    useConnectionStore.getState().reset();
    useConnectionGuardStore.getState().closeModal();
  });
  it('returns true when connection is ready without executing callback prematurely', () => {
    useConnectionStore.setState({ status: 'ready' });
    const callback = jest.fn();

    const allowed = useConnectionGuardStore.getState().requireServerConnection('Add Item', callback);
    expect(allowed).toBe(true);
    expect(callback).not.toHaveBeenCalled();
    expect(useConnectionGuardStore.getState().isModalVisible).toBe(false);
  });

  it('intercepts action and opens modal when connection is offline', () => {
    useConnectionStore.setState({ status: 'offline' });
    const callback = jest.fn();

    const allowed = useConnectionGuardStore.getState().requireServerConnection('Add Item', callback);
    expect(allowed).toBe(false);
    expect(callback).not.toHaveBeenCalled();

    const state = useConnectionGuardStore.getState();
    expect(state.isModalVisible).toBe(true);
    expect(state.actionName).toBe('Add Item');
    expect(state.pendingCallback).toBe(callback);
  });

  it('executes pending action and closes modal on executePendingAction', () => {
    useConnectionStore.setState({ status: 'offline' });
    const callback = jest.fn();

    useConnectionGuardStore.getState().requireServerConnection('Add Item', callback);
    expect(useConnectionGuardStore.getState().isModalVisible).toBe(true);

    useConnectionGuardStore.getState().executePendingAction();
    expect(callback).toHaveBeenCalledTimes(1);
    expect(useConnectionGuardStore.getState().isModalVisible).toBe(false);
    expect(useConnectionGuardStore.getState().pendingCallback).toBeNull();
  });

  it('dismisses modal without executing callback on closeModal', () => {
    useConnectionStore.setState({ status: 'offline' });
    const callback = jest.fn();

    useConnectionGuardStore.getState().requireServerConnection('Add Item', callback);
    expect(useConnectionGuardStore.getState().isModalVisible).toBe(true);

    useConnectionGuardStore.getState().closeModal();
    expect(callback).not.toHaveBeenCalled();
    expect(useConnectionGuardStore.getState().isModalVisible).toBe(false);
  });
});
