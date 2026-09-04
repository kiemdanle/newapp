import React from 'react';
import { act, fireEvent } from '@testing-library/react-native';
import { renderWithTheme } from '../helpers/renderWithTheme';
import { HouseholdInvitationModal } from '../../src/features/households/HouseholdInvitationModal';
import * as householdsApi from '../../src/api/households';

jest.mock('../../src/api/households', () => ({
  useHouseholdInvitationPreview: jest.fn(),
  useAcceptHouseholdInvitation: jest.fn(),
  useDeclineHouseholdInvitation: jest.fn(),
}));

describe('HouseholdInvitationModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders loading state when invitation preview is loading', () => {
    (householdsApi.useHouseholdInvitationPreview as jest.Mock).mockReturnValue({
      data: null,
      isLoading: true,
      isError: false,
    });
    (householdsApi.useAcceptHouseholdInvitation as jest.Mock).mockReturnValue({
      mutateAsync: jest.fn(),
    });
    (householdsApi.useDeclineHouseholdInvitation as jest.Mock).mockReturnValue({
      mutateAsync: jest.fn(),
    });

    const { getByText } = renderWithTheme(
      <HouseholdInvitationModal
        visible={true}
        token="test-token"
        onClose={jest.fn()}
      />,
      'expyrico',
    );

    expect(getByText('Loading invitation details...')).toBeTruthy();
  });

  it('renders error state when invitation is invalid or expired', () => {
    (householdsApi.useHouseholdInvitationPreview as jest.Mock).mockReturnValue({
      data: null,
      isLoading: false,
      isError: true,
    });
    (householdsApi.useAcceptHouseholdInvitation as jest.Mock).mockReturnValue({
      mutateAsync: jest.fn(),
    });
    (householdsApi.useDeclineHouseholdInvitation as jest.Mock).mockReturnValue({
      mutateAsync: jest.fn(),
    });

    const { getByText } = renderWithTheme(
      <HouseholdInvitationModal
        visible={true}
        token="test-token"
        onClose={jest.fn()}
      />,
      'expyrico',
    );

    expect(getByText('Invitation Unavailable')).toBeTruthy();
  });

  it('renders household details and inviter info when valid', () => {
    (householdsApi.useHouseholdInvitationPreview as jest.Mock).mockReturnValue({
      data: {
        id: 'inv-1',
        householdId: 'hh-1',
        householdName: 'Lakeside Cabin',
        inviterName: 'Alice',
        inviterAvatarUrl: null,
        memberCount: 3,
        status: 'pending',
        expiresAt: '2026-09-11T00:00:00Z',
      },
      isLoading: false,
      isError: false,
    });
    (householdsApi.useAcceptHouseholdInvitation as jest.Mock).mockReturnValue({
      mutateAsync: jest.fn(),
    });
    (householdsApi.useDeclineHouseholdInvitation as jest.Mock).mockReturnValue({
      mutateAsync: jest.fn(),
    });

    const { getByText } = renderWithTheme(
      <HouseholdInvitationModal
        visible={true}
        token="test-token"
        onClose={jest.fn()}
      />,
      'expyrico',
    );

    expect(getByText('Lakeside Cabin')).toBeTruthy();
    expect(getByText('Alice invited you to join')).toBeTruthy();
    expect(getByText('3 members')).toBeTruthy();
  });

  it('calls accept mutation when Accept & Join is tapped', async () => {
    const acceptMutate = jest.fn().mockResolvedValue({
      householdId: 'hh-1',
      status: 'accepted',
    });
    (householdsApi.useHouseholdInvitationPreview as jest.Mock).mockReturnValue({
      data: {
        id: 'inv-1',
        householdId: 'hh-1',
        householdName: 'Lakeside Cabin',
        inviterName: 'Alice',
        inviterAvatarUrl: null,
        memberCount: 3,
        status: 'pending',
        expiresAt: '2026-09-11T00:00:00Z',
      },
      isLoading: false,
      isError: false,
    });
    (householdsApi.useAcceptHouseholdInvitation as jest.Mock).mockReturnValue({
      mutateAsync: acceptMutate,
    });
    (householdsApi.useDeclineHouseholdInvitation as jest.Mock).mockReturnValue({
      mutateAsync: jest.fn(),
    });

    const handleAccepted = jest.fn();
    const handleClose = jest.fn();

    const { getByTestId } = renderWithTheme(
      <HouseholdInvitationModal
        visible={true}
        token="test-token"
        onClose={handleClose}
        onAccepted={handleAccepted}
      />,
      'expyrico',
    );

    const acceptBtn = getByTestId('invitation-accept-btn');
    await act(async () => {
      fireEvent.press(acceptBtn);
    });

    expect(acceptMutate).toHaveBeenCalledWith('test-token');
    expect(handleAccepted).toHaveBeenCalledWith('hh-1');
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('calls decline mutation when Decline is tapped', async () => {
    const declineMutate = jest.fn().mockResolvedValue({ status: 'declined' });
    (householdsApi.useHouseholdInvitationPreview as jest.Mock).mockReturnValue({
      data: {
        id: 'inv-1',
        householdId: 'hh-1',
        householdName: 'Lakeside Cabin',
        inviterName: 'Alice',
        inviterAvatarUrl: null,
        memberCount: 3,
        status: 'pending',
        expiresAt: '2026-09-11T00:00:00Z',
      },
      isLoading: false,
      isError: false,
    });
    (householdsApi.useAcceptHouseholdInvitation as jest.Mock).mockReturnValue({
      mutateAsync: jest.fn(),
    });
    (householdsApi.useDeclineHouseholdInvitation as jest.Mock).mockReturnValue({
      mutateAsync: declineMutate,
    });

    const handleDeclined = jest.fn();
    const handleClose = jest.fn();

    const { getByTestId } = renderWithTheme(
      <HouseholdInvitationModal
        visible={true}
        token="test-token"
        onClose={handleClose}
        onDeclined={handleDeclined}
      />,
      'expyrico',
    );

    const declineBtn = getByTestId('invitation-decline-btn');
    await act(async () => {
      fireEvent.press(declineBtn);
    });

    expect(declineMutate).toHaveBeenCalledWith('test-token');
    expect(handleDeclined).toHaveBeenCalledTimes(1);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
