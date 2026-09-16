import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
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
import { SkeletonBone, SkeletonShimmer } from './skeleton';
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
  onAddPhoto?: () => void;
  onDeletePhoto?: (activeIndex: number) => void;
  isPhotoDeletable?: (index: number) => boolean;
  isProductFallback?: boolean;
  onChangeCover?: (activeIndex: number) => void;
  onSetCover?: (index: number) => void;
  maxPhotos?: number;
  onImageSettled?: (uri: string) => void;
  uploadStatus?: {
    isUploading: boolean;
    progress: number;
    statusText: string;
  };
}
const INITIAL_HERO_WIDTH = Math.min(Dimensions.get('window').width - 32, 540);

export function ItemImageGallery({
  photos,
  title,
  placeholderIcon = 'image-outline',
  placeholderText = 'No photos available',
  floatingAction,
  onAddPhoto,
  onDeletePhoto,
  isPhotoDeletable,
  isProductFallback = false,
  onChangeCover,
  onSetCover,
  maxPhotos = 5,
  onImageSettled,
  uploadStatus,
}: ItemImageGalleryProps) {
  const theme = useTheme();
  const heroScrollRef = useRef<ScrollView>(null);

  const [containerWidth, setContainerWidth] = useState(INITIAL_HERO_WIDTH);
  const [activeIndex, setActiveIndex] = useState(0);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalIndex, setModalIndex] = useState(0);
  const heroHeight = Math.round(containerWidth * 0.75); // 4:3 standard aspect ratio

  // When photos change (e.g. deletion), ensure activeIndex is clamped and immediately
  // scroll the hero carousel to the new active photo so it never stays in blank space.
  useEffect(() => {
    if (photos.length > 0) {
      const nextIndex = Math.min(activeIndex, photos.length - 1);
      if (nextIndex !== activeIndex) {
        setActiveIndex(nextIndex);
      }
      heroScrollRef.current?.scrollTo({
        x: nextIndex * containerWidth,
        animated: false,
      });
    } else {
      setActiveIndex(0);
    }
  }, [photos, containerWidth]);

  const isDeletable = isPhotoDeletable ? isPhotoDeletable(activeIndex) : !isProductFallback;
  const canDeleteActivePhoto = Boolean(onDeletePhoto && isDeletable);
  const canAddMore = Boolean(onAddPhoto && (isProductFallback || photos.length < maxPhotos));
  const handleDeletePress = () => {
    if (!canDeleteActivePhoto || !onDeletePhoto) return;
    onDeletePhoto(activeIndex);
  };

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
                placeholderIcon={placeholderIcon}
                onImageSettled={onImageSettled}
              />
            </Pressable>
          ))}
        </ScrollView>

        {/* Floating Delete Button (deletes active photo with confirmation) */}
        {canDeleteActivePhoto && (
          <Pressable
            testID="gallery-delete-photo"
            accessibilityRole="button"
            accessibilityLabel={`Delete photo ${activeIndex + 1} of ${photos.length}`}
            onPress={handleDeletePress}
            style={styles.deleteBadge}
          >
            <Ionicons name="trash-outline" size={17} color="#FFFFFF" />
          </Pressable>
        )}

        {/* Product Catalog Source Indicator */}
        {!canDeleteActivePhoto && (isProductFallback || (isPhotoDeletable && !isPhotoDeletable(activeIndex))) && (
          <View
            testID="gallery-product-source-badge"
            style={[
              styles.productSourceBadge,
              {
                backgroundColor: theme.colors.bgGlass,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <Ionicons name="cube-outline" size={13} color={theme.colors.textMuted} />
            <Text style={[styles.productSourceText, { color: theme.colors.textMuted }]}>
              Product photo
            </Text>
          </View>
        )}

        {/* Floating Actions Row (Change Cover / Replace, Make Cover, Add Photo) */}
        <View style={styles.floatingActionRow}>
          {onChangeCover ? (
            <Pressable
              testID="gallery-change-cover-btn"
              accessibilityRole="button"
              accessibilityLabel={activeIndex === 0 ? 'Change cover photo' : 'Replace photo'}
              onPress={() => onChangeCover(activeIndex)}
              style={[
                styles.floatingActionBtn,
                {
                  backgroundColor: theme.colors.bgGlass,
                  borderColor: theme.colors.border,
                },
              ]}
            >
              <Ionicons name="camera-outline" size={15} color={theme.colors.text} />
              <Text style={[styles.floatingActionText, { color: theme.colors.text }]}>
                {activeIndex === 0 ? 'Change cover' : 'Replace photo'}
              </Text>
            </Pressable>
          ) : floatingAction ? (
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
          ) : null}

          {onSetCover && activeIndex > 0 && (
            <Pressable
              testID="gallery-set-cover-btn"
              accessibilityRole="button"
              accessibilityLabel="Make this photo the cover"
              onPress={() => onSetCover(activeIndex)}
              style={[
                styles.floatingActionBtn,
                {
                  backgroundColor: theme.colors.bgGlass,
                  borderColor: theme.colors.primary,
                },
              ]}
            >
              <Ionicons name="star-outline" size={15} color={theme.colors.primary} />
              <Text style={[styles.floatingActionText, { color: theme.colors.primary }]}>
                Make cover
              </Text>
            </Pressable>
          )}
        </View>
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
        {/* Upload Progress Bar and Micro Status Overlay */}
        {uploadStatus?.isUploading && (
          <View
            testID="record-photo-upload-overlay"
            style={[
              styles.heroUploadOverlay,
              {
                backgroundColor: 'rgba(0, 0, 0, 0.45)',
              },
            ]}
            pointerEvents="none"
          >
            <View style={styles.uploadBadge}>
              <ActivityIndicator testID="record-photo-upload-spinner" size="small" color="#FFFFFF" />
              <Text style={styles.uploadBadgeText}>{uploadStatus.statusText}</Text>
            </View>
            <View style={styles.progressBarTrack}>
              <View
                testID="record-photo-upload-progress"
                style={[
                  styles.progressBarFill,
                  {
                    width: `${Math.min(100, Math.max(12, Math.round(uploadStatus.progress * 100)))}%`,
                  },
                ]}
              />
            </View>
          </View>
        )}
      </View>

      {/* Thumbnails Row (Tap thumbnail to change active hero photo) */}
      {(photos.length > 1 || canAddMore) && (
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
                {((idx === 0) || (isPhotoDeletable && !isPhotoDeletable(idx))) && (
                  <View
                    testID={(isProductFallback || (isPhotoDeletable && !isPhotoDeletable(idx))) ? 'gallery-product-tag' : 'gallery-cover-tag'}
                    style={[
                      styles.coverTag,
                      {
                        backgroundColor: (isProductFallback || (isPhotoDeletable && !isPhotoDeletable(idx)))
                          ? theme.colors.neutralLight
                          : theme.colors.primary,
                        borderColor: (isProductFallback || (isPhotoDeletable && !isPhotoDeletable(idx))) ? theme.colors.border : undefined,
                        borderWidth: (isProductFallback || (isPhotoDeletable && !isPhotoDeletable(idx))) ? 1 : 0,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.coverTagText,
                        {
                          color: (isProductFallback || (isPhotoDeletable && !isPhotoDeletable(idx)))
                            ? theme.colors.textMuted
                            : '#FFFFFF',
                        },
                      ]}
                    >
                      {(isProductFallback || (isPhotoDeletable && !isPhotoDeletable(idx))) ? 'Product' : 'Cover'}
                    </Text>
                  </View>
                )}
              </Pressable>
            );
          })}
          {/* Add photo dashed card in thumbnails row */}
          {canAddMore && (
            <Pressable
              testID="gallery-thumb-add-btn"
              accessibilityRole="button"
              accessibilityLabel="Add another photo"
              onPress={onAddPhoto}
              style={[
                styles.thumbCard,
                styles.thumbAddCard,
                {
                  borderColor: theme.colors.border,
                  backgroundColor: theme.colors.bgGlass,
                  borderRadius: theme.radii.sm,
                },
              ]}
            >
              <Ionicons name="add" size={20} color={theme.colors.primary} />
              <Text style={[styles.thumbAddText, { color: theme.colors.primary }]}>Add</Text>
            </Pressable>
          )}
        </ScrollView>
      )}

      {/* Fullscreen Photo Gallery Modal with Swipe Down to Dismiss */}
      {modalVisible && (
        <FullScreenImageViewer
          visible={modalVisible}
          photos={photos}
          initialIndex={modalIndex}
          title={title || 'Photo Gallery'}
          onClose={() => setModalVisible(false)}
        />
      )}
    </View>
  );
}

