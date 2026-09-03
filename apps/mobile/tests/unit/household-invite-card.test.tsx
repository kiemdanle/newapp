import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Share, Alert } from 'react-native';
import { HouseholdInviteCard } from '../../src/features/households/HouseholdInviteCard';

const mockRegenerateMutate = jest.fn();
jest.mock('../../src/api/households', () => ({
  useRegenerateInviteCode: () => ({
    mutate: mockRegenerateMutate,
    isPending: false,
  }),
}));

describe('<HouseholdInviteCard />', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' } as any);
    jest.spyOn(Alert, 'alert');
  });

  it('renders household invite code and kitchen title', () => {
    const { getByTestId, getByText } = render(
      <HouseholdInviteCard
        householdId="hh-1"
        householdName="Smith Kitchen"
        inviteCode="KITCH8"
        isOwner={true}
      />,
    );

    expect(getByText('Invite to Kitchen')).toBeTruthy();
    expect(getByTestId('household-invite-code-text').props.children).toBe('KITCH8');
    expect(getByTestId('household-copy-code-btn')).toBeTruthy();
    expect(getByTestId('household-share-invite-btn')).toBeTruthy();
  });

  it('triggers Share.share with pre-filled message and deep link url on button press', async () => {
    const { getByTestId } = render(
      <HouseholdInviteCard
        householdId="hh-1"
        householdName="Smith Kitchen"
        inviteCode="KITCH8"
        isOwner={true}
      />,
    );

    fireEvent.press(getByTestId('household-share-invite-btn'));

    await waitFor(() => {
      expect(Share.share).toHaveBeenCalledWith({
        title: 'Join Smith Kitchen on Expyrico',
        message: expect.stringContaining('KITCH8'),
        url: 'expyrico://household/join?code=KITCH8',
      });
    });
  });

  it('toggles copied feedback when copy button is pressed', async () => {
    const { getByTestId, getByText } = render(
      <HouseholdInviteCard
        householdId="hh-1"
        householdName="Smith Kitchen"
        inviteCode="KITCH8"
        isOwner={false}
      />,
    );

    expect(getByText('Copy')).toBeTruthy();
    fireEvent.press(getByTestId('household-copy-code-btn'));

    await waitFor(() => {
      expect(getByText('Copied')).toBeTruthy();
    });
  });

  it('shows Regenerate button for owner and triggers confirmation alert', () => {
    const { getByTestId } = render(
      <HouseholdInviteCard
        householdId="hh-1"
        householdName="Smith Kitchen"
        inviteCode="KITCH8"
        isOwner={true}
      />,
    );

    const regenBtn = getByTestId('household-regenerate-code-btn');
    expect(regenBtn).toBeTruthy();

    fireEvent.press(regenBtn);

    expect(Alert.alert).toHaveBeenCalledWith(
      'Regenerate Invite Code',
      expect.stringContaining('previous invite code or link'),
      expect.any(Array),
    );

    // Trigger the Regenerate button callback from the Alert options
    const alertButtons = (Alert.alert as jest.Mock).mock.calls[0][2];
    const confirmBtn = alertButtons.find((b: { text: string }) => b.text === 'Regenerate');
    confirmBtn.onPress();

    expect(mockRegenerateMutate).toHaveBeenCalledWith('hh-1');
  });

  it('hides Regenerate button for non-owners', () => {
    const { queryByTestId } = render(
      <HouseholdInviteCard
        householdId="hh-1"
        householdName="Smith Kitchen"
        inviteCode="KITCH8"
        isOwner={false}
      />,
    );

    expect(queryByTestId('household-regenerate-code-btn')).toBeNull();
  });
});
