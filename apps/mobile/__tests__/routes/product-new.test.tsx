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

  it('the submit button remains enabled when metadata text is edited, allowing 1-tap post', async () => {
    __setRouteParams({ productId: 'draft-1', resume: 'edit' });
    queueFetch(jsonResponse(PRODUCT));

    const { findByTestId, getByTestId } = render(wrap(<NewProductScreen />));
    await findByTestId('draft-name');

    expect(getByTestId('draft-submit').props.accessibilityState.disabled).toBe(false);

    fireEvent.changeText(getByTestId('draft-name'), 'Edited name');
    // 1-tap post: submit button remains available to flush and submit directly
    expect(getByTestId('draft-submit').props.accessibilityState.disabled).toBe(false);
  });

  it('submitting a pending draft continues to a personal-scope-locked pantry form with review notice', async () => {
    __setRouteParams({ barcode: '123', productId: 'draft-1', resume: 'edit' });
    queueFetch(jsonResponse(PRODUCT));
    await AsyncStorage.setItem(
      'pantry.productDraftIndex.v1.user-1',
      JSON.stringify({ 'barcode:123': { productId: 'draft-1', identifier: { barcode: '123' }, updatedAt: '2026-01-01T00:00:00Z' } }),
    );

    const { findByTestId, getByTestId, findByText } = render(wrap(<NewProductScreen />));
    await findByTestId('draft-name');

    queueFetch(jsonResponse({ ...PRODUCT, status: 'pending', version: 2 }));
    fireEvent.press(getByTestId('draft-submit'));

    expect(await findByTestId('new-product-submitted-message')).toBeTruthy();
    expect(await findByText('Submitted for review — you can add it to your pantry now.')).toBeTruthy();
    expect(mockExecuteAssessment).toHaveBeenCalledTimes(1);
    expect(getByTestId('add-record-save')).toBeTruthy();

    await waitFor(async () => {
      const stored = await AsyncStorage.getItem('pantry.productDraftIndex.v1.user-1');
      expect(stored).not.toContain('draft-1');
    });
  });

  it('submitting an auto-approved draft (status: active) displays "Published to catalog" confirmation', async () => {
    __setRouteParams({ barcode: '123', productId: 'draft-1', resume: 'edit' });
    queueFetch(jsonResponse(PRODUCT));
    await AsyncStorage.setItem(
      'pantry.productDraftIndex.v1.user-1',
      JSON.stringify({ 'barcode:123': { productId: 'draft-1', identifier: { barcode: '123' }, updatedAt: '2026-01-01T00:00:00Z' } }),
    );

    const { findByTestId, getByTestId, findByText } = render(wrap(<NewProductScreen />));
    await findByTestId('draft-name');

    queueFetch(jsonResponse({ ...PRODUCT, status: 'active', version: 2 }));
    fireEvent.press(getByTestId('draft-submit'));

    expect(await findByTestId('new-product-submitted-message')).toBeTruthy();
    expect(await findByText('Published to catalog — you can add it to your pantry now.')).toBeTruthy();
    expect(mockExecuteAssessment).toHaveBeenCalledTimes(1);
    expect(getByTestId('add-record-save')).toBeTruthy();
  });

  it('target=deal: submitting a draft navigates directly to DealNew with the submitted productId', async () => {
    __setRouteParams({ barcode: '123', productId: 'draft-1', resume: 'edit', target: 'deal' });
    queueFetch(jsonResponse(PRODUCT));

    const { findByTestId, getByTestId } = render(wrap(<NewProductScreen />));
    await findByTestId('draft-name');

    queueFetch(jsonResponse({ ...PRODUCT, status: 'pending', version: 2 }));
    fireEvent.press(getByTestId('draft-submit'));

    await waitFor(() => {
      expect(navigation.navigate).toHaveBeenCalledWith('DealNew', { productId: 'draft-1' });
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

  it('submitting a draft shows Close, Done, and Skip buttons that exit the screen', async () => {
    __setRouteParams({ barcode: '123', productId: 'draft-1', resume: 'edit' });
    queueFetch(jsonResponse(PRODUCT));

    const { findByTestId, getByTestId } = render(wrap(<NewProductScreen />));
    await findByTestId('draft-name');

    queueFetch(jsonResponse({ ...PRODUCT, status: 'active', version: 2 }));
    fireEvent.press(getByTestId('draft-submit'));

    const closeBtn = await findByTestId('product-submitted-close-btn');
    const doneBtn = await findByTestId('product-submitted-done-btn');
    const skipBtn = await findByTestId('product-submitted-skip-btn');

    expect(closeBtn).toBeTruthy();
    expect(doneBtn).toBeTruthy();
    expect(skipBtn).toBeTruthy();

    fireEvent.press(skipBtn);
    expect(navigation.goBack).toHaveBeenCalled();
  });

  it('dirty untitled draft: prompts with alert on back navigation instead of silently deleting', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch');
    __setRouteParams({ productId: 'draft-empty-1', resume: 'edit' });
    queueFetch(jsonResponse({ ...PRODUCT, id: 'draft-empty-1', name: '' }));
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);

    const { findByTestId, getByTestId } = render(wrap(<NewProductScreen />));
    await findByTestId('draft-name');
    fireEvent.changeText(getByTestId('draft-name'), 'Brand New Name');

    const beforeRemoveCalls = (navigation.addListener as jest.Mock).mock.calls.filter(([event]) => event === 'beforeRemove');
    expect(beforeRemoveCalls.length).toBeGreaterThan(0);
    const latestBeforeRemove = beforeRemoveCalls[beforeRemoveCalls.length - 1];
    const preventDefault = jest.fn();
    latestBeforeRemove[1]({ preventDefault, data: { action: {} } });

    expect(preventDefault).toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledWith(
      'Discard unsaved changes?',
      expect.any(String),
      expect.any(Array),
    );
    expect(fetchSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('/products/drafts/draft-empty-1'),
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('dirty untitled draft: close button prompts with alert instead of silently deleting', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch');
    __setRouteParams({ productId: 'draft-empty-1', resume: 'edit' });
    queueFetch(jsonResponse({ ...PRODUCT, id: 'draft-empty-1', name: '' }));
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);

    const { findByTestId, getByTestId } = render(wrap(<NewProductScreen />));
    await findByTestId('draft-name');
    fireEvent.changeText(getByTestId('draft-name'), 'Fresh changes');

    fireEvent.press(getByTestId('product-new-close-btn'));

    expect(alertSpy).toHaveBeenCalledWith(
      'Discard unsaved changes?',
      expect.any(String),
      expect.any(Array),
    );
    expect(fetchSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('/products/drafts/draft-empty-1'),
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('clean untitled draft with existing photos is preserved on exit without silent deletion', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch');
    __setRouteParams({ productId: 'draft-photo-1', resume: 'edit' });
    queueFetch(
      jsonResponse({
        ...PRODUCT,
        id: 'draft-photo-1',
        name: '',
        photos: [{ id: 'ph-1', position: 0, publicUrl: 'http://cdn/ph1.jpg' }],
      }),
    );

    const { findByTestId, getByTestId } = render(wrap(<NewProductScreen />));
    await findByTestId('draft-name');

    fireEvent.press(getByTestId('product-new-close-btn'));

    expect(navigation.goBack).toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('/products/drafts/draft-photo-1'),
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('clean untitled draft without photos discards placeholder and handles failed DELETE gracefully', async () => {
    __setRouteParams({ productId: 'draft-clean-1', resume: 'edit' });
    queueFetch(jsonResponse({ ...PRODUCT, id: 'draft-clean-1', name: '', photos: [] }));

    const { findByTestId, getByTestId } = render(wrap(<NewProductScreen />));
    await findByTestId('draft-name');

    // Mock DELETE failure
    queueFetch(problemResponse('internal_error', 500, 'Server error'));

    // Should not throw or crash
    await act(async () => {
      fireEvent.press(getByTestId('product-new-close-btn'));
    });
    await waitFor(() => expect(navigation.goBack).toHaveBeenCalled());
  });
  it('clean untitled draft without photos: back navigation calls DELETE with emptyOnly=true and expectedVersion', async () => {
    __setRouteParams({ productId: 'draft-clean-back-1', resume: 'edit', barcode: '123' });
    const fetchMock = queueFetch(
      jsonResponse({ ...PRODUCT, id: 'draft-clean-back-1', name: '', photos: [], version: 1 }),
      jsonResponse({ success: true, id: 'draft-clean-back-1', deleted: true }),
    );

    const { findByTestId } = render(wrap(<NewProductScreen />));
    await findByTestId('draft-name');

    const beforeRemoveCalls = (navigation.addListener as jest.Mock).mock.calls.filter(([event]) => event === 'beforeRemove');
    expect(beforeRemoveCalls.length).toBeGreaterThan(0);
    const latestBeforeRemove = beforeRemoveCalls[beforeRemoveCalls.length - 1];
    const preventDefault = jest.fn();

    await act(async () => {
      await latestBeforeRemove[1]({ preventDefault, data: { action: { type: 'GO_BACK' } } });
    });

    expect(preventDefault).toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/products/drafts/draft-clean-back-1?emptyOnly=true&expectedVersion=1'),
      expect.objectContaining({ method: 'DELETE' }),
    );
    expect(navigation.dispatch).toHaveBeenCalledWith({ type: 'GO_BACK' });
  });

  it('PATCH settling while discard alert is open: choosing Discard sends emptyOnly and expectedVersion', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch');
    __setRouteParams({ productId: 'draft-race-1', resume: 'edit', barcode: '123' });
    queueFetch(jsonResponse({ ...PRODUCT, id: 'draft-race-1', name: '', photos: [], version: 1 }));
    let alertButtons: any[] = [];
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      alertButtons = buttons || [];
    });

    const { findByTestId, getByTestId } = render(wrap(<NewProductScreen />));
    await findByTestId('draft-name');
    fireEvent.changeText(getByTestId('draft-name'), 'Concurrent Saved Name');

    // Trigger close which opens the Discard alert
    fireEvent.press(getByTestId('product-new-close-btn'));

    expect(alertButtons.length).toBe(2);
    const discardBtn = alertButtons.find((b) => b.text === 'Discard');
    expect(discardBtn).toBeTruthy();

    // Mock the backend response when emptyOnly is checked (settled mutation rejects delete)
    const deleteMock = queueFetch(jsonResponse({ success: true, id: 'draft-race-1', deleted: false }));

    await act(async () => {
      await discardBtn.onPress();
    });

    // Verify it sent emptyOnly=true and expectedVersion=1
    expect(deleteMock).toHaveBeenCalledWith(
      expect.stringContaining('/products/drafts/draft-race-1?emptyOnly=true&expectedVersion=1'),
      expect.objectContaining({ method: 'DELETE' }),
    );
    expect(navigation.goBack).toHaveBeenCalled();
  });
});
