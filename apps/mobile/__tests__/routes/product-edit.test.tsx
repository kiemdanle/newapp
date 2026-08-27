import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, waitFor, act } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import ProductEditScreen from '../../app/(app)/product/[id]/edit';
import { ThemeProvider } from '../../src/theme/ThemeProvider';
import { initThemeStore, useThemeStore } from '../../src/theme/store';
import { createQueryClient } from '../../src/api/query-client';
import { navigation, __setRouteParams } from '../../tests/mocks/react-navigation';
import { queueFetch, jsonResponse, problemResponse } from '../../tests/mocks/fetch';
import { useSessionStore } from '../../src/auth/session-store';
import { __reset } from '../../tests/mocks/react-native-keychain';

// The editable branch mounts ProductPhotoEditor, whose picker adapter pulls
// in this native module — stubbed the same way every other Phase 5 test
// touching the photo editor does.
jest.mock('react-native-image-crop-picker', () => ({
  __esModule: true,
  default: { openCamera: jest.fn(), openPicker: jest.fn(), cleanSingle: jest.fn() },
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
  version: 5,
  photos: [],
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

const EDIT_DRAFT = {
  id: 'edit-1',
  productId: 'p1',
  status: 'draft',
  version: 1,
  baseProductVersion: 5,
  name: 'Frozen peas',
  description: null,
  brand: null,
  category: null,
  defaultShelfLifeDays: null,
  notes: null,
  photos: [],
  moderationFeedback: null,
  submittedAt: null,
  updatedAt: '2026-01-01T00:00:00Z',
};

describe('<ProductEditScreen />', () => {
  beforeEach(async () => {
    __reset();
    useThemeStore.setState({ themeId: 'expyrico', hydrated: false });
    await initThemeStore();
    useSessionStore.setState({ user: { id: 'user-1' } as never, accessToken: 'a', refreshToken: 'r', hydrated: true, pendingAuth: null });
    __setRouteParams({ id: 'p1' });
  });

  it('creates/resumes the open revision on mount and renders the editable form', async () => {
    queueFetch(jsonResponse(PRODUCT), jsonResponse(EDIT_DRAFT));
    const { findByTestId } = render(wrap(<ProductEditScreen />));

    expect(await findByTestId('edit-name')).toBeTruthy();
    expect(await findByTestId('edit-submit')).toBeTruthy();
  });

  it('a pending revision renders a read-only summary with no Save/Submit', async () => {
    queueFetch(jsonResponse(PRODUCT), jsonResponse({ ...EDIT_DRAFT, status: 'pending' }));
    const { findByTestId, queryByTestId } = render(wrap(<ProductEditScreen />));

    expect(await findByTestId('edit-pending-message')).toBeTruthy();
    expect(getEditableProp(await findByTestId('edit-name'))).toBe(false);
    expect(queryByTestId('edit-save')).toBeNull();
    expect(queryByTestId('edit-submit')).toBeNull();
  });

  it('shows changes_required feedback on the editable form', async () => {
    queueFetch(jsonResponse(PRODUCT), jsonResponse({ ...EDIT_DRAFT, status: 'changes_required', moderationFeedback: 'Please add a clearer name' }));
    const { findByText } = render(wrap(<ProductEditScreen />));

    expect(await findByText('Please add a clearer name')).toBeTruthy();
  });

  it('prompts before discarding unsaved edits on back navigation', async () => {
    queueFetch(jsonResponse(PRODUCT), jsonResponse(EDIT_DRAFT), jsonResponse(EDIT_DRAFT));
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const { findByTestId, getByTestId } = render(wrap(<ProductEditScreen />));
    await findByTestId('edit-name');
    fireEvent.changeText(getByTestId('edit-name'), 'Edited name');

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

  it('submitting shows confirmation alert and navigates back', async () => {
    queueFetch(jsonResponse(PRODUCT), jsonResponse(EDIT_DRAFT));
    const alertSpy = jest.spyOn(Alert, 'alert');
    const { findByTestId, getByTestId } = render(wrap(<ProductEditScreen />));
    await findByTestId('edit-submit');

    queueFetch(jsonResponse({ ...EDIT_DRAFT, status: 'pending', version: 2 }));
    await act(async () => fireEvent.press(getByTestId('edit-submit')));

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(
        'Suggestion Submitted',
        expect.stringContaining('moderators for review'),
        expect.any(Array),
      );
    });
  });

  it('allows editing default shelf life and submitter notes', async () => {
    queueFetch(
      jsonResponse(PRODUCT),
      jsonResponse(EDIT_DRAFT),
      jsonResponse(EDIT_DRAFT),
      jsonResponse(EDIT_DRAFT),
    );
    const { findByTestId } = render(wrap(<ProductEditScreen />));
    const shelfInput = await findByTestId('edit-shelf-life');
    const notesInput = await findByTestId('edit-notes');

    fireEvent.changeText(shelfInput, '60');
    fireEvent.changeText(notesInput, 'Fresh peas have 60 days frozen shelf life');

    expect(shelfInput.props.value).toBe('60');
    expect(notesInput.props.value).toBe('Fresh peas have 60 days frozen shelf life');
    expect(await findByTestId('edit-notes-counter')).toBeTruthy();
  });

  it('a 409 edit_base_stale on submit is terminal — no retry button', async () => {
    queueFetch(jsonResponse(PRODUCT), jsonResponse(EDIT_DRAFT));
    const { findByTestId, getByTestId, queryByTestId } = render(wrap(<ProductEditScreen />));
    await findByTestId('edit-submit');

    queueFetch(problemResponse('edit_base_stale', 409, 'stale base'));
    await act(async () => fireEvent.press(getByTestId('edit-submit')));

    expect(await findByTestId('edit-submit-error')).toBeTruthy();
    expect(queryByTestId('edit-submit')).toBeNull();
  });
});

function getEditableProp(node: { props: { editable?: boolean } }): boolean | undefined {
  return node.props.editable;
}
