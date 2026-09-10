import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
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

    const { getByText, getByTestId } = renderWithProviders(
      <DraftSwipeableRow
        item={mockDraftItem}
        onPress={onPress}
        onEdit={onEdit}
      />,
    );

    expect(getByText('Organic Milk')).toBeTruthy();
    expect(getByText('Draft')).toBeTruthy();
    expect(getByTestId('draft-row-cover-placeholder')).toBeTruthy();
  });

  it('renders moderation feedback when changes_required', () => {
    const { getByText } = renderWithProviders(
      <DraftSwipeableRow
        item={mockChangesItem}
        onPress={jest.fn()}
        onEdit={jest.fn()}
      />,
    );

    expect(getByText('Changes requested')).toBeTruthy();
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

  it('renders Edit and Delete actions on draft items (Add to Pantry hidden)', () => {
    const onEdit = jest.fn();
    const onDelete = jest.fn();
    const onAddToPantry = jest.fn();

    const { getByTestId, queryByTestId } = renderWithProviders(
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

    expect(editBtn).toBeTruthy();
    expect(deleteBtn).toBeTruthy();
    expect(queryByTestId('draft-swipe-add-draft-item-1')).toBeNull();

    fireEvent.press(editBtn);
    expect(onEdit).toHaveBeenCalledWith(mockDraftItem);

    fireEvent.press(deleteBtn);
    expect(onDelete).toHaveBeenCalledWith(mockDraftItem);
  });

  it('renders Edit and Add to Pantry on active items (Delete action hidden)', () => {
    const onEdit = jest.fn();
    const onDelete = jest.fn();
    const onAddToPantry = jest.fn();

    const { getByTestId, queryByTestId } = renderWithProviders(
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

    expect(editBtn).toBeTruthy();
    expect(addBtn).toBeTruthy();
    expect(queryByTestId('draft-swipe-delete-active-item-1')).toBeNull();

    fireEvent.press(addBtn);
    expect(onAddToPantry).toHaveBeenCalledWith(mockActiveItem);
  });

  it('renders Edit and Add to Pantry on pending items (Delete action hidden)', () => {
    const onAddToPantry = jest.fn();
    const { getByTestId, queryByTestId } = renderWithProviders(
      <DraftSwipeableRow
        item={mockPendingItem}
        onPress={jest.fn()}
        onEdit={jest.fn()}
        onDelete={jest.fn()}
        onAddToPantry={onAddToPantry}
      />,
    );

    expect(getByTestId('draft-swipe-add-pending-item-1')).toBeTruthy();
    expect(queryByTestId('draft-swipe-delete-pending-item-1')).toBeNull();
  });

  it('renders Delete action on changes_required items (Add to Pantry hidden)', () => {
    const onDelete = jest.fn();
    const { getByTestId, queryByTestId } = renderWithProviders(
      <DraftSwipeableRow
        item={mockChangesItem}
        onPress={jest.fn()}
        onEdit={jest.fn()}
        onDelete={onDelete}
        onAddToPantry={jest.fn()}
      />,
    );

    expect(getByTestId('draft-swipe-delete-changes-item-1')).toBeTruthy();
    expect(queryByTestId('draft-swipe-add-changes-item-1')).toBeNull();

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
