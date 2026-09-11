import React from 'react';
import { Alert, Animated, StyleSheet } from 'react-native';
import { act, fireEvent, render, waitFor, within } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import ProductDraftsScreen from '../../app/(app)/product/drafts';
import { ThemeProvider } from '../../src/theme/ThemeProvider';
import { initThemeStore, useThemeStore } from '../../src/theme/store';
import { createQueryClient, clearQueryClient } from '../../src/api/query-client';
import { navigation } from '../../tests/mocks/react-navigation';
import { queueFetch, jsonResponse, problemResponse } from '../../tests/mocks/fetch';
import { useSessionStore } from '../../src/auth/session-store';
import { __reset } from '../../tests/mocks/react-native-keychain';
import { useUiPreferencesStore } from '../../src/store/uiPreferencesStore';
function wrap(node: React.ReactNode) {
  return (
    <QueryClientProvider client={createQueryClient()}>
      <ThemeProvider>{node}</ThemeProvider>
    </QueryClientProvider>
  );
}

const DRAFT_ROW = {
  id: 'draft-1',
  name: 'Frozen peas',
  identifier: { kind: 'barcode', value: '123' },
  status: 'draft',
  version: 1,
  moderationFeedback: null,
  cover: null,
  updatedAt: '2026-01-01T00:00:00Z',
};

const CHANGES_ROW = {
  ...DRAFT_ROW,
  id: 'draft-2',
  name: 'Canned beans',
  identifier: { kind: 'qr', value: 'q-1' },
  status: 'changes_required',
  moderationFeedback: 'Please add a clearer name',
};

