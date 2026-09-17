import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  type FlatList,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  type ScrollView,
  type SectionList,
  StyleSheet,
  View,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/useTheme';

export type ScrollableTarget =
  | { scrollToOffset: (params: { offset: number; animated?: boolean }) => void }
  | { scrollTo: (params: { x?: number; y?: number; animated?: boolean }) => void }
  | { getScrollResponder: () => { scrollTo: (params: { x?: number; y?: number; animated?: boolean }) => void } | null }
  | { scrollToLocation: (params: { sectionIndex: number; itemIndex: number; viewOffset?: number; animated?: boolean }) => void }
  | FlatList<unknown>
  | SectionList<unknown>
  | ScrollView;
export type ScrollableRef = React.RefObject<ScrollableTarget | null | undefined>;

/**
 * Universal resilient scroll-to-top responder helper.
 * Safely supports FlatList, SectionList, and ScrollView without throwing errors on empty lists.
 */
export function scrollToTop(
  target: ScrollableRef | ScrollableTarget | null | undefined,
): void {
  const ref = target && 'current' in target ? target.current : target;
  if (!ref || typeof ref !== 'object') return;

  // 1. FlatList direct scrollToOffset
  if ('scrollToOffset' in ref && typeof ref.scrollToOffset === 'function') {
    ref.scrollToOffset({ offset: 0, animated: true });
    return;
  }

  // 2. ScrollView direct scrollTo({ x: 0, y: 0 })
  if ('scrollTo' in ref && typeof ref.scrollTo === 'function') {
    ref.scrollTo({ x: 0, y: 0, animated: true });
    return;
  }

  // 3. SectionList scroll responder: scrolls to absolute top (y: 0)
  if ('getScrollResponder' in ref && typeof ref.getScrollResponder === 'function') {
    const responder = ref.getScrollResponder();
    if (responder && typeof responder === 'object' && 'scrollTo' in responder && typeof responder.scrollTo === 'function') {
      responder.scrollTo({ x: 0, y: 0, animated: true });
      return;
    }
  }

  // 4. SectionList fallback
  if ('scrollToLocation' in ref && typeof ref.scrollToLocation === 'function') {
    try {
      ref.scrollToLocation({ sectionIndex: 0, itemIndex: 0, viewOffset: 0, animated: true });
    } catch {
      // Ignore if empty
    }
  }
}
export interface UseBackToTopOptions {
  threshold?: number;
  autoHideTimeout?: number;
  hasTabBar?: boolean;
  bottom?: number;
  offsetBottom?: number;
  scrollRef?: ScrollableRef;
  onScroll?: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
}

export interface UseBackToTopReturn {
  visible: boolean;
  isVisible: boolean;
  scrollRef: ScrollableRef;
  scrollToTop: () => void;
  handleScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
  handleTouchActivity: () => void;
  onTouchStart: () => void;
  backToTopProps: BackToTopButtonProps;
}

/**
 * Custom hook to monitor scroll offset and manage back-to-top button visibility.
 * Features:
 * - Appears after scrolling past threshold (default: 280px).
 * - Auto-fades after inactivity (default: 2500ms) to keep reading view clear.
 * - Reappears instantly on scroll or touch while scrolled past threshold.
 */
export function useBackToTop(options: UseBackToTopOptions = {}): UseBackToTopReturn {
  const {
    threshold = 280,
    autoHideTimeout = 2500,
    hasTabBar = false,
    bottom,
    offsetBottom,
    scrollRef: externalRef,
    onScroll: externalOnScroll,
  } = options;
  const fallbackRef = useRef<ScrollableTarget | null>(null);
  const resolvedScrollRef: ScrollableRef = externalRef ?? fallbackRef;

  const [visible, setVisible] = useState(false);
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentYRef = useRef(0);

  const clearTimer = useCallback(() => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }
  }, []);

  const resetInactivityTimer = useCallback(() => {
    clearTimer();
    if (autoHideTimeout > 0) {
      inactivityTimerRef.current = setTimeout(() => {
        setVisible(false);
      }, autoHideTimeout);
    }
  }, [autoHideTimeout, clearTimer]);
  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      externalOnScroll?.(e);

      const y = e.nativeEvent.contentOffset.y;
      currentYRef.current = y;

      if (y >= threshold) {
        setVisible(true);
        resetInactivityTimer();
      } else {
        clearTimer();
        setVisible(false);
      }
    },
    [threshold, externalOnScroll, resetInactivityTimer, clearTimer],
  );

  const handleTouchActivity = useCallback(() => {
    if (currentYRef.current >= threshold) {
      setVisible(true);
      resetInactivityTimer();
    }
  }, [threshold, resetInactivityTimer]);

  const handleScrollToTop = useCallback(() => {
    clearTimer();
    setVisible(false);
    scrollToTop(resolvedScrollRef);
  }, [clearTimer, resolvedScrollRef]);

  useEffect(() => {
    return () => {
      clearTimer();
    };
  }, [clearTimer]);

  const backToTopProps: BackToTopButtonProps = {
    scrollRef: resolvedScrollRef,
    visible,
    onPress: handleScrollToTop,
    threshold,
    hasTabBar,
    bottom,
    offsetBottom,
  };

  return {
    visible,
    isVisible: visible,
    scrollRef: resolvedScrollRef,
    scrollToTop: handleScrollToTop,
    handleScroll,
    onScroll: handleScroll,
    handleTouchActivity,
    onTouchStart: handleTouchActivity,
    backToTopProps,
  };
}

