import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, StyleProp, ViewStyle } from 'react-native';

interface SkeletonShimmerProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  duration?: number;
}

export function SkeletonShimmer({
  children,
  style,
  duration = 850,
}: SkeletonShimmerProps) {
  const [reduceMotion, setReduceMotion] = useState(false);
  const opacityAnim = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    let isMounted = true;

    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (isMounted) {
          setReduceMotion(enabled);
        }
      })
      .catch(() => {
        // Fallback gracefully if accessibility check fails
      });

    const subscription = AccessibilityInfo.addEventListener?.(
      'reduceMotionChanged',
      (enabled) => {
        if (isMounted) {
          setReduceMotion(enabled);
        }
      }
    );

    return () => {
      isMounted = false;
      subscription?.remove?.();
    };
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      opacityAnim.setValue(0.7);
      return;
    }

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacityAnim, {
          toValue: 1.0,
          duration,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0.4,
          duration,
          useNativeDriver: true,
        }),
      ])
    );

    animation.start();

    return () => {
      animation.stop();
    };
  }, [opacityAnim, duration, reduceMotion]);

  return (
    <Animated.View style={[{ opacity: opacityAnim }, style]}>
      {children}
    </Animated.View>
  );
}
