// apps/mobile/src/features/giveaways/GiveawayImageGallery.tsx
import React, { useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  Image,
  LayoutChangeEvent,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ImageStyle,
  type StyleProp,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../../theme/useTheme';
import { useCachedImage } from '../../cache/useCachedImage';

interface Props {
  photos: string[];
  title?: string;
}

const INITIAL_HERO_WIDTH = Math.min(Dimensions.get('window').width - 32, 540);

export function GiveawayImageGallery({ photos, title }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const heroScrollRef = useRef<ScrollView>(null);

  const [containerWidth, setContainerWidth] = useState(INITIAL_HERO_WIDTH);
  const [activeIndex, setActiveIndex] = useState(0);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalIndex, setModalIndex] = useState(0);

  const heroHeight = Math.round(containerWidth * 0.75); // 4:3 standard e-commerce ratio

  // Clamp activeIndex if photos array shrinks or changes
  useEffect(() => {
    if (activeIndex >= photos.length && photos.length > 0) {
      setActiveIndex(photos.length - 1);
    }
  }, [photos.length, activeIndex]);

  if (!photos || photos.length === 0) {
    return (
      <View
        style={[
          styles.placeholderHero,
          {
            backgroundColor: theme.colors.bgGlass,
            borderColor: theme.colors.border,
            borderRadius: 16,
          },
        ]}
      >
        <Ionicons name="gift-outline" size={48} color={theme.colors.primary} />
        <Text style={[styles.placeholderText, { color: theme.colors.textMuted }]}>
          No photos provided
        </Text>
      </View>
    );
  }

  const handleLayout = (e: LayoutChangeEvent) => {
    const measuredWidth = Math.round(e.nativeEvent.layout.width);
    if (measuredWidth > 0 && Math.abs(measuredWidth - containerWidth) > 1) {
      setContainerWidth(measuredWidth);
    }
  };

  const handleHeroScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = e.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / containerWidth);
    if (index >= 0 && index < photos.length && index !== activeIndex) {
      setActiveIndex(index);
    }
  };

  const handleSelectThumbnail = (index: number) => {
    setActiveIndex(index);
    heroScrollRef.current?.scrollTo({
      x: index * containerWidth,
      animated: true,
    });
  };

  const handleOpenFullscreen = (index: number) => {
    setModalIndex(index);
    setModalVisible(true);
  };

  return (
    <View style={styles.container}>
      {/* Main Hero Product Image Carousel (Shopee VN Style) */}
      <View
        onLayout={handleLayout}
        style={[
          styles.heroWrap,
          {
            height: heroHeight,
            borderColor: theme.colors.border,
            backgroundColor: theme.colors.bgElevated,
            borderRadius: 16,
          },
        ]}
      >
        <ScrollView
          ref={heroScrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={handleHeroScroll}
          scrollEventThrottle={16}
        >
          {photos.map((url, idx) => (
            <Pressable
              key={`photo-${idx}-${url}`}
              accessibilityRole="button"
              accessibilityLabel={`View photo ${idx + 1} of ${photos.length} full screen`}
              onPress={() => handleOpenFullscreen(idx)}
              style={{ width: containerWidth, height: heroHeight }}
            >
              <GalleryImageItem
                url={url}
                style={styles.heroImage}
                resizeMode="cover"
              />
            </Pressable>
          ))}
        </ScrollView>

        {/* Floating Shopee-style Page Indicator Pill */}
        {photos.length > 1 && (
          <View style={[styles.shopeeCounterBadge, { backgroundColor: 'rgba(0,0,0,0.65)' }]}>
            <Text style={styles.shopeeCounterText}>
              {activeIndex + 1}/{photos.length}
            </Text>
          </View>
        )}
      </View>

      {/* Interactive Thumbnail Strip Immediately Visible Below Hero (No Button Needed) */}
      {photos.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.thumbnailList}
        >
          {photos.map((url, idx) => {
            const isSelected = idx === activeIndex;
            return (
              <Pressable
                key={`thumb-${idx}-${url}`}
                accessibilityRole="button"
                accessibilityLabel={`Show photo ${idx + 1}`}
                onPress={() => handleSelectThumbnail(idx)}
                style={[
                  styles.thumbCard,
                  {
                    borderColor: isSelected ? theme.colors.primary : theme.colors.border,
                    backgroundColor: theme.colors.bgElevated,
                    borderRadius: theme.radii.sm,
                    borderWidth: isSelected ? 2.5 : 1,
                  },
                ]}
              >
                <GalleryImageItem
                  url={url}
                  style={styles.thumbImage}
                  resizeMode="cover"
                />
                {idx === 0 && (
                  <View style={[styles.coverTag, { backgroundColor: theme.colors.primary }]}>
                    <Text style={styles.coverTagText}>Cover</Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      {/* Fullscreen Photo Gallery Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          {/* Top Bar Header */}
          <View
            style={[
              styles.modalHeader,
              {
                paddingTop: Math.max(insets.top, Platform.OS === 'ios' ? 44 : 24),
              },
            ]}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.modalTitle} numberOfLines={1}>
                {title || 'Giveaway Photo'}
              </Text>
              <Text style={styles.modalSubtitle}>
                {modalIndex + 1} / {photos.length}
              </Text>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close gallery"
              onPress={() => setModalVisible(false)}
              style={styles.modalCloseBtn}
            >
              <Ionicons name="close" size={22} color="#FFFFFF" />
            </Pressable>
          </View>

          {/* Center Main Photo Viewer */}
          <View style={styles.modalViewerWrap}>
            <GalleryImageItem
              url={photos[modalIndex]!}
              style={styles.modalMainImage}
              resizeMode="contain"
            />
          </View>

          {/* Bottom Thumbnail Strip & Navigation */}
          <View
            style={[
              styles.modalFooter,
              {
                paddingBottom: Math.max(insets.bottom, 20),
              },
            ]}
          >
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.modalThumbList}
            >
              {photos.map((url, idx) => {
                const isCurrent = idx === modalIndex;
                return (
                  <Pressable
                    key={`modal-thumb-${idx}-${url}`}
                    accessibilityRole="button"
                    accessibilityLabel={`Go to photo ${idx + 1}`}
                    onPress={() => setModalIndex(idx)}
                    style={[
                      styles.modalThumbCard,
                      {
                        borderColor: isCurrent ? theme.colors.primary : 'rgba(255,255,255,0.3)',
                        opacity: isCurrent ? 1 : 0.6,
                        borderWidth: isCurrent ? 2.5 : 1,
                      },
                    ]}
                  >
                    <GalleryImageItem
                      url={url}
                      style={styles.modalThumbImage}
                      resizeMode="cover"
                    />
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function GalleryImageItem({
  url,
  style,
  resizeMode = 'cover',
}: {
  url: string;
  style?: StyleProp<ImageStyle>;
  resizeMode?: 'cover' | 'contain';
}) {
  const { uri } = useCachedImage(url);
  const activeUrl = uri || url;

  return (
    <Image
      source={{ uri: activeUrl, cache: 'force-cache' }}
      style={style}
      resizeMode={resizeMode}
      fadeDuration={100}
      accessibilityIgnoresInvertColors
    />
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    gap: 8,
  },
  heroWrap: {
    width: '100%',
    overflow: 'hidden',
    borderWidth: 1,
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  placeholderHero: {
    width: '100%',
    height: 180,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  placeholderText: {
    fontSize: 13,
    fontWeight: '500',
  },
  shopeeCounterBadge: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 12,
  },
  shopeeCounterText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  thumbnailList: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 2,
  },
  thumbCard: {
    width: 62,
    height: 62,
    overflow: 'hidden',
    position: 'relative',
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  coverTag: {
    position: 'absolute',
    top: 2,
    left: 2,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  coverTagText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '800',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: '#0F1110',
    justifyContent: 'space-between',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  modalSubtitle: {
    color: '#A0A09C',
    fontSize: 12,
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalViewerWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
  },
  modalMainImage: {
    width: '100%',
    height: '100%',
  },
  modalFooter: {
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  modalThumbList: {
    gap: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalThumbCard: {
    width: 54,
    height: 54,
    borderRadius: 8,
    overflow: 'hidden',
  },
  modalThumbImage: {
    width: '100%',
    height: '100%',
  },
});
