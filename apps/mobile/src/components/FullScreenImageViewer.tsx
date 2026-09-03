import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../theme/useTheme';
import { useCachedImage } from '../cache/useCachedImage';

export interface FullScreenImageViewerProps {
  visible: boolean;
  photos: string[];
  initialIndex?: number;
  title?: string;
  onClose: () => void;
}

function ViewerImageItem({ url }: { url: string }) {
  const { uri } = useCachedImage(url);
  const sourceUri = uri || url;

  return (
    <Animated.Image
      source={{ uri: sourceUri }}
      style={styles.modalMainImage}
      resizeMode="contain"
    />
  );
}

function ViewerThumbItem({ url }: { url: string }) {
  const { uri } = useCachedImage(url);
  const sourceUri = uri || url;

  return (
    <Animated.Image
      source={{ uri: sourceUri }}
      style={styles.modalThumbImage}
      resizeMode="cover"
    />
  );
}

export function FullScreenImageViewer({
  visible,
  photos,
  initialIndex = 0,
  title,
  onClose,
}: FullScreenImageViewerProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const screenWidth = Dimensions.get('window').width;
  const screenHeight = Dimensions.get('window').height;

  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const currentIndexRef = useRef(initialIndex);
  currentIndexRef.current = currentIndex;

  const panX = useRef(new Animated.Value(0)).current;
  const panY = useRef(new Animated.Value(0)).current;
  const gestureMode = useRef<'none' | 'vertical' | 'horizontal'>('none');

  // Reset when modal visibility or initial index changes
  useEffect(() => {
    if (visible) {
      setCurrentIndex(initialIndex);
      currentIndexRef.current = initialIndex;
      panX.setValue(0);
      panY.setValue(0);
      gestureMode.current = 'none';
    }
  }, [visible, initialIndex, panX, panY]);

  const handleDismiss = useCallback(() => {
    onClose();
  }, [onClose]);

  const goToNextPhoto = useCallback(() => {
    if (currentIndexRef.current < photos.length - 1) {
      Animated.timing(panX, {
        toValue: -screenWidth,
        duration: 150,
        useNativeDriver: true,
      }).start(() => {
        setCurrentIndex((prev) => prev + 1);
        panX.setValue(0);
      });
    } else {
      Animated.spring(panX, {
        toValue: 0,
        friction: 8,
        tension: 80,
        useNativeDriver: true,
      }).start();
    }
  }, [photos.length, panX, screenWidth]);

  const goToPrevPhoto = useCallback(() => {
    if (currentIndexRef.current > 0) {
      Animated.timing(panX, {
        toValue: screenWidth,
        duration: 150,
        useNativeDriver: true,
      }).start(() => {
        setCurrentIndex((prev) => prev - 1);
        panX.setValue(0);
      });
    } else {
      Animated.spring(panX, {
        toValue: 0,
        friction: 8,
        tension: 80,
        useNativeDriver: true,
      }).start();
    }
  }, [panX, screenWidth]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_evt, gestureState) => {
        return Math.abs(gestureState.dx) > 4 || Math.abs(gestureState.dy) > 4;
      },
      onMoveShouldSetPanResponderCapture: (_evt, gestureState) => {
        return Math.abs(gestureState.dx) > 4 || Math.abs(gestureState.dy) > 4;
      },
      onPanResponderGrant: () => {
        gestureMode.current = 'none';
        panY.setOffset(0);
        panX.setOffset(0);
      },
      onPanResponderMove: (_evt, gestureState) => {
        const absX = Math.abs(gestureState.dx);
        const absY = Math.abs(gestureState.dy);

        // Lock gesture axis once movement exceeds 5px
        if (gestureMode.current === 'none' && (absX > 5 || absY > 5)) {
          if (absY > absX) {
            gestureMode.current = 'vertical';
          } else if (photos.length > 1) {
            gestureMode.current = 'horizontal';
          }
        }

        if (gestureMode.current === 'vertical') {
          if (gestureState.dy > 0) {
            panY.setValue(gestureState.dy);
          } else {
            // Slight resistance upward
            panY.setValue(gestureState.dy * 0.2);
          }
        } else if (gestureMode.current === 'horizontal' && photos.length > 1) {
          const isAtStart = currentIndexRef.current === 0 && gestureState.dx > 0;
          const isAtEnd =
            currentIndexRef.current === photos.length - 1 && gestureState.dx < 0;

          if (isAtStart || isAtEnd) {
            // Edge rubber-band resistance
            panX.setValue(gestureState.dx * 0.3);
          } else {
            panX.setValue(gestureState.dx);
          }
        }
      },
      onPanResponderRelease: (_evt, gestureState) => {
        if (gestureMode.current === 'vertical') {
          // Swipe down threshold: > 50px drag or fast downward velocity
          if (gestureState.dy > 50 || gestureState.vy > 0.35) {
            handleDismiss();
          } else {
            Animated.spring(panY, {
              toValue: 0,
              friction: 7,
              tension: 80,
              useNativeDriver: true,
            }).start();
          }
        } else if (gestureMode.current === 'horizontal' && photos.length > 1) {
          if (gestureState.dx < -40 || gestureState.vx < -0.3) {
            goToNextPhoto();
          } else if (gestureState.dx > 40 || gestureState.vx > 0.3) {
            goToPrevPhoto();
          } else {
            Animated.spring(panX, {
              toValue: 0,
              friction: 7,
              tension: 80,
              useNativeDriver: true,
            }).start();
          }
        } else {
          Animated.parallel([
            Animated.spring(panY, { toValue: 0, friction: 7, tension: 80, useNativeDriver: true }),
            Animated.spring(panX, { toValue: 0, friction: 7, tension: 80, useNativeDriver: true }),
          ]).start();
        }
        gestureMode.current = 'none';
      },
      onPanResponderTerminate: () => {
        Animated.parallel([
          Animated.spring(panY, { toValue: 0, friction: 7, tension: 80, useNativeDriver: true }),
          Animated.spring(panX, { toValue: 0, friction: 7, tension: 80, useNativeDriver: true }),
        ]).start();
        gestureMode.current = 'none';
      },
    }),
  ).current;

  if (!visible || !photos || photos.length === 0) {
    return null;
  }

  const handleSelectThumbnail = (index: number) => {
    if (index !== currentIndex) {
      setCurrentIndex(index);
      panX.setValue(0);
    }
  };

  // Interpolations for swipe-down-to-dismiss visual feedback
  const backdropOpacity = panY.interpolate({
    inputRange: [0, 200],
    outputRange: [1, 0.15],
    extrapolate: 'clamp',
  });

  const contentTranslateY = panY.interpolate({
    inputRange: [-80, 0, screenHeight],
    outputRange: [-15, 0, screenHeight],
    extrapolate: 'clamp',
  });

  const contentScale = panY.interpolate({
    inputRange: [0, 260],
    outputRange: [1, 0.82],
    extrapolate: 'clamp',
  });

  const controlsOpacity = panY.interpolate({
    inputRange: [0, 60],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const currentPhotoUrl = photos[currentIndex] || photos[0] || '';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleDismiss}
      statusBarTranslucent
    >
      {/* Animated Dark Backdrop */}
      <Animated.View
        style={[
          styles.modalBackdrop,
          {
            opacity: backdropOpacity,
          },
        ]}
      />

      {/* Swipe Gesture Layer spanning the entire screen */}
      <View style={styles.fullscreenTouchLayer} {...panResponder.panHandlers}>
        {/* Top Header & Drag Handle */}
        <Animated.View
          style={[
            styles.modalHeader,
            {
              paddingTop: Math.max(insets.top, Platform.OS === 'ios' ? 44 : 24),
              opacity: controlsOpacity,
            },
          ]}
        >
          {/* Native Swipe Down Handle */}
          <View style={styles.dragHandle} />

          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.modalTitle} numberOfLines={1}>
                {title || 'Giveaway Photo'}
              </Text>
              <Text style={styles.modalSubtitle}>
                {currentIndex + 1} / {photos.length}
              </Text>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close gallery"
              onPress={handleDismiss}
              style={styles.modalCloseBtn}
            >
              <Ionicons name="close" size={22} color="#FFFFFF" />
            </Pressable>
          </View>
        </Animated.View>

        {/* Center Main Photo Viewer - Gesture Driven */}
        <Animated.View
          testID="modal-fullscreen-carousel"
          style={[
            styles.modalViewerWrap,
            {
              transform: [
                { translateY: contentTranslateY },
                { translateX: panX },
                { scale: contentScale },
              ],
            },
          ]}
        >
          <View style={styles.modalSlide}>
            <ViewerImageItem url={currentPhotoUrl} />
          </View>
        </Animated.View>

        {/* Bottom Thumbnail Strip (for multiple photos) */}
        {photos.length > 1 ? (
          <Animated.View
            style={[
              styles.modalFooter,
              {
                paddingBottom: Math.max(insets.bottom, 20),
                opacity: controlsOpacity,
              },
            ]}
          >
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.modalThumbList}
            >
              {photos.map((url, idx) => {
                const isCurrent = idx === currentIndex;
                return (
                  <Pressable
                    key={`modal-thumb-${idx}-${url}`}
                    testID={`modal-thumb-${idx}`}
                    accessibilityRole="button"
                    accessibilityLabel={`Go to photo ${idx + 1}`}
                    onPress={() => handleSelectThumbnail(idx)}
                    style={[
                      styles.modalThumbCard,
                      {
                        borderColor: isCurrent ? theme.colors.primary : 'rgba(255,255,255,0.3)',
                        opacity: isCurrent ? 1 : 0.6,
                        borderWidth: isCurrent ? 2.5 : 1,
                      },
                    ]}
                  >
                    <ViewerThumbItem url={url} />
                  </Pressable>
                );
              })}
            </ScrollView>
          </Animated.View>
        ) : (
          <View style={{ height: Math.max(insets.bottom, 20) }} />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
  },
  fullscreenTouchLayer: {
    flex: 1,
    justifyContent: 'space-between',
  },
  dragHandle: {
    width: 42,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
    alignSelf: 'center',
    marginBottom: 10,
  },
  modalHeader: {
    paddingHorizontal: 20,
    paddingBottom: 10,
    zIndex: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modalSubtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.75)',
    marginTop: 2,
    fontWeight: '500',
  },
  modalCloseBtn: {
    width: 44,
    height: 44,
    minWidth: 44,
    minHeight: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalViewerWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  modalSlide: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalMainImage: {
    width: '100%',
    height: '100%',
  },
  modalFooter: {
    paddingTop: 10,
    zIndex: 10,
  },
  modalThumbList: {
    paddingHorizontal: 20,
    gap: 8,
    alignItems: 'center',
  },
  modalThumbCard: {
    width: 54,
    height: 54,
    minWidth: 44,
    minHeight: 44,
    borderRadius: 8,
    overflow: 'hidden',
  },
  modalThumbImage: {
    width: '100%',
    height: '100%',
  },
});
