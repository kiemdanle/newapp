import React from 'react';
import { fireEvent, render, within } from '@testing-library/react-native';
import { DraftSwipeableRow } from '../DraftSwipeableRow';
import type { ProductDraftRow } from '@expyrico/shared';
import { ThemeProvider } from '../../../theme/ThemeProvider';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockDraftItem: ProductDraftRow = {
  id: 'draft-item-1',
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
  id: 'active-item-1',
  name: 'Whole Grain Bread',
  status: 'active',
};

const mockPendingItem: ProductDraftRow = {
  ...mockDraftItem,
  id: 'pending-item-1',
  name: 'Almond Butter',
  status: 'pending',
};

const mockChangesItem: ProductDraftRow = {
  ...mockDraftItem,
  id: 'changes-item-1',
  name: 'Olive Oil',
  status: 'changes_required',
  moderationFeedback: 'Please provide clearer ingredient label photo',
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

describe('DraftSwipeableRow', () => {
  it('renders product name, status pill, and placeholder when no cover exists', () => {
    const onPress = jest.fn();
    const onEdit = jest.fn();

    const { getByTestId } = renderWithProviders(
      <DraftSwipeableRow
        item={mockDraftItem}
        onPress={onPress}
        onEdit={onEdit}
      />,
    );

    const row = within(getByTestId('draft-row-draft-item-1'));
    expect(row.getByText('Organic Milk')).toBeTruthy();
    expect(row.getByText('Draft')).toBeTruthy();
    expect(getByTestId('draft-row-cover-placeholder')).toBeTruthy();
  });

  it('renders moderation feedback when changes_required', () => {
    const { getByText, getByTestId } = renderWithProviders(
      <DraftSwipeableRow
        item={mockChangesItem}
        onPress={jest.fn()}
        onEdit={jest.fn()}
      />,
    );

    const row = within(getByTestId('draft-row-changes-item-1'));
    expect(row.getByText('Changes requested')).toBeTruthy();
    expect(getByText('Please provide clearer ingredient label photo')).toBeTruthy();
  });

  it('calls onPress when main row card is pressed', () => {
    const onPress = jest.fn();
    const { getByTestId } = renderWithProviders(
      <DraftSwipeableRow
        item={mockDraftItem}
        onPress={onPress}
        onEdit={jest.fn()}
      />,
    );

    fireEvent.press(getByTestId('draft-row-draft-item-1'));
    expect(onPress).toHaveBeenCalledWith(mockDraftItem);
  });

  it('renders Edit, Add, and Delete actions on draft items', () => {
    const onEdit = jest.fn();
    const onDelete = jest.fn();
    const onAddToPantry = jest.fn();

    const { getByTestId } = renderWithProviders(
      <DraftSwipeableRow
        item={mockDraftItem}
        onPress={jest.fn()}
        onEdit={onEdit}
        onDelete={onDelete}
        onAddToPantry={onAddToPantry}
      />,
    );

    const editBtn = getByTestId('draft-swipe-edit-draft-item-1');
    const deleteBtn = getByTestId('draft-swipe-delete-draft-item-1');
    const addBtn = getByTestId('draft-swipe-add-draft-item-1');

    expect(editBtn).toBeTruthy();
    expect(deleteBtn).toBeTruthy();
    expect(addBtn).toBeTruthy();

    fireEvent.press(editBtn);
    expect(onEdit).toHaveBeenCalledWith(mockDraftItem);

    fireEvent.press(deleteBtn);
    expect(onDelete).toHaveBeenCalledWith(mockDraftItem);

    fireEvent.press(addBtn);
    expect(onAddToPantry).toHaveBeenCalledWith(mockDraftItem);
  });

  it('renders Edit, Add, and Delete on active items', () => {
    const onEdit = jest.fn();
    const onDelete = jest.fn();
    const onAddToPantry = jest.fn();

    const { getByTestId } = renderWithProviders(
      <DraftSwipeableRow
        item={mockActiveItem}
        onPress={jest.fn()}
        onEdit={onEdit}
        onDelete={onDelete}
        onAddToPantry={onAddToPantry}
      />,
    );

    const editBtn = getByTestId('draft-swipe-edit-active-item-1');
    const addBtn = getByTestId('draft-swipe-add-active-item-1');
    const deleteBtn = getByTestId('draft-swipe-delete-active-item-1');

    expect(editBtn).toBeTruthy();
    expect(addBtn).toBeTruthy();
    expect(deleteBtn).toBeTruthy();

    fireEvent.press(addBtn);
    expect(onAddToPantry).toHaveBeenCalledWith(mockActiveItem);

    fireEvent.press(deleteBtn);
    expect(onDelete).toHaveBeenCalledWith(mockActiveItem);
  });

  it('renders Edit, Add, and Delete on pending items', () => {
    const onAddToPantry = jest.fn();
    const onDelete = jest.fn();
    const { getByTestId } = renderWithProviders(
      <DraftSwipeableRow
        item={mockPendingItem}
        onPress={jest.fn()}
        onEdit={jest.fn()}
        onDelete={onDelete}
        onAddToPantry={onAddToPantry}
      />,
    );

    expect(getByTestId('draft-swipe-add-pending-item-1')).toBeTruthy();
    expect(getByTestId('draft-swipe-delete-pending-item-1')).toBeTruthy();
    expect(getByTestId('draft-swipe-edit-pending-item-1')).toBeTruthy();
  });

  it('renders Edit, Add, and Delete on changes_required items', () => {
    const onDelete = jest.fn();
    const onAddToPantry = jest.fn();
    const { getByTestId } = renderWithProviders(
      <DraftSwipeableRow
        item={mockChangesItem}
        onPress={jest.fn()}
        onEdit={jest.fn()}
        onDelete={onDelete}
        onAddToPantry={onAddToPantry}
      />,
    );

    expect(getByTestId('draft-swipe-delete-changes-item-1')).toBeTruthy();
    expect(getByTestId('draft-swipe-add-changes-item-1')).toBeTruthy();
    expect(getByTestId('draft-swipe-edit-changes-item-1')).toBeTruthy();

    fireEvent.press(getByTestId('draft-swipe-delete-changes-item-1'));
    expect(onDelete).toHaveBeenCalledWith(mockChangesItem);
  });

  it('disables swipe action buttons when isSubmitting is true', () => {
    const onDelete = jest.fn();
    const { getByTestId } = renderWithProviders(
      <DraftSwipeableRow
        item={mockDraftItem}
        onPress={jest.fn()}
        onEdit={jest.fn()}
        onDelete={onDelete}
        isSubmitting={true}
      />,
    );

    const deleteBtn = getByTestId('draft-swipe-delete-draft-item-1');
    expect(deleteBtn.props.accessibilityState?.disabled).toBe(true);
  });
});
