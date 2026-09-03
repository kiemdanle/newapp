import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { JoinHouseholdModal } from '../../src/features/households/JoinHouseholdModal';
import {
  capturePendingHouseholdInviteCode,
  readPendingHouseholdInviteCode,
  clearPendingHouseholdInviteCode,
} from '../../src/features/households/pendingHouseholdInviteStore';

const mockMutateAsync = jest.fn();
let mockPreviewData: any = null;
let mockIsLoadingPreview = false;

jest.mock('../../src/api/households', () => ({
  useJoinHousehold: () => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  }),
  useHouseholdInvitePreview: () => ({
    data: mockPreviewData,
    isLoading: mockIsLoadingPreview,
  }),
}));

describe('<JoinHouseholdModal /> & pendingHouseholdInviteStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPreviewData = null;
    mockIsLoadingPreview = false;
  });

  it('renders input field, placeholder, and buttons', () => {
    const { getByTestId, getByPlaceholderText } = render(
      <JoinHouseholdModal visible={true} onClose={jest.fn()} />,
    );

    expect(getByTestId('join-household-modal')).toBeTruthy();
    expect(getByPlaceholderText('e.g. KITCH8')).toBeTruthy();
    expect(getByTestId('join-household-submit-btn')).toBeTruthy();
    expect(getByTestId('join-household-cancel-btn')).toBeTruthy();
  });

  it('populates initialCode prop and enables submission', () => {
    const { getByTestId } = render(
      <JoinHouseholdModal visible={true} initialCode="KITCH8" onClose={jest.fn()} />,
    );

    const input = getByTestId('join-household-code-input');
    expect(input.props.value).toBe('KITCH8');
  });

  it('submits normalized code and invokes onJoined and onClose upon success', async () => {
    const onJoined = jest.fn();
    const onClose = jest.fn();
    mockMutateAsync.mockResolvedValueOnce({
      id: 'hh-123',
      name: 'Family Kitchen',
      myRole: 'member',
    });

    const { getByTestId } = render(
      <JoinHouseholdModal visible={true} onClose={onClose} onJoined={onJoined} />,
    );

    const input = getByTestId('join-household-code-input');
    fireEvent.changeText(input, 'kitch8');

    fireEvent.press(getByTestId('join-household-submit-btn'));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({ code: 'KITCH8' });
      expect(onJoined).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'hh-123', name: 'Family Kitchen' }),
      );
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('renders error message when code is not found (404)', async () => {
    mockMutateAsync.mockRejectedValueOnce({
      code: 'household_not_found',
      message: '404 Not Found',
    });

    const { getByTestId, getByText } = render(
      <JoinHouseholdModal visible={true} initialCode="WRONG1" onClose={jest.fn()} />,
    );

    fireEvent.press(getByTestId('join-household-submit-btn'));

    await waitFor(() => {
      expect(getByText(/Invalid or expired invite code/i)).toBeTruthy();
    });
  });

  it('renders confirmation preview card when preview data resolves', () => {
    mockPreviewData = {
      id: 'hh-1',
      name: 'Mountain Cabin',
      ownerName: 'Sarah',
      memberCount: 2,
    };

    const { getByTestId, getByText } = render(
      <JoinHouseholdModal visible={true} initialCode="CABIN7" onClose={jest.fn()} />,
    );

    expect(getByTestId('join-household-preview-card')).toBeTruthy();
    expect(getByText('Mountain Cabin')).toBeTruthy();
    expect(getByText(/Owner: Sarah · 2 existing members/i)).toBeTruthy();
  });

  it('captures, reads, and clears pending invite codes in secure store', async () => {
    await clearPendingHouseholdInviteCode();

    // Invalid format ignored
    await capturePendingHouseholdInviteCode('12');
    expect(await readPendingHouseholdInviteCode()).toBeNull();

    // Valid code captured
    await capturePendingHouseholdInviteCode('kitch8');
    expect(await readPendingHouseholdInviteCode()).toBe('KITCH8');

    // Cleared
    await clearPendingHouseholdInviteCode();
    expect(await readPendingHouseholdInviteCode()).toBeNull();
  });
});
