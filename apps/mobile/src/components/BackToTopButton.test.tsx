import React from 'react';
import { act, fireEvent, render, renderHook } from '@testing-library/react-native';
import {
  BackToTopButton,
  scrollToTop,
  useBackToTop,
  type ScrollableTarget,
} from './BackToTopButton';

jest.mock('../theme/useTheme', () => ({
  useTheme: jest.fn(() => ({
    scheme: 'light',
    colors: {
      primary: '#4BAE8A',
      primaryDark: '#3A8F6F',
      bg: '#FAFAF8',
    },
  })),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: jest.fn(() => ({ top: 40, bottom: 20, left: 0, right: 0 })),
}));

describe('scrollToTop', () => {
  it('calls scrollToOffset on FlatList', () => {
    const mockFlatList = {
      scrollToOffset: jest.fn(),
    };
    scrollToTop(mockFlatList);
    expect(mockFlatList.scrollToOffset).toHaveBeenCalledWith({ offset: 0, animated: true });
  });

  it('calls scrollTo on ScrollView', () => {
    const mockScrollView = {
      scrollTo: jest.fn(),
    };
    scrollToTop(mockScrollView);
    expect(mockScrollView.scrollTo).toHaveBeenCalledWith({ x: 0, y: 0, animated: true });
  });

  it('calls getScrollResponder().scrollTo on SectionList for absolute top (y: 0)', () => {
    const mockScrollResponder = {
      scrollTo: jest.fn(),
    };
    const mockSectionList = {
      getScrollResponder: jest.fn(() => mockScrollResponder),
    };
    scrollToTop(mockSectionList);
    expect(mockScrollResponder.scrollTo).toHaveBeenCalledWith({ x: 0, y: 0, animated: true });
  });

  it('falls back to scrollToLocation on SectionList if neither responder nor inner list exist', () => {
    const mockSectionList = {
      scrollToLocation: jest.fn(),
    };
    scrollToTop(mockSectionList);
    expect(mockSectionList.scrollToLocation).toHaveBeenCalledWith({
      sectionIndex: 0,
      itemIndex: 0,
      viewOffset: 0,
      animated: true,
    });
  });

  it('handles null/undefined target gracefully without throwing', () => {
    expect(() => scrollToTop(null)).not.toThrow();
    expect(() => scrollToTop(undefined)).not.toThrow();
    expect(() => scrollToTop({ current: null })).not.toThrow();
  });
});

