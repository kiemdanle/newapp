import React from 'react';
import { fireEvent, render, waitFor, act } from '@testing-library/react-native';
import { AppState, Linking } from 'react-native';
import ScanScreen from '../../app/(app)/scan';
import { ThemeProvider } from '../../src/theme/ThemeProvider';
import { initThemeStore, useThemeStore } from '../../src/theme/store';
import { navigation, __setRouteParams } from '../../tests/mocks/react-navigation';
import { createLocalRecord } from '../../src/api/records';

let triggerScan: ((r: { kind: 'barcode' | 'qr'; value: string }) => void) | null = null;
let mockInitialPermission: 'unknown' | 'granted' | 'denied' = 'granted';
const mockCheckPermission = jest.fn();
const mockRequestPermission = jest.fn();

jest.mock('../../src/features/scan/ScanCamera', () => ({
  ScanCamera: ({ onScan }: { onScan: (r: { kind: 'barcode' | 'qr'; value: string }) => void }) => {
    triggerScan = onScan;
    return null;
  },
}));

jest.mock('../../src/features/scan/usePermission', () => {
  const React = require('react');
  return {
    useCameraPermission: () => {
      const [state, setState] = React.useState(mockInitialPermission);
      const check = React.useCallback(async () => {
        const next = await mockCheckPermission();
        setState(next);
        return next;
      }, []);
      const request = React.useCallback(async () => {
        const next = await mockRequestPermission();
        setState(next);
        return next;
      }, []);
      return { state, request, check };
    },
  };
});

jest.mock('../../src/api/records', () => ({
  createLocalRecord: jest.fn().mockResolvedValue('local-id-1'),
  useActiveRecords: () => [],
}));

jest.mock('../../src/api/households', () => ({
  useMyHouseholds: () => ({ data: { items: [] } }),
}));

jest.mock('../../src/store/pantryScope', () => ({
  usePantryScope: () => ({ scope: 'personal', householdId: null, setScope: jest.fn() }),
}));

const mockLookup = jest.fn();
jest.mock('../../src/api/products', () => ({
  useProductLookupV2: () => ({ mutateAsync: mockLookup }),
  useCreateOrResumeDraft: () => ({ mutateAsync: jest.fn() }),
  usePatchDraft: () => ({ mutateAsync: jest.fn() }),
}));
function wrap(node: React.ReactNode) {
  return <ThemeProvider>{node}</ThemeProvider>;
}

const createLocalRecordMock = createLocalRecord as jest.MockedFunction<typeof createLocalRecord>;