function GalleryImageItem({
  url,
  style,
  resizeMode = 'cover',
  placeholderIcon = 'image-outline',
  onImageSettled,
}: {
  url: string;
  style: StyleProp<ImageStyle>;
  resizeMode?: 'cover' | 'contain';
  placeholderIcon?: keyof typeof Ionicons.glyphMap;
  onImageSettled?: (uri: string) => void;
}) {
  const theme = useTheme();
  const { uri } = useCachedImage(url);
  const renderUri = uri || url;
  const [settledUri, setSettledUri] = useState<string | null>(null);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [renderUri]);

  const isSettled = Boolean(settledUri && settledUri === renderUri);

  useEffect(() => {
    if (isSettled) return;
    const timer = setTimeout(() => {
      setSettledUri(renderUri);
      setHasError(true);
      onImageSettled?.(url);
    }, 8000);
    return () => clearTimeout(timer);
  }, [renderUri, isSettled, url, onImageSettled]);

  return (
    <View style={[style, styles.imageContainer]}>
      {hasError ? (
        <View
          testID="gallery-image-fallback"
          style={[
            StyleSheet.absoluteFillObject,
            styles.fallbackContainer,
            { backgroundColor: theme.colors.neutralLight },
          ]}
        >
          <Ionicons name={placeholderIcon} size={42} color={theme.colors.textMuted} />
          <Text style={[styles.fallbackText, { color: theme.colors.textMuted }]}>
            Unable to load photo
          </Text>
        </View>
      ) : (
        <Image
          source={{ uri: renderUri }}
          style={style}
          resizeMode={resizeMode}
          accessibilityIgnoresInvertColors
          fadeDuration={150}
          onLoadEnd={() => {
            setSettledUri(renderUri);
            onImageSettled?.(url);
          }}
          onError={() => {
            setSettledUri(renderUri);
            setHasError(true);
            onImageSettled?.(url);
          }}
        />
      )}
      {!isSettled && (
        <View
          testID="gallery-image-skeleton"
          style={[
            StyleSheet.absoluteFillObject,
            styles.loadingContainer,
            { backgroundColor: theme.colors.neutralLight },
          ]}
          pointerEvents="none"
        >
          <View
            style={[
              styles.gallerySpinnerBadge,
              { backgroundColor: theme.colors.bgGlass },
            ]}
          >
            <ActivityIndicator size="large" color={theme.colors.primary} />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  gallerySpinnerBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
  placeholderHero: {
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
  deleteBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
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
  floatingActionRow: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    zIndex: 5,
  },
  floatingActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    minHeight: 44,
    borderRadius: 20,
    borderWidth: 1,
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
  thumbAddCard: {
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  thumbAddText: {
    fontSize: 10,
    fontWeight: '700',
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
  imageContainer: {
    overflow: 'hidden',
  },
  hiddenImage: {
    opacity: 0,
  },
  fill: {
    width: '100%',
    height: '100%',
  },
  fallbackContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  heroUploadOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    zIndex: 20,
  },
  uploadBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  uploadBadgeText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  progressBarTrack: {
    width: '60%',
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#4BAE8A',
    borderRadius: 2,
  },
  fallbackText: {
    fontSize: 13,
    fontWeight: '600',
  },
  productSourceBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    zIndex: 10,
  },
  productSourceText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
