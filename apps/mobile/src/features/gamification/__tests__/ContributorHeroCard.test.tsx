import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { ContributorHeroCard } from '../ContributorHeroCard';
import {
  DEFAULT_CONTRIBUTOR_LEVELS,
  type UserContributionsResponse,
} from '@expyrico/shared';

// Mock theme
jest.mock('../../../theme/useTheme', () => ({
  useTheme: () => ({
    colors: {
      primary: '#4BAE8A',
      primaryDark: '#3A8F6F',
      bgElevated: '#FFFFFF',
      bgSubtle: '#F4F4F2',
      border: '#E5E5E2',
      textPrimary: '#2C2C28',
      textSecondary: '#8C8C85',
    },
    radii: {
      lg: 16,
    },
  }),
}));

// Mock react-native-safe-area-context
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

// Mock Ionicons
jest.mock('react-native-vector-icons/Ionicons', () => 'Ionicons');

describe('ContributorHeroCard', () => {
  const baseMockData: UserContributionsResponse = {
    enabled: true,
    levels: [...DEFAULT_CONTRIBUTOR_LEVELS],
    progression: {
      currentLevel: 4,
      title: 'Pantry Scout',
      badgeKey: 'silver_star',
      colorToken: 'pebble',
      colorHex: '#8C8C85',
      totalPoints: 180,
      activeProductsCount: 15,
      currentLevelMinPoints: 150,
      nextLevel: 5,
      nextLevelMinPoints: 300,
      pointsToNextLevel: 120,
      productsToNextLevel: 20,
      progressPercent: 20,
      isMaxLevel: false,
      perks: 'Silver Contributor star & Access to contributor discord channel',
    },
    stats: {
      totalContributed: 10,
      activeApproved: 10,
      pendingReview: 0,
      changesRequested: 0,
      editsApproved: 0,
    },
    items: [],
    hasMore: false,
    nextOffset: null,
  };

  it('renders nothing when data is undefined', () => {
    const { toJSON } = render(<ContributorHeroCard data={undefined} />);
    expect(toJSON()).toBeNull();
  });

  it('renders nothing when enabled is false (admin toggle)', () => {
    const disabledData = { ...baseMockData, enabled: false };
    const { toJSON } = render(<ContributorHeroCard data={disabledData} />);
    expect(toJSON()).toBeNull();
  });

  it('survives lifecycle rerenders: undefined -> loaded -> disabled without hook order crash', () => {
    const { toJSON, rerender, getByText, getByTestId, queryByTestId } = render(
      <ContributorHeroCard data={undefined} />,
    );
    // 1. Initially undefined (query loading) -> returns null
    expect(toJSON()).toBeNull();

    // 2. Query succeeds -> renders loaded card with progress meter
    rerender(<ContributorHeroCard data={baseMockData} />);
    expect(getByText('LVL 4')).toBeTruthy();
    expect(getByTestId('contributor-progress-fill')).toBeTruthy();

    // 3. Admin disables feature -> safely unmounts/returns null without crashing
    const disabledData = { ...baseMockData, enabled: false };
    rerender(<ContributorHeroCard data={disabledData} />);
    expect(queryByTestId('contributor-hero-card')).toBeNull();
    expect(toJSON()).toBeNull();
  });
  it('renders Level 4 card details with progress meter', () => {
    const { getByText, getByTestId } = render(<ContributorHeroCard data={baseMockData} />);

    expect(getByText('LVL 4')).toBeTruthy();
    expect(getByText('Pantry Scout')).toBeTruthy();
    expect(getByText('180 / 300 pts')).toBeTruthy();
    expect(getByText('20 more products to Level 5 Catalog Explorer!')).toBeTruthy();

    const progressFill = getByTestId('contributor-progress-fill');
    expect(progressFill.props.style).toMatchObject({ width: '20%' });
  });

  it('renders Level 0 (Unranked) state for a brand new user', () => {
    const unrankedData: UserContributionsResponse = {
      ...baseMockData,
      progression: {
        currentLevel: 0,
        title: 'New Explorer',
        badgeKey: 'seedling',
        colorToken: 'fresh_sage',
        colorHex: '#4BAE8A',
        totalPoints: 0,
        activeProductsCount: 0,
        currentLevelMinPoints: 0,
        nextLevel: 1,
        nextLevelMinPoints: 10,
        pointsToNextLevel: 10,
        productsToNextLevel: 1,
        progressPercent: 0,
        isMaxLevel: false,
        perks: 'Add your first product to reach Level 1 Novice Scout',
      },
    };

    const { getByText, getByTestId } = render(<ContributorHeroCard data={unrankedData} />);
    expect(getByText('NEW')).toBeTruthy();
    expect(getByText('New Explorer')).toBeTruthy();
    expect(getByText('0 / 10 pts')).toBeTruthy();
    expect(getByText('10 pts • Add your first product to reach Level 1!')).toBeTruthy();
    expect(getByTestId('contributor-progress-fill').props.style).toMatchObject({ width: '0%' });
  });

  it('renders Level 10 (Max Level) state with maximum level text', () => {
    const maxLevelData: UserContributionsResponse = {
      ...baseMockData,
      progression: {
        currentLevel: 10,
        title: 'Expyrico Champion',
        badgeKey: 'diamond_starburst',
        colorToken: 'deep_sage',
        colorHex: '#3A8F6F',
        totalPoints: 10000,
        activeProductsCount: 1000,
        currentLevelMinPoints: 10000,
        nextLevel: null,
        nextLevelMinPoints: null,
        pointsToNextLevel: 0,
        productsToNextLevel: 0,
        progressPercent: 100,
        isMaxLevel: true,
        perks: 'Hall of Fame recognition',
      },
    };

    const { getByText } = render(<ContributorHeroCard data={maxLevelData} />);
    expect(getByText('LVL 10')).toBeTruthy();
    expect(getByText('Expyrico Champion')).toBeTruthy();
    expect(getByText('10,000 pts')).toBeTruthy();
    expect(getByText('🏆 Maximum Level Reached • Expyrico Champion')).toBeTruthy();
  });

  it('opens roadmap modal upon card press', () => {
    const { getByTestId, queryByTestId } = render(<ContributorHeroCard data={baseMockData} />);

    // Initially modal is closed
    expect(queryByTestId('contributor-roadmap-modal')).toBeNull();

    // Tap hero card
    fireEvent.press(getByTestId('contributor-hero-card'));

    // Modal is now open and renders tier list
    expect(getByTestId('contributor-roadmap-modal')).toBeTruthy();
    expect(getByTestId('roadmap-tier-1')).toBeTruthy();
    expect(getByTestId('roadmap-tier-10')).toBeTruthy();
  });
});