describe('useBackToTop', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('starts invisible at top of list', () => {
    const { result } = renderHook(() => useBackToTop({ threshold: 280 }));
    expect(result.current.visible).toBe(false);
  });

  it('becomes visible when scroll offset exceeds threshold', () => {
    const { result } = renderHook(() => useBackToTop({ threshold: 280 }));

    act(() => {
      result.current.handleScroll({
        nativeEvent: { contentOffset: { y: 150, x: 0 } },
      } as any);
    });
    expect(result.current.visible).toBe(false);

    act(() => {
      result.current.handleScroll({
        nativeEvent: { contentOffset: { y: 320, x: 0 } },
      } as any);
    });
    expect(result.current.visible).toBe(true);
  });

  it('auto-fades after inactivity timeout', () => {
    const { result } = renderHook(() =>
      useBackToTop({ threshold: 280, autoHideTimeout: 2500 }),
    );

    act(() => {
      result.current.handleScroll({
        nativeEvent: { contentOffset: { y: 350, x: 0 } },
      } as any);
    });
    expect(result.current.visible).toBe(true);

    // Fast-forward 2500ms
    act(() => {
      jest.advanceTimersByTime(2500);
    });
    expect(result.current.visible).toBe(false);

    // Re-scrolling restores visibility
    act(() => {
      result.current.handleScroll({
        nativeEvent: { contentOffset: { y: 360, x: 0 } },
      } as any);
    });
    expect(result.current.visible).toBe(true);
  });

  it('restores visibility on touch after idle fade if above threshold, and stays hidden if below threshold', () => {
    const { result } = renderHook(() =>
      useBackToTop({ threshold: 280, autoHideTimeout: 2500 }),
    );

    // 1. Below threshold: touch does not show button
    act(() => {
      result.current.handleScroll({
        nativeEvent: { contentOffset: { y: 120, x: 0 } },
      } as any);
    });
    expect(result.current.visible).toBe(false);

    act(() => {
      result.current.handleTouchActivity();
    });
    expect(result.current.visible).toBe(false);

    // 2. Above threshold: scroll past threshold shows button
    act(() => {
      result.current.handleScroll({
        nativeEvent: { contentOffset: { y: 400, x: 0 } },
      } as any);
    });
    expect(result.current.visible).toBe(true);

    // Idle fade: advance 2500ms
    act(() => {
      jest.advanceTimersByTime(2500);
    });
    expect(result.current.visible).toBe(false);

    // Touch without scrolling restores visibility
    act(() => {
      result.current.onTouchStart();
    });
    expect(result.current.visible).toBe(true);
  });
  it('resets to invisible when scrolled back below threshold', () => {
    const { result } = renderHook(() => useBackToTop({ threshold: 280 }));

    act(() => {
      result.current.handleScroll({
        nativeEvent: { contentOffset: { y: 400, x: 0 } },
      } as any);
    });
    expect(result.current.visible).toBe(true);

    act(() => {
      result.current.handleScroll({
        nativeEvent: { contentOffset: { y: 50, x: 0 } },
      } as any);
    });
    expect(result.current.visible).toBe(false);
  });

  it('calls scrollToTop and hides button when scrollToTop is invoked', () => {
    const mockFlatList = { scrollToOffset: jest.fn() };
    const scrollRef = { current: mockFlatList };

    const { result } = renderHook(() => useBackToTop({ scrollRef }));

    act(() => {
      result.current.handleScroll({
        nativeEvent: { contentOffset: { y: 400, x: 0 } },
      } as any);
    });
    expect(result.current.visible).toBe(true);

    act(() => {
      result.current.scrollToTop();
    });

    expect(result.current.visible).toBe(false);
    expect(mockFlatList.scrollToOffset).toHaveBeenCalledWith({ offset: 0, animated: true });
  });
});

describe('BackToTopButton component', () => {
  it('renders with accessibility properties', () => {
    const { getByTestId } = render(
      <BackToTopButton visible={true} testID="test-back-to-top" />,
    );
    const button = getByTestId('test-back-to-top');
    expect(button).toBeTruthy();
    expect(button.props.accessibilityRole).toBe('button');
    expect(button.props.accessibilityLabel).toBe('Scroll back to top');
  });

  it('triggers onPress callback when tapped', () => {
    const onPress = jest.fn();
    const { getByTestId } = render(
      <BackToTopButton visible={true} onPress={onPress} testID="test-back-to-top" />,
    );
    fireEvent.press(getByTestId('test-back-to-top'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('calculates tab-bar bottom offset correctly', () => {
    const { getByTestId } = render(
      <BackToTopButton visible={true} hasTabBar={true} testID="test-back-to-top" />,
    );
    // insets.bottom is 20, so 20 + 68 = 88
    const container = getByTestId('test-back-to-top-container');
    expect(container.props.style).toEqual(
      expect.objectContaining({
        bottom: 88,
        right: 16,
      }),
    );
  });

  it('calculates non-tab-bar bottom offset correctly', () => {
    const { getByTestId } = render(
      <BackToTopButton visible={true} hasTabBar={false} offsetBottom={8} testID="test-back-to-top" />,
    );
    // insets.bottom is 20, so Math.max(20, 16) + 16 + 8 = 44
    const container = getByTestId('test-back-to-top-container');
    expect(container.props.style).toEqual(
      expect.objectContaining({
        bottom: 44,
        right: 16,
      }),
    );
  });

  it('hides from accessibility tree when invisible', () => {
    const { getByTestId } = render(
      <BackToTopButton visible={false} testID="test-back-to-top" />,
    );
    const container = getByTestId('test-back-to-top-container', { includeHiddenElements: true });
    expect(container.props.accessibilityElementsHidden).toBe(true);
    expect(container.props.importantForAccessibility).toBe('no-hide-descendants');
    expect(container.props.pointerEvents).toBe('none');
  });
});
