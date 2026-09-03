import React, { useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  Image,
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ImageStyle,
  type StyleProp,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../theme/useTheme';
import { useCachedImage } from '../cache/useCachedImage';
import { FullScreenImageViewer } from './FullScreenImageViewer';

export interface ItemImageGalleryProps {
  photos: string[];
  title?: string;
  placeholderIcon?: keyof typeof Ionicons.glyphMap;
  placeholderText?: string;
  floatingAction?: {
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    onPress: () => void;
    accessibilityLabel: string;
  };
}

const INITIAL_HERO_WIDTH = Math.min(Dimensions.get('window').width - 32, 540);

export function ItemImageGallery({
  photos,
  title,
  placeholderIcon = 'image-outline',
  placeholderText = 'No photos available',
  floatingAction,
}: ItemImageGalleryProps) {
  const theme = useTheme();
  const heroScrollRef = useRef<ScrollView>(null);

  const [containerWidth, setContainerWidth] = useState(INITIAL_HERO_WIDTH);
  const [activeIndex, setActiveIndex] = useState(0);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalIndex, setModalIndex] = useState(0);
  const heroHeight = Math.round(containerWidth * 0.75); // 4:3 standard aspect ratio

  // Clamp activeIndex if photos array changes
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
            borderRadius: theme.radii.lg,
          },
        ]}
      >
        <Ionicons name={placeholderIcon} size={48} color={theme.colors.primary} />
        <Text style={[styles.placeholderText, { color: theme.colors.textMuted }]}>
          {placeholderText}
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
    if (containerWidth > 0) {
      const index = Math.round(offsetX / containerWidth);
      if (index >= 0 && index < photos.length && index !== activeIndex) {
        setActiveIndex(index);
      }
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
      {/* Main Hero Image Carousel */}
      <View
        style={[
          styles.heroWrapper,
          {
            height: heroHeight,
            borderRadius: theme.radii.lg,
            borderColor: theme.colors.border,
            backgroundColor: theme.colors.bgElevated,
          },
        ]}
        onLayout={handleLayout}
      >
        <ScrollView
          testID="giveaway-hero-carousel"
          ref={heroScrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={handleHeroScroll}
          onMomentumScrollEnd={handleHeroScroll}
          scrollEventThrottle={16}
          contentContainerStyle={styles.heroScrollContent}
        >
          {photos.map((url, idx) => (
            <Pressable
              key={`hero-${idx}-${url}`}
              testID={`giveaway-hero-image-${idx}`}
              accessibilityRole="button"
              accessibilityLabel={`View photo ${idx + 1} of ${photos.length} full screen`}
              onPress={() => handleOpenFullscreen(idx)}
              style={[styles.heroSlide, { width: containerWidth, height: heroHeight }]}
            >
              <GalleryImageItem
                url={url}
                style={styles.heroImage}
                resizeMode="cover"
              />
            </Pressable>
          ))}
        </ScrollView>

        {/* Floating Action (e.g. Change Photo) */}
        {floatingAction && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={floatingAction.accessibilityLabel}
            onPress={floatingAction.onPress}
            style={[
              styles.floatingActionBtn,
              {
                backgroundColor: theme.colors.bgGlass,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <Ionicons name={floatingAction.icon} size={15} color={theme.colors.text} />
            <Text style={[styles.floatingActionText, { color: theme.colors.text }]}>
              {floatingAction.label}
            </Text>
          </Pressable>
        )}

        {/* Expand Fullscreen Hint Button */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Enlarge photo full screen"
          onPress={() => handleOpenFullscreen(activeIndex)}
          style={styles.expandBadge}
        >
          <Ionicons name="expand-outline" size={16} color="#FFFFFF" />
        </Pressable>

        {/* Counter Badge */}
        {photos.length > 1 && (
          <View style={styles.counterBadge}>
            <Text style={styles.counterText}>
              {activeIndex + 1}/{photos.length}
            </Text>
          </View>
        )}
      </View>

      {/* Thumbnails Row (Tap thumbnail to change active hero photo) */}
      {photos.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.thumbnailList}
          style={styles.thumbnailScrollView}
        >
          {photos.map((url, idx) => {
            const isSelected = idx === activeIndex;
            return (
              <Pressable
                key={`thumb-${idx}-${url}`}
                testID={`giveaway-thumb-${idx}`}
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

      {/* Fullscreen Photo Gallery Modal with Swipe Down to Dismiss */}
      <FullScreenImageViewer
        visible={modalVisible}
        photos={photos}
        initialIndex={modalIndex}
        title={title || 'Photo Gallery'}
        onClose={() => setModalVisible(false)}
      />
    </View>
  );
}

function GalleryImageItem({
  url,
  style,
  resizeMode = 'cover',
}: {
  url: string;
  style: StyleProp<ImageStyle>;
  resizeMode?: 'cover' | 'contain';
}) {
  const { uri } = useCachedImage(url);
  const sourceUri = uri || url;

  return (
    <Image
      source={{ uri: sourceUri }}
      style={style}
      resizeMode={resizeMode}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  placeholderHero: {
    width: '100%',
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    gap: 8,
  },
  placeholderText: {
    fontSize: 14,
    fontWeight: '500',
  },
  heroWrapper: {
    width: '100%',
    overflow: 'hidden',
    borderWidth: 1,
    position: 'relative',
  },
  heroScrollContent: {
    alignItems: 'center',
  },
  heroSlide: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  expandBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
    width: 36,
    height: 36,
    minHeight: 44,
    minWidth: 44,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 5,
  },
  floatingActionBtn: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    minHeight: 44,
    borderRadius: 20,
    borderWidth: 1,
    zIndex: 5,
  },
  floatingActionText: {
    fontSize: 12,
    fontWeight: '600',
  },
  counterBadge: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    zIndex: 5,
  },
  counterText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  thumbnailScrollView: {
    marginTop: 10,
  },
  thumbnailList: {
    gap: 8,
    paddingHorizontal: 2,
  },
  thumbCard: {
    width: 64,
    height: 64,
    minHeight: 44,
    minWidth: 44,
    overflow: 'hidden',
    position: 'relative',
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  coverTag: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingVertical: 1,
    alignItems: 'center',
  },
  coverTagText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
});
