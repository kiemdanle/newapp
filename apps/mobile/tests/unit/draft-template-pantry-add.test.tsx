import React from 'react';
import { act, fireEvent, waitFor } from '@testing-library/react-native';
import { renderWithTheme } from '../helpers/renderWithTheme';
import { DraftPantryAddModal } from '../../src/features/products/DraftPantryAddModal';
import * as recordsApi from '../../src/api/records';
import type { ProductDraftRow } from '@expyrico/shared';

jest.mock('../../src/api/records', () => {
  const actual = jest.requireActual('../../src/api/records');
  return {
    ...actual,
    createLocalRecord: jest.fn().mockResolvedValue('new-rec-id'),
  };
});

jest.mock('../../src/api/products', () => {
  const actual = jest.requireActual('../../src/api/products');
  return {
    ...actual,
    useProduct: () => ({ data: null }),
  };
});

jest.mock('../../src/api/households', () => ({
  useMyHouseholds: () => ({ data: { items: [] }, isLoading: false }),
}));

describe('DraftPantryAddModal Universal Add Contract', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const draftProduct: ProductDraftRow = {
    id: 'draft-product-uuid-1',
    name: 'Artisan Sourdough Template',
    identifier: { kind: 'barcode', value: '112233445566' },
    status: 'draft',
    version: 1,
    moderationFeedback: null,
    cover: null,
    updatedAt: '2026-09-01T00:00:00Z',
  };

  const changesRequiredProduct: ProductDraftRow = {
    ...draftProduct,
    id: 'changes-product-uuid-2',
    name: 'Organic Matcha Template',
    status: 'changes_required',
  };

  const activeProduct: ProductDraftRow = {
    ...draftProduct,
    id: 'active-product-uuid-3',
    name: 'Verified Catalog Milk',
    status: 'active',
  };

  it('unsubmitted draft template saves as an independent custom record (productId: null) avoiding assertProductUse rejection', async () => {
    const onSaved = jest.fn();
    const onClose = jest.fn();

    const { getByText, getByTestId } = renderWithTheme(
      <DraftPantryAddModal
        visible={true}
        product={draftProduct}
        onSaved={onSaved}
        onClose={onClose}
      />,
      'expyrico',
    );

    // Displays indicator that this is a personal template item
    expect(getByText('Template item · Personal pantry only')).toBeTruthy();
    expect(getByText('Artisan Sourdough Template')).toBeTruthy();

    // Select expiry preset and tap Save button
    fireEvent.press(getByText('+1w'));
    await act(async () => {
      fireEvent.press(getByTestId('add-record-save'));
    });

    await waitFor(() => {
      expect(recordsApi.createLocalRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          productId: null,
          customName: 'Artisan Sourdough Template',
          householdId: null,
        }),
      );
    });

    expect(onSaved).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('changes_required template saves as an independent custom record (productId: null)', async () => {
    const onSaved = jest.fn();
    const onClose = jest.fn();

    const { getByText, getByTestId } = renderWithTheme(
      <DraftPantryAddModal
        visible={true}
        product={changesRequiredProduct}
        onSaved={onSaved}
        onClose={onClose}
      />,
      'expyrico',
    );

    expect(getByText('Template item · Personal pantry only')).toBeTruthy();

    fireEvent.press(getByText('+1w'));
    await act(async () => {
      fireEvent.press(getByTestId('add-record-save'));
    });

    await waitFor(() => {
      expect(recordsApi.createLocalRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          productId: null,
          customName: 'Organic Matcha Template',
          householdId: null,
        }),
      );
    });
  });

  it('active catalog product attaches canonical productId and customName=null', async () => {
    const onSaved = jest.fn();
    const onClose = jest.fn();

    const { getByText, getByTestId, queryByText } = renderWithTheme(
      <DraftPantryAddModal
        visible={true}
        product={activeProduct}
        onSaved={onSaved}
        onClose={onClose}
      />,
      'expyrico',
    );

    // Active item does not show personal template restriction
    expect(queryByText('Template item · Personal pantry only')).toBeNull();

    fireEvent.press(getByText('+1w'));
    await act(async () => {
      fireEvent.press(getByTestId('add-record-save'));
    });

    await waitFor(() => {
      expect(recordsApi.createLocalRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          productId: 'active-product-uuid-3',
          customName: null,
        }),
      );
    });
  });
});
