import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  PanResponder,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUiPreferencesStore } from '../store/uiPreferencesStore';

export interface DraggableFloatingButtonProps {
  children: React.ReactNode;
  buttonWidth?: number;
  buttonHeight?: number;
  onPress: () => void;
  onPositionChange?: (position: { x: number; y: number }) => void;
  testID?: string;
}

export function DraggableFloatingButton({
  children,
  buttonWidth = 48,
  buttonHeight = 48,
  onPress,
  onPositionChange,
  testID = 'draggable-floating-button',
}: DraggableFloatingButtonProps) {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const savedPosition = useUiPreferencesStore((s) => s.menuButtonPosition);
  const setSavedPosition = useUiPreferencesStore((s) => s.setMenuButtonPosition);

  // Safe area bounds: allow freeform dragging all the way to the bottom safe area
  const minX = insets.left + 12;
  const maxX = Math.max(minX, screenWidth - buttonWidth - insets.right - 12);
  const minY = insets.top + 12;
  const bottomOffset = Math.max(insets.bottom, 16);
  const maxY = Math.max(minY, screenHeight - buttonHeight - bottomOffset);

  // Default placement: aligned with bottom navigation bar in bottom right
  const defaultX = maxX;
  const defaultY = maxY;

  const initialX = savedPosition ? Math.min(Math.max(savedPosition.x, minX), maxX) : defaultX;
  const initialY = savedPosition ? Math.min(Math.max(savedPosition.y, minY), maxY) : defaultY;

  const pan = useRef(new Animated.ValueXY({ x: initialX, y: initialY })).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const currentPos = useRef({ x: initialX, y: initialY });
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (savedPosition) {
      const clampedX = Math.min(Math.max(savedPosition.x, minX), maxX);
      const clampedY = Math.min(Math.max(savedPosition.y, minY), maxY);
      currentPos.current = { x: clampedX, y: clampedY };
      pan.setValue({ x: clampedX, y: clampedY });
      onPositionChange?.(currentPos.current);
    }
  }, [savedPosition, minX, maxX, minY, maxY, pan, onPositionChange]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_e, gestureState) => {
        return Math.abs(gestureState.dx) > 6 || Math.abs(gestureState.dy) > 6;
      },
      onPanResponderGrant: () => {
        setIsDragging(true);
        pan.setOffset({
          x: currentPos.current.x,
          y: currentPos.current.y,
        });
        pan.setValue({ x: 0, y: 0 });
        Animated.spring(scaleAnim, {
          toValue: 1.06,
          friction: 6,
          useNativeDriver: false,
        }).start();
      },
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], {
        useNativeDriver: false,
      }),
      onPanResponderRelease: (_e, gestureState) => {
        setIsDragging(false);
        pan.flattenOffset();
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 6,
          useNativeDriver: false,
        }).start();

        const totalDist = Math.sqrt(
          gestureState.dx * gestureState.dx + gestureState.dy * gestureState.dy,
        );

        // Tap vs. Drag: If total movement was less than 6px, treat as click
        if (totalDist < 6) {
          pan.setValue(currentPos.current);
          onPress();
          return;
        }

        // Calculate final clamped coordinates
        const targetX = Math.min(Math.max(currentPos.current.x + gestureState.dx, minX), maxX);
        const targetY = Math.min(Math.max(currentPos.current.y + gestureState.dy, minY), maxY);

        currentPos.current = { x: targetX, y: targetY };

        Animated.spring(pan, {
          toValue: { x: targetX, y: targetY },
          friction: 7,
          tension: 40,
          useNativeDriver: false,
        }).start();

        void setSavedPosition({ x: targetX, y: targetY });
        onPositionChange?.({ x: targetX, y: targetY });
      },
    }),
  ).current;

  return (
    <Animated.View
      testID={testID}
      {...panResponder.panHandlers}
      style={[
        styles.draggableContainer,
        {
          width: buttonWidth,
          height: buttonHeight,
          transform: [
            { translateX: pan.x },
            { translateY: pan.y },
            { scale: scaleAnim },
          ],
          elevation: isDragging ? 14 : 8,
          shadowOpacity: isDragging ? 0.28 : 0.16,
        },
      ]}
    >
      <View style={{ width: buttonWidth, height: buttonHeight }}>
        {children}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  draggableContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 101,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
  },
});
