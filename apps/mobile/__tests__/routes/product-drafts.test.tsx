import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import ProductDraftsScreen from '../../app/(app)/product/drafts';
import { ThemeProvider } from '../../src/theme/ThemeProvider';
import { initThemeStore, useThemeStore } from '../../src/theme/store';
import { createQueryClient } from '../../src/api/query-client';
import { navigation } from '../../tests/mocks/react-navigation';
import { queueFetch, jsonResponse } from '../../tests/mocks/fetch';
import { useSessionStore } from '../../src/auth/session-store';
import { __reset } from '../../tests/mocks/react-native-keychain';

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
    await initThemeStore();
    useSessionStore.setState({ user: { id: 'user-1' } as never, accessToken: 'a', refreshToken: 'r', hydrated: true, pendingAuth: null });
  });

  it('shows an empty state when there are no drafts', async () => {
    queueFetch(jsonResponse({ items: [], nextCursor: null }));
    const { findByText } = render(wrap(<ProductDraftsScreen />));
    expect(await findByText('No drafts yet')).toBeTruthy();
  });

  it('renders draft rows with status labels and moderation feedback for changes_required', async () => {
    queueFetch(jsonResponse({ items: [DRAFT_ROW, CHANGES_ROW], nextCursor: null }));
    const { findByTestId, getByText } = render(wrap(<ProductDraftsScreen />));

    expect(await findByTestId('draft-row-draft-1')).toBeTruthy();
    expect(getByText('Frozen peas')).toBeTruthy();
    expect(getByText('Draft')).toBeTruthy();
    expect(getByText('Changes requested')).toBeTruthy();
    expect(getByText('Please add a clearer name')).toBeTruthy();
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
});