describe('<ProductDraftsScreen />', () => {
  beforeEach(async () => {
    __reset();
    useThemeStore.setState({ themeId: 'expyrico', hydrated: false });
    useUiPreferencesStore.setState({ draftsViewMode: 'list' });
    await initThemeStore();
    useSessionStore.setState({ user: { id: 'user-1' } as never, accessToken: 'a', refreshToken: 'r', hydrated: true, pendingAuth: null });
  });
  afterEach(() => {
    clearQueryClient();
    jest.clearAllMocks();
  });


  it('shows an empty state when there are no drafts', async () => {
    queueFetch(jsonResponse({ items: [], nextCursor: null }));
    const { findByText } = render(wrap(<ProductDraftsScreen />));
    expect(await findByText('No templates yet')).toBeTruthy();
  });

  it('renders draft rows with status labels and moderation feedback for changes_required', async () => {
    queueFetch(jsonResponse({ items: [DRAFT_ROW, CHANGES_ROW], nextCursor: null }));
    const { findByTestId } = render(wrap(<ProductDraftsScreen />));

    const draftRow = within(await findByTestId('draft-row-draft-1'));
    const changesRow = within(await findByTestId('draft-row-draft-2'));

    expect(draftRow.getByText('Frozen peas')).toBeTruthy();
    expect(draftRow.getByText('Draft')).toBeTruthy();
    expect(changesRow.getByText('Changes requested')).toBeTruthy();
    expect(changesRow.getByText('Please add a clearer name')).toBeTruthy();
  });

  it('draft/changes_required rows open the editor with resume=edit and the row feedback', async () => {
    queueFetch(jsonResponse({ items: [CHANGES_ROW], nextCursor: null }));
    const { findByTestId } = render(wrap(<ProductDraftsScreen />));

    fireEvent.press(await findByTestId('draft-row-draft-2'));

    expect(navigation.push).toHaveBeenCalledWith('ProductNew', {
      barcode: '',
      qr: 'q-1',
      productId: 'draft-2',
      resume: 'edit',
      feedback: 'Please add a clearer name',
    });
  });

  it('pending rows open the read-only continuation with resume=pending and no feedback', async () => {
    const pendingRow = { ...DRAFT_ROW, id: 'draft-3', status: 'pending' };
    queueFetch(jsonResponse({ items: [pendingRow], nextCursor: null }));
    const { findByTestId } = render(wrap(<ProductDraftsScreen />));

    fireEvent.press(await findByTestId('draft-row-draft-3'));
    const detailsBtn = await findByTestId('action-modal-details-btn');
    fireEvent.press(detailsBtn);
    expect(navigation.push).toHaveBeenCalledWith('ProductNew', {
      barcode: '123',
      qr: '',
      productId: 'draft-3',
      resume: 'pending',
      feedback: undefined,
    });
  });

  it('loads the next page when the list reaches its end', async () => {
    queueFetch(
      jsonResponse({ items: [DRAFT_ROW], nextCursor: 'cursor-2' }),
      jsonResponse({ items: [{ ...DRAFT_ROW, id: 'draft-4', name: 'Second page item' }], nextCursor: null }),
    );
    const { findByTestId, getByTestId } = render(wrap(<ProductDraftsScreen />));

    await findByTestId('draft-row-draft-1');
    fireEvent(getByTestId('drafts-list'), 'onEndReached');

    await waitFor(() => expect(getByTestId('draft-row-draft-4')).toBeTruthy());
  });

  it('pull to refresh triggers refetch on FlatList', async () => {
    queueFetch(jsonResponse({ items: [DRAFT_ROW], nextCursor: null }));
    const { findByTestId, getByTestId } = render(wrap(<ProductDraftsScreen />));

    await findByTestId('draft-row-draft-1');
    queueFetch(jsonResponse({ items: [DRAFT_ROW, CHANGES_ROW], nextCursor: null }));
    fireEvent(getByTestId('drafts-list'), 'refresh');

    await waitFor(() => expect(getByTestId('draft-row-draft-2')).toBeTruthy());
  });

  it('manual code submission opens the editor without creating a products row (deferred create on Save)', async () => {
    queueFetch(jsonResponse({ items: [], nextCursor: null }));
    const { findByTestId } = render(wrap(<ProductDraftsScreen />));

    const manualBtn = await findByTestId('drafts-empty-manual-btn');
    fireEvent.press(manualBtn);

    const input = await findByTestId('manual-code-input');
    fireEvent.changeText(input, '123456789012');

    const fetchSpy = jest.spyOn(global, 'fetch');
    const submitBtn = await findByTestId('manual-code-submit-btn');
    await act(async () => {
      fireEvent.press(submitBtn);
    });

    await waitFor(() => {
      // No productId/resume: the editor opens at STEP 1 (name entry) and the
      // products row is only created when the user taps Continue/Save.
      expect(navigation.push).toHaveBeenCalledWith('ProductNew', {
        barcode: '123456789012',
        qr: '',
      });
    });
    // Crucially, no eager draft creation request was issued at entry time.
    expect(fetchSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('/products/drafts'),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('manual QR submission opens the editor with the qr param and no products row', async () => {
    queueFetch(jsonResponse({ items: [], nextCursor: null }));
    const { findByTestId } = render(wrap(<ProductDraftsScreen />));

    const manualBtn = await findByTestId('drafts-empty-manual-btn');
    fireEvent.press(manualBtn);

    // Switch to QR mode
    const qrTab = await findByTestId('toggle-qr-btn');
    fireEvent.press(qrTab);

    const input = await findByTestId('manual-code-input');
    fireEvent.changeText(input, 'https://qr.product.info/xyz');

    const fetchSpy = jest.spyOn(global, 'fetch');
    const submitBtn = await findByTestId('manual-code-submit-btn');
    await act(async () => {
      fireEvent.press(submitBtn);
    });

    await waitFor(() => {
      expect(navigation.push).toHaveBeenCalledWith('ProductNew', {
        barcode: '',
        qr: 'https://qr.product.info/xyz',
      });
    });
    expect(fetchSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('/products/drafts'),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('renders filter tabs and switches selected tab', async () => {
    queueFetch(jsonResponse({ items: [], nextCursor: null }));
    const { findByTestId } = render(wrap(<ProductDraftsScreen />));

    const activeTab = await findByTestId('drafts-tab-active');
    expect(activeTab).toBeTruthy();

    queueFetch(jsonResponse({ items: [], nextCursor: null }));
    fireEvent.press(activeTab);

    expect(await findByTestId('drafts-tab-active')).toBeTruthy();
  });

  it('renders active rows cleanly without inline Add button or redundant badge', async () => {
    const activeRow = { ...DRAFT_ROW, id: 'prod-active-1', name: 'Fresh Milk', status: 'active' as const };
    queueFetch(jsonResponse({ items: [activeRow], nextCursor: null }));
    const { findByTestId, queryByText, queryByTestId } = render(wrap(<ProductDraftsScreen />));

    expect(await findByTestId('draft-row-prod-active-1')).toBeTruthy();
    expect(queryByText('Catalog Active')).toBeNull();
    expect(queryByTestId('draft-add-btn-prod-active-1')).toBeNull();
    expect(await findByTestId('draft-swipe-add-prod-active-1')).toBeTruthy();
  });

  it('swiping and tapping Add action on active row opens the Add to Pantry modal', async () => {
    const activeRow = { ...DRAFT_ROW, id: 'prod-active-2', name: 'Almond Butter', status: 'active' as const };
    queueFetch(jsonResponse({ items: [activeRow], nextCursor: null }));
    const { findByTestId, findByText } = render(wrap(<ProductDraftsScreen />));

    const addBtn = await findByTestId('draft-swipe-add-prod-active-2');
    fireEvent.press(addBtn);

    expect(await findByText('Add to Pantry')).toBeTruthy();
  });

  it('searches and filters drafts by query text', async () => {
    const rowA = { ...DRAFT_ROW, id: 'row-a', name: 'Almond Milk' };
    const rowB = { ...DRAFT_ROW, id: 'row-b', name: 'Cashew Butter' };
    queueFetch(jsonResponse({ items: [rowA, rowB], nextCursor: null }));

    const { findByTestId, queryByText } = render(wrap(<ProductDraftsScreen />));
    const rowACard = within(await findByTestId('draft-row-row-a'));
    const rowBCard = within(await findByTestId('draft-row-row-b'));
    expect(rowACard.getByText('Almond Milk')).toBeTruthy();
    expect(rowBCard.getByText('Cashew Butter')).toBeTruthy();

    const searchInput = await findByTestId('drafts-search-input');
    fireEvent.changeText(searchInput, 'Almond');

    const filteredCard = within(await findByTestId('draft-row-row-a'));
    expect(filteredCard.getByText('Almond Milk')).toBeTruthy();
    expect(queryByText('Cashew Butter')).toBeNull();
  });

  it('switches view mode between list and 2-column grid cards', async () => {
    const rowA = { ...DRAFT_ROW, id: 'row-grid-1', name: 'Organic Tofu' };
    queueFetch(jsonResponse({ items: [rowA], nextCursor: null }));

    const { findByTestId } = render(wrap(<ProductDraftsScreen />));
    expect(await findByTestId('draft-row-row-grid-1')).toBeTruthy();

    const toggleBtn = await findByTestId('drafts-view-mode-toggle-btn');
    fireEvent.press(toggleBtn);

    expect(await findByTestId('draft-grid-card-row-grid-1')).toBeTruthy();
  });

  it('sorts drafts alphabetically by Name A-Z', async () => {
    const rowZ = { ...DRAFT_ROW, id: 'row-z', name: 'Zucchini' };
    const rowA = { ...DRAFT_ROW, id: 'row-a', name: 'Artichoke' };
    queueFetch(jsonResponse({ items: [rowZ, rowA], nextCursor: null }));

    const { findByTestId } = render(wrap(<ProductDraftsScreen />));
    await findByTestId('draft-row-row-z');

    const sortPill = await findByTestId('drafts-sort-pill-name_asc');
    fireEvent.press(sortPill);

    expect(await findByTestId('draft-row-row-a')).toBeTruthy();
  });

  it('tapping + Add draft opens the AddDraftOptionsModal with Scan and Manual options', async () => {
    queueFetch(jsonResponse({ items: [], nextCursor: null }));
    const { findByTestId, findByText } = render(wrap(<ProductDraftsScreen />));

    const addDraftBtn = await findByTestId('drafts-add-header-btn');
    fireEvent.press(addDraftBtn);

    expect(await findByText('Add Product Draft')).toBeTruthy();
    expect(await findByText('Scan Barcode / QR Code')).toBeTruthy();
    expect(await findByText('Enter Code Manually')).toBeTruthy();

    const scanBtn = await findByTestId('add-options-scan-btn');
    fireEvent.press(scanBtn);

    expect(navigation.push).toHaveBeenCalledWith('Scan');
  });

  it('renders centered dual-action bottom dock with Manually input and Scan an item', async () => {
    queueFetch(jsonResponse({ items: [DRAFT_ROW], nextCursor: null }));
    const { findByTestId, findByText } = render(wrap(<ProductDraftsScreen />));

    const manualAction = await findByTestId('drafts-manual-add-action');
    const scanAction = await findByTestId('drafts-scan-action');

    expect(manualAction).toBeTruthy();
    expect(scanAction).toBeTruthy();
    expect(await findByText('Manually input')).toBeTruthy();
    expect(await findByText('Scan an item')).toBeTruthy();

    fireEvent.press(scanAction);
    expect(navigation.push).toHaveBeenCalledWith('Scan');
  });
  it('swiping and tapping Edit routes contextually based on item status (active, pending, draft)', async () => {
    const activeRow = { ...DRAFT_ROW, id: 'draft-active', name: 'Active Catalog Prod', status: 'active' as const };
    const pendingRow = { ...DRAFT_ROW, id: 'draft-pending', name: 'Pending Review Prod', status: 'pending' as const };
    const draftRow = { ...DRAFT_ROW, id: 'draft-regular', name: 'Regular Draft Prod', status: 'draft' as const };

    queueFetch(jsonResponse({ items: [activeRow, pendingRow, draftRow], nextCursor: null }));
    const { findByTestId, findByText } = render(wrap(<ProductDraftsScreen />));

    // Active item Edit routes to ProductEdit
    const activeEditBtn = await findByTestId('draft-swipe-edit-draft-active');
    fireEvent.press(activeEditBtn);
    expect(navigation.push).toHaveBeenCalledWith('ProductEdit', { id: 'draft-active' });

    // Draft item Edit routes to ProductNew editor
    const draftEditBtn = await findByTestId('draft-swipe-edit-draft-regular');
    fireEvent.press(draftEditBtn);
    expect(navigation.push).toHaveBeenCalledWith('ProductNew', expect.objectContaining({
      productId: 'draft-regular',
      resume: 'edit',
    }));

    // Pending item Edit opens ProductActionModal
    const pendingEditBtn = await findByTestId('draft-swipe-edit-draft-pending');
    fireEvent.press(pendingEditBtn);
    expect(await findByText('Awaiting Review')).toBeTruthy();
  });

  it('swiping and tapping Delete immediately hides draft and shows item-addressed Undo toast', async () => {
    queueFetch(jsonResponse({ items: [DRAFT_ROW], nextCursor: null }));
    const { findByTestId, queryByTestId, findByText } = render(wrap(<ProductDraftsScreen />));

    expect(await findByTestId('draft-row-draft-1')).toBeTruthy();

    const deleteBtn = await findByTestId('draft-swipe-delete-draft-1');
    fireEvent.press(deleteBtn);

    // Immediately hidden in UI via pendingDiscards
    expect(queryByTestId('draft-row-draft-1')).toBeNull();

    // Undo toast is displayed with draft name and dedicated undo button
    expect(await findByTestId('draft-undo-toast')).toBeTruthy();
    expect(await findByText('Draft "Frozen peas" discarded')).toBeTruthy();
    const undoBtn = await findByTestId('draft-undo-btn-draft-1');
    expect(undoBtn).toBeTruthy();

    // Clean up queue before test ends to prevent unmocked flush
    fireEvent.press(undoBtn);
    expect(await findByTestId('draft-row-draft-1')).toBeTruthy();
  });

  it('tapping Undo on toast restores draft immediately', async () => {
    queueFetch(jsonResponse({ items: [DRAFT_ROW], nextCursor: null }));
    const { findByTestId, queryByTestId } = render(wrap(<ProductDraftsScreen />));

    const deleteBtn = await findByTestId('draft-swipe-delete-draft-1');
    fireEvent.press(deleteBtn);
    expect(queryByTestId('draft-row-draft-1')).toBeNull();

    const undoBtn = await findByTestId('draft-undo-btn-draft-1');
    fireEvent.press(undoBtn);

    // Restored to list
    expect(await findByTestId('draft-row-draft-1')).toBeTruthy();
  });

  it('rapid dual deletion preserves independent deadlines and item-addressed undo', async () => {
    jest.useFakeTimers();
    const fetchSpy = queueFetch(
      jsonResponse({ items: [DRAFT_ROW, CHANGES_ROW], nextCursor: null }),
      jsonResponse({ success: true, id: 'draft-2' }),
      jsonResponse({ items: [DRAFT_ROW], nextCursor: null }),
    );

    const { findByTestId, queryByTestId, getByTestId } = render(wrap(<ProductDraftsScreen />));

    expect(await findByTestId('draft-row-draft-1')).toBeTruthy();
    expect(await findByTestId('draft-row-draft-2')).toBeTruthy();

    // Delete draft-1 at t=0
    act(() => {
      fireEvent.press(getByTestId('draft-swipe-delete-draft-1'));
    });
    expect(queryByTestId('draft-row-draft-1')).toBeNull();
    expect(queryByTestId('draft-row-draft-2')).toBeTruthy();

    // Advance 1000ms (t=1000)
    act(() => {
      jest.advanceTimersByTime(1000);
    });

    // Rapidly delete draft-2 at t=1000
    act(() => {
      fireEvent.press(getByTestId('draft-swipe-delete-draft-2'));
    });
    expect(queryByTestId('draft-row-draft-1')).toBeNull();
    expect(queryByTestId('draft-row-draft-2')).toBeNull();

    // Both undo buttons appear in toast
    expect(await findByTestId('draft-undo-btn-draft-1')).toBeTruthy();
    expect(await findByTestId('draft-undo-btn-draft-2')).toBeTruthy();

    // Advance 3000ms (t=4000 total). Neither should have dispatched DELETE yet
    act(() => {
      jest.advanceTimersByTime(3000);
    });
    expect(fetchSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('/products/drafts/'),
      expect.objectContaining({ method: 'DELETE' }),
    );

    // Undo draft-1 specifically at t=4000: draft-1 is restored, draft-2 remains in queue
    act(() => {
      fireEvent.press(getByTestId('draft-undo-btn-draft-1'));
    });
    expect(await findByTestId('draft-row-draft-1')).toBeTruthy();
    expect(queryByTestId('draft-row-draft-2')).toBeNull();
    expect(queryByTestId('draft-undo-btn-draft-1')).toBeNull();
    expect(await findByTestId('draft-undo-btn-draft-2')).toBeTruthy();

    // Advance 2100ms (t=6100 total, which is t=5100 for draft-2). draft-2's 5s timer expires and dispatches DELETE
    await act(async () => {
      jest.advanceTimersByTime(2100);
    });
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/products/drafts/draft-2'),
      expect.objectContaining({ method: 'DELETE' }),
    );
    expect(fetchSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('/products/drafts/draft-1'),
      expect.objectContaining({ method: 'DELETE' }),
    );
    act(() => {
      jest.clearAllTimers();
    });
    jest.useRealTimers();
  });
  it('mutation failure rolls back deletion, restores item, and alerts user', async () => {
    jest.useFakeTimers();
    const alertSpy = jest.spyOn(Alert, 'alert');

    queueFetch(
      jsonResponse({ items: [DRAFT_ROW], nextCursor: null }),
      problemResponse('INTERNAL_ERROR', 500, 'Server exploded'),
      jsonResponse({ items: [DRAFT_ROW], nextCursor: null }),
    );

    const { findByTestId, queryByTestId } = render(wrap(<ProductDraftsScreen />));

    const deleteBtn = await findByTestId('draft-swipe-delete-draft-1');
    act(() => {
      fireEvent.press(deleteBtn);
    });

    expect(queryByTestId('draft-row-draft-1')).toBeNull();

    // Advance timers past 5s countdown to trigger commit
    await act(async () => {
      jest.advanceTimersByTime(5100);
    });

    // Alert shown and item restored
    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith('Discard Failed', expect.any(String));
    });
    expect(await findByTestId('draft-row-draft-1')).toBeTruthy();

    act(() => {
      jest.clearAllTimers();
    });
    jest.useRealTimers();
  });

  it('in grid view, slide action drawer triggers edit, add to pantry, and delete', async () => {
    useUiPreferencesStore.setState({ draftsViewMode: 'grid' });
    const activeRow = { ...DRAFT_ROW, id: 'grid-active-1', name: 'Grid Active', status: 'active' as const };
    queueFetch(jsonResponse({ items: [activeRow, DRAFT_ROW], nextCursor: null }));

    const { findByTestId, findByText, queryByTestId } = render(wrap(<ProductDraftsScreen />));

    // Grid card renders
    expect(await findByTestId('draft-grid-card-grid-active-1')).toBeTruthy();
    expect(await findByTestId('draft-grid-card-draft-1')).toBeTruthy();

    // Edit action in grid drawer for active item
    const editBtn = await findByTestId('draft-grid-action-edit-grid-active-1');
    fireEvent.press(editBtn);
    expect(navigation.push).toHaveBeenCalledWith('ProductEdit', { id: 'grid-active-1' });

    // Add action in grid drawer
    const addBtn = await findByTestId('draft-grid-action-add-grid-active-1');
    fireEvent.press(addBtn);
    expect(await findByTestId('add-record-save')).toBeTruthy();
    // Delete action in grid drawer for draft item
    const deleteBtn = await findByTestId('draft-grid-action-delete-draft-1');
    fireEvent.press(deleteBtn);
    expect(queryByTestId('draft-grid-card-draft-1')).toBeNull();

    // Clean up queue via undo toast before test ends
    const undoBtn = await findByTestId('draft-undo-btn-draft-1');
    fireEvent.press(undoBtn);
    expect(await findByTestId('draft-grid-card-draft-1')).toBeTruthy();
  });

  it('unmounting before 5s deadline flushes and commits pending deletion', async () => {
    jest.useFakeTimers();
    const fetchSpy = queueFetch(
      jsonResponse({ items: [DRAFT_ROW], nextCursor: null }),
      jsonResponse({ success: true, id: 'draft-1' }),
      jsonResponse({ items: [], nextCursor: null }),
    );

    const { findByTestId, queryByTestId, unmount, getByTestId } = render(wrap(<ProductDraftsScreen />));

    expect(await findByTestId('draft-row-draft-1')).toBeTruthy();

    act(() => {
      fireEvent.press(getByTestId('draft-swipe-delete-draft-1'));
    });

    expect(queryByTestId('draft-row-draft-1')).toBeNull();

    // Advance only 1s (before the 5s timer)
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    // No DELETE sent yet
    expect(fetchSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('/products/drafts/draft-1'),
      expect.objectContaining({ method: 'DELETE' }),
    );

    // User navigates away / screen unmounts at +1s
    await act(async () => {
      unmount();
    });

    // Deletion is immediately flushed and dispatched on unmount
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/products/drafts/draft-1'),
      expect.objectContaining({ method: 'DELETE' }),
    );

    act(() => {
      jest.clearAllTimers();
    });
    jest.useRealTimers();
  });
  it('unmount with rejected DELETE catches error, alerts user, and invalidates queries', async () => {
    jest.useFakeTimers();
    const alertSpy = jest.spyOn(Alert, 'alert');
    const fetchSpy = queueFetch(
      jsonResponse({ items: [DRAFT_ROW], nextCursor: null }),
      problemResponse('INTERNAL_ERROR', 500, 'Network crashed'),
      jsonResponse({ items: [DRAFT_ROW], nextCursor: null }),
    );

    const { findByTestId, queryByTestId, unmount, getByTestId } = render(wrap(<ProductDraftsScreen />));

    expect(await findByTestId('draft-row-draft-1')).toBeTruthy();

    act(() => {
      fireEvent.press(getByTestId('draft-swipe-delete-draft-1'));
    });

    expect(queryByTestId('draft-row-draft-1')).toBeNull();

    // User navigates away at +1s, triggering flush that rejects
    await act(async () => {
      unmount();
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/products/drafts/draft-1'),
      expect.objectContaining({ method: 'DELETE' }),
    );

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith('Discard Failed', expect.any(String));
    });

    act(() => {
      jest.clearAllTimers();
    });
    jest.useRealTimers();
  });

  it('universal actions: active and pending items support Delete and draft items support Add to Pantry', async () => {
    const activeRow = { ...DRAFT_ROW, id: 'active-item-1', name: 'Active Catalog Prod', status: 'active' as const };
    const pendingRow = { ...DRAFT_ROW, id: 'pending-item-1', name: 'Pending Review Prod', status: 'pending' as const };
    const draftRow = { ...DRAFT_ROW, id: 'draft-item-1', name: 'Regular Draft Prod', status: 'draft' as const };
    queueFetch(jsonResponse({ items: [activeRow, pendingRow, draftRow], nextCursor: null }));
    const { findByTestId, getByTestId, queryByTestId, findByText } = render(wrap(<ProductDraftsScreen />));

    // Active row has Edit, Add, AND Delete
    expect(await findByTestId(`draft-swipe-edit-${activeRow.id}`)).toBeTruthy();
    expect(getByTestId(`draft-swipe-add-${activeRow.id}`)).toBeTruthy();
    expect(getByTestId(`draft-swipe-delete-${activeRow.id}`)).toBeTruthy();

    // Pending row has Edit, Add, AND Delete
    expect(getByTestId(`draft-swipe-edit-${pendingRow.id}`)).toBeTruthy();
    expect(getByTestId(`draft-swipe-add-${pendingRow.id}`)).toBeTruthy();
    expect(getByTestId(`draft-swipe-delete-${pendingRow.id}`)).toBeTruthy();

    // Draft row has Edit, Add, AND Delete
    expect(getByTestId(`draft-swipe-edit-${draftRow.id}`)).toBeTruthy();
    expect(getByTestId(`draft-swipe-add-${draftRow.id}`)).toBeTruthy();
    expect(getByTestId(`draft-swipe-delete-${draftRow.id}`)).toBeTruthy();

    // Tapping delete on active item immediately hides it
    fireEvent.press(getByTestId(`draft-swipe-delete-${activeRow.id}`));
    expect(queryByTestId(`draft-row-${activeRow.id}`)).toBeNull();
    expect(await findByTestId(`draft-undo-btn-${activeRow.id}`)).toBeTruthy();

    // Tapping add on draft item opens modal with Template item label
    fireEvent.press(getByTestId(`draft-swipe-add-${draftRow.id}`));
    expect(await findByText('Template item · Personal pantry only')).toBeTruthy();
  });

  it('synchronizes scroll state and resets header translation when switching view mode from scrolled state', async () => {
    const setValueSpy = jest.spyOn(Animated.Value.prototype, 'setValue');
    const row1 = { ...DRAFT_ROW, id: 'row-scroll-1', name: 'Scroll Item 1' };
    const row2 = { ...DRAFT_ROW, id: 'row-scroll-2', name: 'Scroll Item 2' };
    queueFetch(jsonResponse({ items: [row1, row2], nextCursor: null }));

    const { findByTestId } = render(wrap(<ProductDraftsScreen />));

    const list = await findByTestId('drafts-list');

    // Simulate scrolling down by 150px
    fireEvent.scroll(list, {
      nativeEvent: {
        contentOffset: { y: 150 },
        contentSize: { height: 1000, width: 400 },
        layoutMeasurement: { height: 600, width: 400 },
      },
    });

    setValueSpy.mockClear();

    // Toggle view mode to grid while scrolled
    const toggleBtn = await findByTestId('drafts-view-mode-toggle-btn');
    fireEvent.press(toggleBtn);

    // Verifies that scrollY was explicitly reset to 0 to synchronize with the new list
    expect(setValueSpy).toHaveBeenCalledWith(0);
    expect(await findByTestId('draft-grid-card-row-scroll-1')).toBeTruthy();

    setValueSpy.mockRestore();
  });
});
