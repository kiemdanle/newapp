import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, waitFor, act } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import NewProductScreen from '../../app/(app)/product/new';
import { ThemeProvider } from '../../src/theme/ThemeProvider';
import { initThemeStore, useThemeStore } from '../../src/theme/store';
import { createQueryClient } from '../../src/api/query-client';
import { navigation, __setRouteParams } from '../../tests/mocks/react-navigation';
import { queueFetch, jsonResponse, problemResponse } from '../../tests/mocks/fetch';
import { useSessionStore } from '../../src/auth/session-store';
import { __reset } from '../../tests/mocks/react-native-keychain';
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('../../src/features/push/registerPushToken', () => ({
  ensurePushTokenRegistered: jest.fn().mockResolvedValue(undefined),
}));
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
// The editable-draft branch now mounts ProductPhotoEditor (Task 7 wiring) —
// its picker adapter's own native import must not crash a Jest environment
// with no native module registered, matching photo-picker-adapter.test.ts /
// ProductPhotoEditor.test.tsx's own stub.
jest.mock('react-native-image-crop-picker', () => ({
  __esModule: true,
  default: { openCamera: jest.fn(), openPicker: jest.fn(), cleanSingle: jest.fn() },
}));
// DraftSubmitPanel mints a real reCAPTCHA token via this module — mocked at
// this level (rather than the native SDK underneath it) so each test
// controls success/failure directly without provisioning a fake site key.
const mockExecuteAssessment = jest.fn().mockResolvedValue({ token: 'tok-1', platform: 'android' });
jest.mock('../../src/security/product-creation-assessment', () => ({
  executeProductSubmitAssessment: () => mockExecuteAssessment(),
}));

function wrap(node: React.ReactNode) {
  return (
    <QueryClientProvider client={createQueryClient()}>
      <ThemeProvider>{node}</ThemeProvider>
    </QueryClientProvider>
  );
}

