import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  BackHandler,
  PanResponder,
  StyleSheet,
  TouchableWithoutFeedback,
  useWindowDimensions,
  View,
} from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { useTheme } from '../theme/useTheme';
import { useDrawerStore } from '../store/drawerStore';
import { useSelectionModeStore } from '../store/selectionModeStore';

export interface SlidingDrawerProps {
  drawerContent: React.ReactNode;
  children: React.ReactNode;
  drawerWidth?: number;
}

export function SlidingDrawer({
  drawerContent,
  children,
  drawerWidth,
}: SlidingDrawerProps) {
  const { width: windowWidth } = useWindowDimensions();
  const width = drawerWidth ?? Math.min(windowWidth * 0.75, 300);

  const isOpen = useDrawerStore((s) => s.isOpen);
  const closeDrawer = useDrawerStore((s) => s.closeDrawer);
  const openDrawer = useDrawerStore((s) => s.openDrawer);
  const isSelectionMode = useSelectionModeStore((s) => s.isSelectionMode);

  const isOpenRef = useRef(isOpen);
  isOpenRef.current = isOpen;
  const isSelectionModeRef = useRef(isSelectionMode);
  isSelectionModeRef.current = isSelectionMode;

  const isFocused = useIsFocused();
  const theme = useTheme();

  const slideAnim = useRef(new Animated.Value(0)).current;
  const [isRenderedOpen, setIsRenderedOpen] = useState(isOpen);

  // Auto-close drawer if selection mode activates
  useEffect(() => {
    if (isSelectionMode && isOpen) {
      closeDrawer();
    }
  }, [isSelectionMode, isOpen, closeDrawer]);

  // Handle native-driver spring animation with in-flight race cancellation & unmount safety
  useEffect(() => {
    let isMounted = true;
    if (isOpen) {
      setIsRenderedOpen(true);
    }
    slideAnim.stopAnimation();
    Animated.spring(slideAnim, {
      toValue: isOpen ? 1 : 0,
      tension: 65,
      friction: 9,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (isMounted && finished && !isOpen) {
        setIsRenderedOpen(false);
      }
    });

    return () => {
      isMounted = false;
      slideAnim.stopAnimation();
    };
  }, [isOpen, slideAnim]);

  // Focus-gated Android hardware back button handler
  useEffect(() => {
    if (!isOpen || !isFocused) return;

    const onBackPress = () => {
      closeDrawer();
      return true; // consumed
    };

    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      onBackPress
    );
    return () => subscription.remove();
  }, [isOpen, isFocused, closeDrawer]);

  // Edge-swipe pan responder on parent container — never claims on start, so taps reach children.
  // Claims on move only when touch began at x0 < 24 and moves right.
  const edgePanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        if (isOpenRef.current || isSelectionModeRef.current) return false;
        const x0 = evt.nativeEvent?.pageX ?? 0;
        return (
          x0 < 24 &&
          gestureState.dx > 15 &&
          (gestureState.vx > 0.3 || gestureState.dx > 30)
        );
      },
      onMoveShouldSetPanResponderCapture: (evt, gestureState) => {
        if (isOpenRef.current || isSelectionModeRef.current) return false;
        const x0 = evt.nativeEvent?.pageX ?? 0;
        return (
          x0 < 24 &&
          gestureState.dx > 15 &&
          (gestureState.vx > 0.3 || gestureState.dx > 30)
        );
      },
      onPanResponderRelease: (_, gestureState) => {
        if (
          gestureState.dx > 25 &&
          (gestureState.vx > 0.2 || gestureState.dx > 50)
        ) {
          openDrawer();
        }
      },
    })
  ).current;

  // Backdrop gesture handler (tap or swipe-left to close)
  const backdropPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 10;
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx < -15 || Math.abs(gestureState.dx) < 10) {
          closeDrawer();
        }
      },
    })
  ).current;

  const translateX = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, width],
  });

  const scale = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.94],
  });

  const backdropOpacity = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.35],
  });

  return (
    <View
      style={[styles.root, { backgroundColor: theme.colors.bgElevated }]}
      testID="sliding-drawer-root"
      {...edgePanResponder.panHandlers}
    >
      {/* Background Drawer Layer */}
      <View
        style={[
          styles.drawerContainer,
          { width, backgroundColor: theme.colors.bgElevated },
        ]}
        pointerEvents={isOpen ? 'auto' : 'none'}
        accessibilityElementsHidden={!isOpen}
        importantForAccessibility={isOpen ? 'yes' : 'no-hide-descendants'}
        testID="sliding-drawer-content"
      >
        {drawerContent}
      </View>

      {/* Foreground Sliding Screen Container (Outer + Inner Deck Architecture) */}
      <Animated.View
        style={[
          styles.outerDeck,
          {
            transform: [{ translateX }, { scale }],
            shadowOpacity: isOpen ? 0.18 : 0,
            elevation: isOpen ? 12 : 0,
          },
        ]}
        testID="sliding-drawer-outer-deck"
      >
        <View
          style={[
            styles.innerDeck,
            {
              borderRadius: isOpen ? 16 : 0,
              overflow: isOpen ? 'hidden' : 'visible',
              backgroundColor: theme.colors.bg,
            },
          ]}
          testID="sliding-drawer-inner-deck"
        >
          {/* Content layer (unresponsive to taps and isolated from a11y when drawer is open) */}
          <View
            style={styles.contentWrapper}
            pointerEvents={isOpen ? 'none' : 'auto'}
            accessibilityElementsHidden={isOpen}
            importantForAccessibility={isOpen ? 'no-hide-descendants' : 'yes'}
            testID="sliding-drawer-children-wrapper"
          >
            {children}
          </View>

          {/* Dimming Backdrop Overlay */}
          {(isOpen || isRenderedOpen) && (
            <Animated.View
              style={[
                styles.backdrop,
                { opacity: backdropOpacity },
              ]}
              pointerEvents={isOpen ? 'auto' : 'none'}
              testID="drawer-backdrop"
              {...backdropPanResponder.panHandlers}
            >
              <TouchableWithoutFeedback
                onPress={closeDrawer}
                accessibilityRole="button"
                accessibilityLabel="Dismiss menu backdrop"
                testID="drawer-backdrop-button"
              >
                <View style={StyleSheet.absoluteFill} />
              </TouchableWithoutFeedback>
            </Animated.View>
          )}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    overflow: 'visible',
  },
  drawerContainer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    zIndex: 1,
  },
  outerDeck: {
    flex: 1,
    overflow: 'visible',
    shadowColor: '#000',
    shadowOffset: { width: -4, height: 0 },
    shadowRadius: 10,
    zIndex: 2,
    transformOrigin: 'top left',
  },
  innerDeck: {
    flex: 1,
  },
  contentWrapper: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
    zIndex: 10,
  },
});
