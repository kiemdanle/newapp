// apps/mobile/__tests__/GiveawayCard.test.tsx
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { GiveawayCard } from '../src/features/giveaways/GiveawayCard';
import { ThemeProvider } from '../src/theme/ThemeProvider';
import type { Giveaway } from '@expyrico/shared';

const mockGiveaway: Giveaway = {
  id: 'g-1',
  giverUserId: 'user-1',
  title: 'Organic Apple Box',
  description: 'Fresh apples from garden',
  locationText: 'District 1, Central',
  country: 'VN',
  status: 'open',
  quantity: 2,
  unit: 'boxes',
  photoUrls: [
    'https://cdn.expyrico.app/giveaways/photo1.webp',
    'https://cdn.expyrico.app/giveaways/photo2.webp',
    'https://cdn.expyrico.app/giveaways/photo3.webp',
  ],
  claimCount: 4,
  createdAt: '2026-08-26T00:00:00.000Z',
  updatedAt: '2026-08-26T00:00:00.000Z',
  giver: {
    id: 'user-1',
    firstName: 'Sarah',
    avatarUrl: null,
    giverRatingAvg: 4.9,
    transactionCount: 12,
  },
};

function wrap(node: React.ReactNode) {
  return <ThemeProvider>{node}</ThemeProvider>;
}

describe('GiveawayCard', () => {
  it('renders title, location, photo count badge, and giver info', () => {
    const onPress = jest.fn();
    const { getByText, getByLabelText } = render(
      wrap(<GiveawayCard giveaway={mockGiveaway} onPress={onPress} />),
    );

    expect(getByText('Organic Apple Box')).toBeTruthy();
    expect(getByText(/District 1, Central/)).toBeTruthy();
    expect(getByText('📦 2 boxes')).toBeTruthy();
    expect(getByText('3')).toBeTruthy(); // photo count badge
    expect(getByText('Sarah')).toBeTruthy();
    expect(getByText('★ 4.9')).toBeTruthy();
    expect(getByLabelText('giveaway-g-1')).toBeTruthy();
  });

  it('renders owner swipe actions and triggers onEdit, onManage, onDelete', () => {
    const onEdit = jest.fn();
    const onManage = jest.fn();
    const onDelete = jest.fn();

    const { getByTestId } = render(
      wrap(
        <GiveawayCard
          giveaway={mockGiveaway}
          currentUserId="user-1"
          onEdit={onEdit}
          onManage={onManage}
          onDelete={onDelete}
        />,
      ),
    );

    const editBtn = getByTestId('giveaway-edit-g-1');
    const manageBtn = getByTestId('giveaway-manage-g-1');
    const deleteBtn = getByTestId('giveaway-delete-g-1');

    expect(editBtn).toBeTruthy();
    expect(manageBtn).toBeTruthy();
    expect(deleteBtn).toBeTruthy();

    fireEvent.press(editBtn);
    expect(onEdit).toHaveBeenCalledWith(mockGiveaway);

    fireEvent.press(manageBtn);
    expect(onManage).toHaveBeenCalledWith(mockGiveaway);

    fireEvent.press(deleteBtn);
    expect(onDelete).toHaveBeenCalledWith(mockGiveaway);
  });

  it('renders non-owner swipe actions for claim and share', () => {
    const onPress = jest.fn();
    const onShare = jest.fn();

    const { getByTestId } = render(
      wrap(
        <GiveawayCard
          giveaway={mockGiveaway}
          currentUserId="user-2"
          onPress={onPress}
          onShare={onShare}
        />,
      ),
    );

    const claimBtn = getByTestId('giveaway-claim-g-1');
    const shareBtn = getByTestId('giveaway-share-g-1');

    expect(claimBtn).toBeTruthy();
    expect(shareBtn).toBeTruthy();

    fireEvent.press(claimBtn);
    expect(onPress).toHaveBeenCalledWith(mockGiveaway);

    fireEvent.press(shareBtn);
    expect(onShare).toHaveBeenCalledWith(mockGiveaway);
  });
});