const PRODUCT = {
  id: 'draft-1',
  barcode: '123',
  qrPayload: null,
  name: 'Frozen peas',
  description: null,
  brand: null,
  category: null,
  imageUrl: null,
  defaultShelfLifeDays: null,
  source: 'user',
  sourceId: null,
  isCommunityEligible: false,
  buyAgainCount: 0,
  buyAgainOnSaleCount: 0,
  wontBuyCount: 0,
  ratingCount: 0,
  reviewCount: 0,
  status: 'draft',
  version: 1,
  photos: [],
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

describe('<NewProductScreen />', () => {
  beforeEach(async () => {
    __reset();
    await AsyncStorage.clear();
    mockExecuteAssessment.mockClear();
    mockExecuteAssessment.mockResolvedValue({ token: 'tok-1', platform: 'android' });
    useThemeStore.setState({ themeId: 'expyrico', hydrated: false });
    await initThemeStore();
    useSessionStore.setState({ user: { id: 'user-1' } as never, accessToken: 'a', refreshToken: 'r', hydrated: true, pendingAuth: null });
    __setRouteParams({});
  });

  it('creates a draft from a scanned identifier and persists a local mapping', async () => {
    __setRouteParams({ barcode: '123' });
    queueFetch(jsonResponse({ product: PRODUCT, resumed: false }));

    const { getByTestId } = render(wrap(<NewProductScreen />));
    fireEvent.changeText(getByTestId('new-product-name'), 'Frozen peas');
    await act(async () => fireEvent.press(getByTestId('new-product-create')));

    await waitFor(async () => {
      const stored = await AsyncStorage.getItem('pantry.productDraftIndex.v1.user-1');
      expect(stored).toContain('draft-1');
    });
  });

  it('resume=edit renders the editable draft form with the feedback banner when provided', async () => {
    __setRouteParams({ productId: 'draft-1', resume: 'edit', feedback: 'Please add a clearer name' });
    queueFetch(jsonResponse(PRODUCT));

    const { findByTestId, getByText } = render(wrap(<NewProductScreen />));

    expect(await findByTestId('draft-name')).toBeTruthy();
    expect(getByText('Please add a clearer name')).toBeTruthy();
  });

  it('resume=pending renders a read-only form plus personal-pantry continuation', async () => {
    __setRouteParams({ productId: 'draft-1', resume: 'pending' });
    queueFetch(jsonResponse({ ...PRODUCT, status: 'pending' }));

    const { findByTestId, getByTestId } = render(wrap(<NewProductScreen />));

    expect(await findByTestId('draft-name')).toBeTruthy();
    expect(getByTestId('draft-name').props.editable).toBe(false);
    expect(getByTestId('add-record-save')).toBeTruthy();
  });

  it('prompts before discarding unsaved edits on back navigation', async () => {
    __setRouteParams({ productId: 'draft-1', resume: 'edit' });
    queueFetch(jsonResponse(PRODUCT));
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);

    const { findByTestId, getByTestId } = render(wrap(<NewProductScreen />));
    await findByTestId('draft-name');
    fireEvent.changeText(getByTestId('draft-name'), 'Edited name');

    const beforeRemoveCall = (navigation.addListener as jest.Mock).mock.calls.find(([event]) => event === 'beforeRemove');
    expect(beforeRemoveCall).toBeTruthy();
    const preventDefault = jest.fn();
    beforeRemoveCall![1]({ preventDefault, data: { action: {} } });

    expect(preventDefault).toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledWith(
      'Discard unsaved changes?',
      expect.any(String),
      expect.any(Array),
    );
  });

  it('explicit discard clears the locally-stored draft mapping', async () => {
    __setRouteParams({ barcode: '123', productId: 'draft-1', resume: 'edit' });
    queueFetch(jsonResponse(PRODUCT));
    await AsyncStorage.setItem(
      'pantry.productDraftIndex.v1.user-1',
      JSON.stringify({ 'barcode:123': { productId: 'draft-1', identifier: { barcode: '123' }, updatedAt: '2026-01-01T00:00:00Z' } }),
    );

    const { findByTestId, getByTestId } = render(wrap(<NewProductScreen />));
    await findByTestId('draft-name');
    fireEvent.press(getByTestId('new-product-discard'));

    await waitFor(async () => {
      const stored = await AsyncStorage.getItem('pantry.productDraftIndex.v1.user-1');
      expect(stored).not.toContain('draft-1');
    });
  });

  it('the submit button becomes disabled once metadata text is edited but not yet saved', async () => {
    __setRouteParams({ productId: 'draft-1', resume: 'edit' });
    queueFetch(jsonResponse(PRODUCT));

    const { findByTestId, getByTestId } = render(wrap(<NewProductScreen />));
    await findByTestId('draft-name');

    // Nothing dirty yet — submit is available.
    expect(getByTestId('draft-submit').props.accessibilityState.disabled).toBe(false);

    fireEvent.changeText(getByTestId('draft-name'), 'Edited name');
    expect(getByTestId('draft-submit').props.accessibilityState.disabled).toBe(true);
  });

  it('submitting a no-photo draft flushes metadata, mints a fresh token, clears the local draft mapping, and continues to a personal-scope-locked pantry form', async () => {
    __setRouteParams({ barcode: '123', productId: 'draft-1', resume: 'edit' });
    queueFetch(jsonResponse(PRODUCT));
    await AsyncStorage.setItem(
      'pantry.productDraftIndex.v1.user-1',
      JSON.stringify({ 'barcode:123': { productId: 'draft-1', identifier: { barcode: '123' }, updatedAt: '2026-01-01T00:00:00Z' } }),
    );

    const { findByTestId, getByTestId } = render(wrap(<NewProductScreen />));
    await findByTestId('draft-name');

    queueFetch(jsonResponse({ ...PRODUCT, status: 'pending', version: 2 }));
    fireEvent.press(getByTestId('draft-submit'));

    expect(await findByTestId('new-product-submitted-message')).toBeTruthy();
    expect(mockExecuteAssessment).toHaveBeenCalledTimes(1);
    expect(getByTestId('add-record-save')).toBeTruthy();

    await waitFor(async () => {
      const stored = await AsyncStorage.getItem('pantry.productDraftIndex.v1.user-1');
      expect(stored).not.toContain('draft-1');
    });
  });

  it('an abuse-rejected submission shows the failure and preserves the draft on-screen', async () => {
    __setRouteParams({ productId: 'draft-1', resume: 'edit' });
    queueFetch(jsonResponse(PRODUCT));

    const { findByTestId, getByTestId } = render(wrap(<NewProductScreen />));
    await findByTestId('draft-name');

    queueFetch(problemResponse('abuse_check_failed', 403, "We couldn't verify this submission"));
    fireEvent.press(getByTestId('draft-submit'));

    expect(await findByTestId('draft-submit-error')).toBeTruthy();
    // Still the editable draft screen — no continuation, nothing discarded.
    expect(getByTestId('draft-name')).toBeTruthy();
  });
});