describe('<ScanScreen /> — lookup-v2 state machine', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    mockLookup.mockReset();
    mockInitialPermission = 'granted';
    mockCheckPermission.mockReset();
    mockCheckPermission.mockResolvedValue('granted');
    mockRequestPermission.mockReset();
    triggerScan = null;
    useThemeStore.setState({ themeId: 'expyrico', hydrated: false });
    await initThemeStore();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('shows a Settings prompt when camera access is denied', async () => {
    mockInitialPermission = 'denied';
    mockCheckPermission.mockResolvedValue('denied');
    const openSettings = jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined);
    const { findByTestId, getByText } = render(wrap(<ScanScreen />));

    expect(await findByTestId('camera-permission-denied-modal')).toBeTruthy();
    expect(getByText('Camera access is off')).toBeTruthy();

    await act(async () => fireEvent.press(await findByTestId('camera-permission-denied-open-settings')));

    expect(openSettings).toHaveBeenCalledTimes(1);
  });

  it('keeps the first-time pre-prompt when the initial permission check is unknown', async () => {
    mockInitialPermission = 'unknown';
    mockCheckPermission.mockResolvedValue('unknown');
    const { findByTestId, queryByTestId } = render(wrap(<ScanScreen />));

    expect(await findByTestId('pre-prompt-allow')).toBeTruthy();
    expect(queryByTestId('camera-permission-denied-modal')).toBeNull();
  });

  it('keeps the first-time pre-prompt visible when requesting permission fails', async () => {
    mockInitialPermission = 'unknown';
    mockCheckPermission.mockResolvedValue('unknown');
    mockRequestPermission.mockRejectedValue(new Error('Permission request failed'));
    const unhandledRejection = jest.fn();
    process.on('unhandledRejection', unhandledRejection);

    try {
      const { findByTestId } = render(wrap(<ScanScreen />));

      await act(async () => {
        fireEvent.press(await findByTestId('pre-prompt-allow'));
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
      });

      expect(unhandledRejection).not.toHaveBeenCalled();
      expect(await findByTestId('pre-prompt-allow')).toBeTruthy();
    } finally {
      process.off('unhandledRejection', unhandledRejection);
    }
  });

  it('prevents duplicate camera permission requests while the first request is pending', async () => {
    mockInitialPermission = 'unknown';
    mockCheckPermission.mockResolvedValue('unknown');
    let resolveRequest: ((state: 'granted') => void) | undefined;
    mockRequestPermission.mockImplementation(
      () =>
        new Promise<'granted'>((resolve) => {
          resolveRequest = resolve;
        }),
    );
    const { findByTestId } = render(wrap(<ScanScreen />));
    const allow = await findByTestId('pre-prompt-allow');

    try {
      await act(async () => {
        fireEvent.press(allow);
        fireEvent.press(allow);
      });

      expect(mockRequestPermission).toHaveBeenCalledTimes(1);
    } finally {
      await act(async () => {
        resolveRequest?.('granted');
        await Promise.resolve();
      });
    }
  });

  it('keeps the denied Settings prompt usable when opening Settings fails', async () => {
    mockInitialPermission = 'denied';
    mockCheckPermission.mockResolvedValue('denied');
    const unhandledRejection = jest.fn();
    process.on('unhandledRejection', unhandledRejection);
    jest.spyOn(Linking, 'openSettings').mockRejectedValue(new Error('Settings unavailable'));

    try {
      const { findByTestId } = render(wrap(<ScanScreen />));

      expect(await findByTestId('camera-permission-denied-modal')).toBeTruthy();
      await act(async () => {
        fireEvent.press(await findByTestId('camera-permission-denied-open-settings'));
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
      });

      expect(unhandledRejection).not.toHaveBeenCalled();
      expect(await findByTestId('camera-permission-denied-modal')).toBeTruthy();
    } finally {
      process.off('unhandledRejection', unhandledRejection);
    }
  });

  it('keeps the denied Settings prompt stable when the initial permission check fails', async () => {
    mockInitialPermission = 'denied';
    mockCheckPermission.mockRejectedValue(new Error('Permission check failed'));
    const unhandledRejection = jest.fn();
    process.on('unhandledRejection', unhandledRejection);

    try {
      const { findByTestId } = render(wrap(<ScanScreen />));

      expect(await findByTestId('camera-permission-denied-modal')).toBeTruthy();
      await act(async () => {
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
      });

      expect(unhandledRejection).not.toHaveBeenCalled();
      expect(await findByTestId('camera-permission-denied-modal')).toBeTruthy();
    } finally {
      process.off('unhandledRejection', unhandledRejection);
    }
  });

  it('refreshes camera permission when the app becomes active again', async () => {
    mockInitialPermission = 'denied';
    mockCheckPermission.mockResolvedValueOnce('denied').mockResolvedValueOnce('granted');
    const remove = jest.fn();
    let appStateChangeListener: ((nextState: string) => void) | undefined;
    const addEventListener = jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
      appStateChangeListener = listener as (nextState: string) => void;
      return { remove };
    });
    const { unmount } = render(wrap(<ScanScreen />));

    await waitFor(() => expect(mockCheckPermission).toHaveBeenCalledTimes(1));
    expect(addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
    expect(appStateChangeListener).toEqual(expect.any(Function));

    await act(async () => {
      appStateChangeListener?.('background');
      appStateChangeListener?.('active');
    });

    await waitFor(() => expect(mockCheckPermission).toHaveBeenCalledTimes(2));
    expect(triggerScan).not.toBeNull();

    unmount();
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('found: navigates straight to the public Product screen', async () => {
    mockLookup.mockResolvedValue({ outcome: 'found', product: { id: 'prod-1' } });
    render(wrap(<ScanScreen />));

    await act(async () => triggerScan?.({ kind: 'barcode', value: '123' }));

    expect(navigation.replace).toHaveBeenCalledWith('Product', { id: 'prod-1' });
  });

  it('target=deal found: navigates straight to DealNew with productId', async () => {
    __setRouteParams({ target: 'deal' });
    mockLookup.mockResolvedValue({ outcome: 'found', product: { id: 'prod-deal-1' } });
    render(wrap(<ScanScreen />));

    await act(async () => triggerScan?.({ kind: 'barcode', value: '123' }));

    expect(navigation.replace).toHaveBeenCalledWith('DealNew', { productId: 'prod-deal-1' });
  });

  it('editable_private: routes to the draft editor entry point with productId + resume=edit', async () => {
    mockLookup.mockResolvedValue({ outcome: 'editable_private', product: { id: 'draft-1' } });
    render(wrap(<ScanScreen />));

    await act(async () => triggerScan?.({ kind: 'barcode', value: '123' }));

    expect(navigation.replace).toHaveBeenCalledWith('ProductNew', {
      barcode: '123',
      qr: '',
      productId: 'draft-1',
      resume: 'edit',
    });
  });

  it('creator_pending: routes to the read-only awaiting-review entry point with resume=pending', async () => {
    mockLookup.mockResolvedValue({ outcome: 'creator_pending', product: { id: 'pending-1' } });
    render(wrap(<ScanScreen />));

    await act(async () => triggerScan?.({ kind: 'qr', value: 'q-1' }));

    expect(navigation.replace).toHaveBeenCalledWith('ProductNew', {
      barcode: '',
      qr: 'q-1',
      productId: 'pending-1',
      resume: 'pending',
    });
  });

  it('under_review: shows no product metadata, offers a custom-item fallback, and never navigates or persists a private ID', async () => {
    mockLookup.mockResolvedValue({ outcome: 'under_review' });
    const { getByTestId, queryByText, findByTestId } = render(wrap(<ScanScreen />));

    await act(async () => triggerScan?.({ kind: 'barcode', value: '123' }));

    expect(await findByTestId('scan-under-review')).toBeTruthy();
    expect(navigation.replace).not.toHaveBeenCalled();
    // No product name/brand/etc leaked into this view.
    expect(queryByText(/prod-1|draft-1/)).toBeNull();

    fireEvent.press(getByTestId('scan-add-custom-item'));
    fireEvent.changeText(await findByTestId('scan-custom-item-name'), 'Frozen peas');
    fireEvent.press(getByTestId('scan-custom-item-continue'));

    fireEvent.changeText(await findByTestId('add-record-expiry-input'), '2099-12-31');
    fireEvent.press(getByTestId('add-record-save'));

    await waitFor(() =>
      expect(createLocalRecordMock).toHaveBeenCalledWith(
        expect.objectContaining({ productId: null, customName: 'Frozen peas' }),
      ),
    );
    // After a successful save the form must hand off to the pantry tabs —
    // regression coverage for the device report "item added but screen stuck".
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith('Tabs'));
  });

  it('not_found with canCreate=true: shows Create, which routes to a fresh ProductNew without a productId', async () => {
    mockLookup.mockResolvedValue({ outcome: 'not_found', canCreate: true });
    const { getByTestId, findByTestId } = render(wrap(<ScanScreen />));

    await act(async () => triggerScan?.({ kind: 'barcode', value: '999' }));

    expect(await findByTestId('scan-not-found')).toBeTruthy();
    fireEvent.press(getByTestId('scan-create'));
    expect(navigation.replace).toHaveBeenCalledWith('ProductNew', { barcode: '999', qr: '' });
  });

  it('target=deal not_found with canCreate=true: routes to ProductNew with target=deal', async () => {
    __setRouteParams({ target: 'deal' });
    mockLookup.mockResolvedValue({ outcome: 'not_found', canCreate: true });
    const { getByTestId, findByTestId } = render(wrap(<ScanScreen />));

    await act(async () => triggerScan?.({ kind: 'barcode', value: '999' }));

    expect(await findByTestId('scan-not-found')).toBeTruthy();
    fireEvent.press(getByTestId('scan-create'));
    expect(navigation.replace).toHaveBeenCalledWith('ProductNew', { barcode: '999', qr: '', target: 'deal' });
  });

  it('not_found with canCreate=false: does not offer Create at all', async () => {
    mockLookup.mockResolvedValue({ outcome: 'not_found', canCreate: false });
    const { queryByTestId, findByTestId } = render(wrap(<ScanScreen />));

    await act(async () => triggerScan?.({ kind: 'barcode', value: '999' }));

    expect(await findByTestId('scan-not-found')).toBeTruthy();
    expect(queryByTestId('scan-create')).toBeNull();
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  it('temporarily_unavailable: offers Retry + Scan again, never routes to creation', async () => {
    mockLookup.mockResolvedValue({ outcome: 'temporarily_unavailable' });
    const { findByTestId } = render(wrap(<ScanScreen />));

    await act(async () => triggerScan?.({ kind: 'barcode', value: '123' }));

    expect(await findByTestId('scan-unavailable')).toBeTruthy();
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  it('a thrown network error is treated as unavailable, never as not-found', async () => {
    mockLookup.mockRejectedValue(new Error('network down'));
    const { findByTestId, queryByTestId } = render(wrap(<ScanScreen />));

    await act(async () => triggerScan?.({ kind: 'barcode', value: '123' }));

    expect(await findByTestId('scan-unavailable')).toBeTruthy();
    expect(queryByTestId('scan-not-found')).toBeNull();
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  it('Retry repeats the exact same lookup without requiring a rescan', async () => {
    mockLookup.mockResolvedValueOnce({ outcome: 'temporarily_unavailable' });
    mockLookup.mockResolvedValueOnce({ outcome: 'found', product: { id: 'prod-2' } });
    const { getByTestId, findByTestId } = render(wrap(<ScanScreen />));

    await act(async () => triggerScan?.({ kind: 'barcode', value: '555' }));
    await findByTestId('scan-unavailable');

    await act(async () => fireEvent.press(getByTestId('scan-retry')));

    expect(mockLookup).toHaveBeenCalledTimes(2);
    expect(mockLookup).toHaveBeenNthCalledWith(2, { barcode: '555' });
    expect(navigation.replace).toHaveBeenCalledWith('Product', { id: 'prod-2' });
  });

  it('Scan again returns to the live camera view and clears the retained scan', async () => {
    mockLookup.mockResolvedValue({ outcome: 'not_found', canCreate: true });
    const { getByTestId, findByTestId, queryByTestId } = render(wrap(<ScanScreen />));

    await act(async () => triggerScan?.({ kind: 'barcode', value: '123' }));
    await findByTestId('scan-not-found');

    fireEvent.press(getByTestId('scan-again'));

    expect(queryByTestId('scan-not-found')).toBeNull();
    // A fresh scan now runs a brand-new lookup rather than reusing state.
    mockLookup.mockResolvedValueOnce({ outcome: 'found', product: { id: 'prod-3' } });
    await act(async () => triggerScan?.({ kind: 'qr', value: 'new-code' }));
    expect(navigation.replace).toHaveBeenCalledWith('Product', { id: 'prod-3' });
  });

  it('debounces/pauses: a second scan that arrives while a lookup is still in flight is ignored', async () => {
    let resolveLookup: ((v: unknown) => void) | undefined;
    mockLookup.mockReturnValue(new Promise((resolve) => (resolveLookup = resolve)));
    render(wrap(<ScanScreen />));

    await act(async () => {
      triggerScan?.({ kind: 'barcode', value: 'first' });
      triggerScan?.({ kind: 'barcode', value: 'second' });
    });

    expect(mockLookup).toHaveBeenCalledTimes(1);
    await act(async () => resolveLookup?.({ outcome: 'not_found', canCreate: true }));
  });
});
