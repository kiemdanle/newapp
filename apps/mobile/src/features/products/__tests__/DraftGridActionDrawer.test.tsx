import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { DraftGridActionDrawer } from '../DraftGridActionDrawer';
import type { ProductDraftRow } from '@expyrico/shared';
import { ThemeProvider } from '../../../theme/ThemeProvider';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockDraftItem: ProductDraftRow = {
  id: 'grid-draft-1',
  name: 'Organic Milk',
  identifier: { kind: 'barcode', value: '123456789' },
  status: 'draft',
  version: 1,
  moderationFeedback: null,
  cover: null,
  updatedAt: '2026-09-09T10:00:00.000Z',
};

const mockActiveItem: ProductDraftRow = {
  ...mockDraftItem,
  id: 'grid-active-1',
  name: 'Whole Grain Bread',
  status: 'active',
};

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>{ui}</ThemeProvider>
    </QueryClientProvider>,
  );
}

describe('DraftGridActionDrawer', () => {
  it('renders draft name in header and close button', () => {
    const onClose = jest.fn();
    const { getByText, getByTestId } = renderWithProviders(
      <DraftGridActionDrawer
        item={mockDraftItem}
        onEdit={jest.fn()}
        onClose={onClose}
      />,
    );

    expect(getByText('Organic Milk')).toBeTruthy();
    const closeBtn = getByTestId('draft-close-actions-grid-draft-1');
    expect(closeBtn).toBeTruthy();

    fireEvent.press(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });

  it('renders Edit, Add, and Delete actions for draft items', () => {
    const onEdit = jest.fn();
    const onDelete = jest.fn();
    const onAddToPantry = jest.fn();
    const onClose = jest.fn();

    const { getByTestId, getByText } = renderWithProviders(
      <DraftGridActionDrawer
        item={mockDraftItem}
        onEdit={onEdit}
        onDelete={onDelete}
        onAddToPantry={onAddToPantry}
        onClose={onClose}
      />,
    );

    expect(getByText('Edit')).toBeTruthy();
    expect(getByText('Delete')).toBeTruthy();
    expect(getByText('Add')).toBeTruthy();
    expect(getByTestId('draft-grid-action-edit-grid-draft-1')).toBeTruthy();
    expect(getByTestId('draft-grid-action-delete-grid-draft-1')).toBeTruthy();
    expect(getByTestId('draft-grid-action-add-grid-draft-1')).toBeTruthy();

    fireEvent.press(getByTestId('draft-grid-action-edit-grid-draft-1'));
    expect(onClose).toHaveBeenCalled();
    expect(onEdit).toHaveBeenCalledWith(mockDraftItem);

    fireEvent.press(getByTestId('draft-grid-action-delete-grid-draft-1'));
    expect(onDelete).toHaveBeenCalledWith(mockDraftItem);
  });

  it('renders Edit, Add, and Delete for active items', () => {
    const onAddToPantry = jest.fn();
    const onDelete = jest.fn();
    const onClose = jest.fn();

    const { getByTestId, getByText } = renderWithProviders(
      <DraftGridActionDrawer
        item={mockActiveItem}
        onEdit={jest.fn()}
        onDelete={onDelete}
        onAddToPantry={onAddToPantry}
        onClose={onClose}
      />,
    );

    expect(getByText('Add')).toBeTruthy();
    expect(getByText('Delete')).toBeTruthy();
    expect(getByTestId('draft-grid-action-add-grid-active-1')).toBeTruthy();
    expect(getByTestId('draft-grid-action-delete-grid-active-1')).toBeTruthy();

    fireEvent.press(getByTestId('draft-grid-action-add-grid-active-1'));
    expect(onClose).toHaveBeenCalled();
    expect(onAddToPantry).toHaveBeenCalledWith(mockActiveItem);
  });

  it('disables action triggers when isProcessing is true', () => {
    const onEdit = jest.fn();
    const onDelete = jest.fn();
    const onClose = jest.fn();

    const { getByTestId } = renderWithProviders(
      <DraftGridActionDrawer
        item={mockDraftItem}
        onEdit={onEdit}
        onDelete={onDelete}
        onClose={onClose}
        isProcessing={true}
      />,
    );

    fireEvent.press(getByTestId('draft-grid-action-edit-grid-draft-1'));
    expect(onEdit).not.toHaveBeenCalled();

    fireEvent.press(getByTestId('draft-grid-action-delete-grid-draft-1'));
    expect(onDelete).not.toHaveBeenCalled();
  });
});
