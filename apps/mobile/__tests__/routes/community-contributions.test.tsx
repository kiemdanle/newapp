import React from 'react';
import { Animated } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import CommunityContributionsScreen from '../../app/(app)/profile/contributions';
import { useUserContributionsInfinite } from '../../src/api/contributions';
import { DEFAULT_CONTRIBUTOR_LEVELS } from '@expyrico/shared';

// Mock navigation
const mockGoBack = jest.fn();
const mockPush = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    goBack: mockGoBack,
    push: mockPush,
  }),
}));

// Mock theme
jest.mock('../../src/theme/useTheme', () => ({
  useTheme: () => ({
    colors: {
      primary: '#4BAE8A',
      primaryDark: '#3A8F6F',
      bg: '#FAFAF8',
      bgElevated: '#FFFFFF',
      bgGlass: '#F4F4F2',
      border: '#E5E5E2',
      text: '#2C2C28',
      textMuted: '#8C8C85',
    },
    radii: {
      lg: 16,
    },
  }),
}));

// Mock Screen component
jest.mock('../../src/components/Screen', () => ({
  Screen: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock Ionicons
jest.mock('react-native-vector-icons/Ionicons', () => 'Ionicons');

// Mock contributions API hook
jest.mock('../../src/api/contributions', () => ({
  useUserContributionsInfinite: jest.fn(),
}));

describe('CommunityContributionsScreen', () => {
  const mockContributionsData = {
    enabled: true,
    levels: [...DEFAULT_CONTRIBUTOR_LEVELS],
    progression: {
      currentLevel: 2,
      title: 'Junior Contributor',
      badgeKey: 'bronze_star',
      colorToken: 'honey',
      colorHex: '#F5A623',
      totalPoints: 35,
      currentLevelMinPoints: 30,
      nextLevel: 3,
      nextLevelMinPoints: 70,
      pointsToNextLevel: 35,
      productsToNextLevel: 4,
      progressPercent: 12,
      isMaxLevel: false,
      perks: 'Bronze Contributor star',
    },
    stats: {
      totalContributed: 3,
      activeApproved: 2,
      pendingReview: 1,
      changesRequested: 0,
      editsApproved: 0,
    },
    items: [
      {
        id: 'p-1',
        name: 'Oat Milk Organic',
        barcode: '1111222233334',
        brand: 'Oatly',
        status: 'active',
        coverImageUrl: 'https://img.test/oat.jpg',
        packagingPhotosCount: 2,
        editsCount: 0,
        createdAt: '2026-09-01T12:00:00.000Z',
        updatedAt: '2026-09-01T12:00:00.000Z',
      },
      {
        id: 'p-2',
        name: 'Sourdough Bread',
        barcode: '5555666677778',
        brand: 'Bakery Co',
        status: 'active',
        coverImageUrl: null,
        packagingPhotosCount: 0,
        editsCount: 1,
        createdAt: '2026-09-02T12:00:00.000Z',
        updatedAt: '2026-09-02T12:00:00.000Z',
      },
      {
        id: 'p-3',
        name: 'Matcha Green Tea',
        barcode: '9999000011112',
        brand: 'Ippodo',
        status: 'pending',
        coverImageUrl: null,
        packagingPhotosCount: 1,
        editsCount: 0,
        createdAt: '2026-09-03T12:00:00.000Z',
        updatedAt: '2026-09-03T12:00:00.000Z',
      },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useUserContributionsInfinite as jest.Mock).mockReturnValue({
      data: { pages: [mockContributionsData] },
      isLoading: false,
      isRefetching: false,
      isFetchingNextPage: false,
      hasNextPage: false,
      fetchNextPage: jest.fn(),
      refetch: jest.fn(),
    });
  });
  it('renders header, bento banner with level stats, and full item list', () => {
    const { getByText } = render(<CommunityContributionsScreen />);

    expect(getByText('Community Contributions')).toBeTruthy();
    expect(getByText('Level 2 • Junior Contributor')).toBeTruthy();
    expect(getByText('35 contributor points earned')).toBeTruthy();
    expect(getByText('All (3)')).toBeTruthy();
    expect(getByText('Approved (2)')).toBeTruthy();
    expect(getByText('In Review (1)')).toBeTruthy();

    expect(getByText('Oat Milk Organic')).toBeTruthy();
    expect(getByText('Sourdough Bread')).toBeTruthy();
    expect(getByText('Matcha Green Tea')).toBeTruthy();
  });

  it('filters items when tapping Approved filter chip', () => {
    const { getByText, queryByText } = render(<CommunityContributionsScreen />);

    // Tap Approved filter
    fireEvent.press(getByText('Approved (2)'));

    // Should show active items
    expect(getByText('Oat Milk Organic')).toBeTruthy();
    expect(getByText('Sourdough Bread')).toBeTruthy();

    // Should NOT show pending item
    expect(queryByText('Matcha Green Tea')).toBeNull();
  });

  it('filters items when tapping In Review filter chip', () => {
    const { getByText, queryByText } = render(<CommunityContributionsScreen />);

    // Tap In Review filter
    fireEvent.press(getByText('In Review (1)'));

    // Should show pending item
    expect(getByText('Matcha Green Tea')).toBeTruthy();

    // Should NOT show active items
    expect(queryByText('Oat Milk Organic')).toBeNull();
    expect(queryByText('Sourdough Bread')).toBeNull();
  });

  it('filters items locally immediately and debounces API search query by 300ms', () => {
    jest.useFakeTimers();
    try {
      const { getByPlaceholderText, getByText, queryByText } = render(<CommunityContributionsScreen />);

      // Initial call has empty query
      expect(useUserContributionsInfinite).toHaveBeenLastCalledWith(
        expect.objectContaining({ q: '' }),
      );

      const searchInput = getByPlaceholderText('Search your contributions...');
      fireEvent.changeText(searchInput, 'Oat');

      // Local filter is immediate
      expect(getByText('Oat Milk Organic')).toBeTruthy();
      expect(queryByText('Sourdough Bread')).toBeNull();
      expect(queryByText('Matcha Green Tea')).toBeNull();

      // Hook query has NOT updated yet (before 300ms elapsed)
      expect(useUserContributionsInfinite).toHaveBeenLastCalledWith(
        expect.objectContaining({ q: '' }),
      );

      // Advance by 299ms - still not updated
      act(() => {
        jest.advanceTimersByTime(299);
      });
      expect(useUserContributionsInfinite).toHaveBeenLastCalledWith(
        expect.objectContaining({ q: '' }),
      );

      // Advance past 300ms - now debounced query updates and triggers API hook
      act(() => {
        jest.advanceTimersByTime(1);
      });
      expect(useUserContributionsInfinite).toHaveBeenLastCalledWith(
        expect.objectContaining({ q: 'Oat' }),
      );
    } finally {
      jest.useRealTimers();
    }
  });

  it('preserves exact server ordering across multiple pages without in-memory re-collation', () => {
    const page1Item1 = { ...mockContributionsData.items[0]!, id: 'srv-1', name: 'Zeta Product' };
    const page1Item2 = { ...mockContributionsData.items[1]!, id: 'srv-2', name: 'Alpha Product' };
    const page2Item1 = { ...mockContributionsData.items[2]!, id: 'srv-3', name: 'Beta Product' };

    (useUserContributionsInfinite as jest.Mock).mockReturnValue({
      data: {
        pages: [
          {
            ...mockContributionsData,
            items: [page1Item1, page1Item2],
            hasMore: true,
            nextOffset: 2,
          },
          {
            ...mockContributionsData,
            items: [page2Item1],
            hasMore: false,
            nextOffset: null,
          },
        ],
      },
      isLoading: false,
      isRefetching: false,
      isFetchingNextPage: false,
      hasNextPage: false,
      fetchNextPage: jest.fn(),
      refetch: jest.fn(),
    });

    const { getAllByRole } = render(<CommunityContributionsScreen />);

    const cards = getAllByRole('button').filter((el) =>
      el.props.accessibilityLabel?.startsWith('Zeta Product') ||
      el.props.accessibilityLabel?.startsWith('Alpha Product') ||
      el.props.accessibilityLabel?.startsWith('Beta Product'),
    );

    expect(cards).toHaveLength(3);
    expect(cards[0]!.props.accessibilityLabel).toContain('Zeta Product');
    expect(cards[1]!.props.accessibilityLabel).toContain('Alpha Product');
    expect(cards[2]!.props.accessibilityLabel).toContain('Beta Product');
  });

  it('synchronizes scroll state and resets header translation during scrolled -> search -> loaded sequence', () => {
    jest.useFakeTimers();
    const setValueSpy = jest.spyOn(Animated.Value.prototype, 'setValue');
    try {
      const { getByPlaceholderText, getByTestId } = render(<CommunityContributionsScreen />);

      const list = getByTestId('contributions-list');

      // 1. Simulate user scrolling down by 250px (collapsing the header)
      fireEvent.scroll(list, {
        nativeEvent: {
          contentOffset: { y: 250 },
          contentSize: { height: 2000, width: 400 },
          layoutMeasurement: { height: 600, width: 400 },
        },
      });

      setValueSpy.mockClear();

      // 2. User searches for 'Oat' while collapsed
      const searchInput = getByPlaceholderText('Search your contributions...');
      fireEvent.changeText(searchInput, 'Oat');

      // 3. Advance past 300ms debounce
      act(() => {
        jest.advanceTimersByTime(300);
      });

      // 4. Verifies that scrollY was explicitly reset to 0 to synchronize header and list
      expect(setValueSpy).toHaveBeenCalledWith(0);
    } finally {
      setValueSpy.mockRestore();
      jest.useRealTimers();
    }
  });

  it('renders empty state when there are no contributions', () => {
    (useUserContributionsInfinite as jest.Mock).mockReturnValue({
      data: {
        pages: [
          {
            enabled: true,
            levels: [...DEFAULT_CONTRIBUTOR_LEVELS],
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
            stats: {
              totalContributed: 0,
              activeApproved: 0,
              pendingReview: 0,
              changesRequested: 0,
              editsApproved: 0,
            },
            items: [],
          },
        ],
      },
      isLoading: false,
      isRefetching: false,
      isFetchingNextPage: false,
      hasNextPage: false,
      fetchNextPage: jest.fn(),
      refetch: jest.fn(),
    });
    const { getByText } = render(<CommunityContributionsScreen />);

    expect(getByText('No contributions yet')).toBeTruthy();
    expect(getByText('Scan or Add Product')).toBeTruthy();

    fireEvent.press(getByText('Scan or Add Product'));
    expect(mockPush).toHaveBeenCalledWith('Scan');
  });

  it('navigates to product detail when tapping an active product card', () => {
    const { getByText } = render(<CommunityContributionsScreen />);

    fireEvent.press(getByText('Oat Milk Organic'));
    expect(mockPush).toHaveBeenCalledWith('Product', { id: 'p-1' });
  });

  it('navigates to ProductNew with resume=pending when tapping a pending product card', () => {
    const { getByText } = render(<CommunityContributionsScreen />);

    fireEvent.press(getByText('Matcha Green Tea'));
    expect(mockPush).toHaveBeenCalledWith('ProductNew', { productId: 'p-3', resume: 'pending' });
  });

  it('renders error state and calls refetch on retry', () => {
    const mockRefetch = jest.fn();
    (useUserContributionsInfinite as jest.Mock).mockReturnValue({
      data: undefined,
      isLoading: false,
      isRefetching: false,
      isFetchingNextPage: false,
      isError: true,
      refetch: mockRefetch,
    });

    const { getByText } = render(<CommunityContributionsScreen />);
    expect(getByText('Unable to load contributions')).toBeTruthy();

    fireEvent.press(getByText('Retry'));
    expect(mockRefetch).toHaveBeenCalled();
  });
});
