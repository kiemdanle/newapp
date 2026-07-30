import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import ProductDetail from '../../app/(app)/product/[id]';
import { ThemeProvider } from '../../src/theme/ThemeProvider';
import { initThemeStore, useThemeStore } from '../../src/theme/store';
import { createQueryClient } from '../../src/api/query-client';
import { navigation, __setRouteParams } from '../../tests/mocks/react-navigation';
import { queueFetch, jsonResponse } from '../../tests/mocks/fetch';
import { useSessionStore } from '../../src/auth/session-store';
import { __reset } from '../../tests/mocks/react-native-keychain';

// This screen's OCR entry point pulls in native camera/ML-kit modules with
// no bearing on the "Suggest an edit" affordance this file actually tests —
// mocked at the component boundary, matching this repo's established
// pattern for a heavy subtree the test in question never needs to render.
jest.mock('../../src/features/expiry/OcrCamera', () => ({
  OcrCamera: () => null,
}));
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

function wrap(node: React.ReactNode) {
  return (
    <QueryClientProvider client={createQueryClient()}>
      <ThemeProvider>{node}</ThemeProvider>
    </QueryClientProvider>
  );
}

const PRODUCT = {
  id: 'p1',
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
  isCommunityEligible: true,
  buyAgainCount: 0,
  buyAgainOnSaleCount: 0,
  wontBuyCount: 0,
  ratingCount: 0,
  reviewCount: 0,
  status: 'active',
  version: 3,
  photos: [],
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  topReviews: [],
};

describe('<ProductDetail /> — Suggest an edit', () => {
  beforeEach(async () => {
    __reset();
    useThemeStore.setState({ themeId: 'expyrico', hydrated: false });
    await initThemeStore();
    useSessionStore.setState({ user: { id: 'user-1' } as never, accessToken: 'a', refreshToken: 'r', hydrated: true, pendingAuth: null });
    __setRouteParams({ id: 'p1' });
  });

  it('shows "Suggest an edit" for an active product and navigates to the edit screen', async () => {
    queueFetch(jsonResponse(PRODUCT));
    const { findByTestId } = render(wrap(<ProductDetail />));

    const button = await findByTestId('product-suggest-edit');
    fireEvent.press(button);

    expect(navigation.navigate).toHaveBeenCalledWith('ProductEdit', { id: 'p1' });
  });

  it('hides "Suggest an edit" for a non-active product', async () => {
    queueFetch(jsonResponse({ ...PRODUCT, status: 'pending' }));
    const { findByTestId, queryByTestId } = render(wrap(<ProductDetail />));

    await findByTestId('add-record-save');
    expect(queryByTestId('product-suggest-edit')).toBeNull();
  });
});