export interface BackToTopButtonProps {
  scrollRef?: ScrollableRef;
  visible?: boolean;
  onPress?: () => void;
  threshold?: number;
  hasTabBar?: boolean;
  bottom?: number;
  offsetBottom?: number;
  right?: number;
  testID?: string;
}

/**
 * Reusable animated circular floating button to return to top of scrollable lists.
 * Adheres strictly to Expyrico palette:
 * - Solid Fresh Sage (#4BAE8A) fill in both light and dark themes.
 * - Warm White (#FAFAF8) arrow-up icon.
 * - Deep Sage (#3A8F6F) pressed state.
 * - Light theme: soft diffuse shadow + Deep Sage hairline boundary.
 * - Dark theme: luminous Mint Mist rim + deep ambient shadow.
 */
export function BackToTopButton({
  scrollRef,
  visible = false,
  onPress,
  hasTabBar = false,
  bottom,
  offsetBottom = 0,
  right = 16,
  testID = 'back-to-top-button',
}: BackToTopButtonProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const isDark = theme.scheme === 'dark';

  const animValue = useRef(new Animated.Value(visible ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(animValue, {
      toValue: visible ? 1 : 0,
      useNativeDriver: true,
      tension: 65,
      friction: 9,
    }).start();
  }, [visible, animValue]);
  const handlePress = useCallback(() => {
    if (onPress) {
      onPress();
    } else if (scrollRef) {
      scrollToTop(scrollRef);
    }
  }, [onPress, scrollRef]);

  // Non-overlapping smart bottom calculation
  const computedBottom =
    typeof bottom === 'number'
      ? bottom
      : hasTabBar
      ? (insets.bottom > 0 ? insets.bottom + 68 : 76) + offsetBottom
      : Math.max(insets.bottom, 16) + 16 + offsetBottom;

  const opacity = animValue;
  const translateY = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [10, 0],
  });
  const scale = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.85, 1],
  });

  return (
    <Animated.View
      testID={`${testID}-container`}
      pointerEvents={visible ? 'auto' : 'none'}
      accessibilityElementsHidden={!visible}
      importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'}
      style={[
        styles.container,
        {
          right,
          bottom: computedBottom,
          opacity,
          transform: [{ translateY }, { scale }],
        },
      ]}
    >
      <Pressable
        testID={testID}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Scroll back to top"
        accessibilityHint="Scrolls the list smoothly back to the top"
        onPress={handlePress}
        style={({ pressed }) => [
          styles.button,
          {
            backgroundColor: pressed ? '#3A8F6F' : '#4BAE8A',
            borderColor: isDark ? 'rgba(214, 240, 230, 0.35)' : 'rgba(58, 143, 111, 0.20)',
            borderWidth: isDark ? 1 : StyleSheet.hairlineWidth,
            shadowColor: isDark ? '#000000' : '#2C2C28',
            shadowOpacity: isDark ? 0.45 : 0.18,
            shadowOffset: isDark ? { width: 0, height: 4 } : { width: 0, height: 3 },
            shadowRadius: isDark ? 8 : 5,
            elevation: isDark ? 6 : 5,
            opacity: pressed ? 0.9 : 1,
          },
        ]}
      >
        <Ionicons name="arrow-up" size={20} color="#FAFAF8" style={styles.icon} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    zIndex: 999,
  },
  button: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    alignSelf: 'center',
  },
});
