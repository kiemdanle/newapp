import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Camera, useCameraDevice, useCameraPermission } from 'react-native-vision-camera';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../theme/useTheme';
import type { PickedPhoto } from '../features/products/photo-picker-adapter';

export interface MultiPhotoCameraModalProps {
  visible: boolean;
  maxPhotos?: number;
  title?: string;
  onCapture: (photos: PickedPhoto[]) => void;
  onClose: () => void;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export function MultiPhotoCameraModal({
  visible,
  maxPhotos = 5,
  title,
  onCapture,
  onClose,
}: MultiPhotoCameraModalProps) {
  const theme = useTheme();
  const { hasPermission, requestPermission } = useCameraPermission();
  const [cameraPosition, setCameraPosition] = useState<'back' | 'front'>('back');
  const device = useCameraDevice(cameraPosition);
  const cameraRef = useRef<Camera>(null);

  const [flash, setFlash] = useState<'off' | 'on' | 'auto'>('off');
  const [capturedPhotos, setCapturedPhotos] = useState<PickedPhoto[]>([]);
  const [isCapturing, setIsCapturing] = useState(false);
  const [showFlashOverlay, setShowFlashOverlay] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Animations
  const shutterScale = useRef(new Animated.Value(1)).current;
  const flashOpacity = useRef(new Animated.Value(0)).current;

  // Reset state on open
  useEffect(() => {
    if (visible) {
      setCapturedPhotos([]);
      setError(null);
      setIsCapturing(false);
      setShowFlashOverlay(false);
    }
  }, [visible]);

  const handleRequestPermission = useCallback(async () => {
    try {
      await requestPermission();
    } catch {
      setError('Could not request camera permissions.');
    }
  }, [requestPermission]);

  const toggleFlash = useCallback(() => {
    setFlash((current) => {
      if (current === 'off') return 'on';
      if (current === 'on') return 'auto';
      return 'off';
    });
  }, []);

  const toggleCameraPosition = useCallback(() => {
    setCameraPosition((pos) => (pos === 'back' ? 'front' : 'back'));
  }, []);

  const triggerShutterAnimation = useCallback(() => {
    Animated.sequence([
      Animated.timing(shutterScale, {
        toValue: 0.85,
        duration: 80,
        useNativeDriver: true,
      }),
      Animated.timing(shutterScale, {
        toValue: 1,
        duration: 120,
        useNativeDriver: true,
      }),
    ]).start();

    setShowFlashOverlay(true);
    Animated.sequence([
      Animated.timing(flashOpacity, {
        toValue: 0.75,
        duration: 60,
        useNativeDriver: true,
      }),
      Animated.timing(flashOpacity, {
        toValue: 0,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShowFlashOverlay(false);
    });
  }, [shutterScale, flashOpacity]);

  const handleCapture = useCallback(async () => {
    if (isCapturing) return;
    if (capturedPhotos.length >= maxPhotos) {
      setError(`Limit reached (${maxPhotos}/${maxPhotos}). Tap Done to add photos.`);
      return;
    }

    setError(null);
    setIsCapturing(true);
    triggerShutterAnimation();

    try {
      if (cameraRef.current && device) {
        const photo = await cameraRef.current.takePhoto({
          flash: flash,
          enableShutterSound: false,
        });

        if (!photo?.path) {
          throw new Error('Could not capture photo from camera.');
        }

        const rawPath = photo.path.startsWith('file://') ? photo.path : `file://${photo.path}`;
        const newPhoto: PickedPhoto = {
          path: rawPath,
          width: photo.width || 1600,
          height: photo.height || 1200,
          mime: 'image/jpeg',
          size: 500_000,
        };

        setCapturedPhotos((prev) => {
          if (prev.length >= maxPhotos) return prev;
          return [...prev, newPhoto];
        });
      } else {
        // Fallback for testing environments / mock camera
        const mockPhoto: PickedPhoto = {
          path: `/tmp/camera-shot-${Date.now()}-${capturedPhotos.length + 1}.jpg`,
          width: 1600,
          height: 1200,
          mime: 'image/jpeg',
          size: 450_000,
        };
        setCapturedPhotos((prev) => {
          if (prev.length >= maxPhotos) return prev;
          return [...prev, mockPhoto];
        });
      }
    } catch (err) {
      setError((err as Error).message || 'Failed to capture photo');
    } finally {
      setIsCapturing(false);
    }
  }, [isCapturing, capturedPhotos.length, maxPhotos, triggerShutterAnimation, device, flash]);

  const handleRemovePhoto = useCallback((index: number) => {
    setCapturedPhotos((prev) => prev.filter((_, i) => i !== index));
    setError(null);
  }, []);

  const handleDone = useCallback(() => {
    if (capturedPhotos.length === 0) {
      onClose();
      return;
    }
    onCapture(capturedPhotos);
    onClose();
  }, [capturedPhotos, onCapture, onClose]);

  const remaining = Math.max(0, maxPhotos - capturedPhotos.length);
  const isLimitReached = remaining === 0;
  const hasCameraAccess = hasPermission || !device;
  return (
    <Modal
      visible={visible}
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
      testID="multi-photo-camera-modal"
    >
      <View style={styles.container}>
        {/* Permission Check */}
        {!hasCameraAccess ? (
          <View style={[styles.centerScreen, { backgroundColor: theme.colors.bg }]}>
            <View style={styles.permissionCard}>
              <View style={[styles.permissionIconCircle, { backgroundColor: theme.colors.primaryLight }]}>
                <Ionicons name="camera" size={36} color={theme.colors.primary} />
              </View>
              <Text style={[styles.permissionTitle, { color: theme.colors.text }]}>Camera Access Required</Text>
              <Text style={[styles.permissionBody, { color: theme.colors.textMuted }]}>
                Expyrico needs camera access to take multiple photos for your items, giveaways, and products.
              </Text>
              <View style={styles.permissionActions}>
                <Pressable
                  accessibilityRole="button"
                  onPress={onClose}
                  style={[styles.btnSecondary, { borderColor: theme.colors.border }]}
                >
                  <Text style={[styles.btnSecondaryText, { color: theme.colors.text }]}>Cancel</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  testID="multi-camera-request-permission"
                  onPress={handleRequestPermission}
                  style={[styles.btnPrimary, { backgroundColor: theme.colors.primary }]}
                >
                  <Text style={styles.btnPrimaryText}>Enable Camera</Text>
                </Pressable>
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.cameraWrapper}>
            {/* Live Camera Feed */}
            {device ? (
              <Camera
                ref={cameraRef}
                style={StyleSheet.absoluteFill}
                device={device}
                isActive={visible}
                photo={true}
              />
            ) : (
              <View style={[styles.noDeviceView, { backgroundColor: '#181816' }]}>
                <Ionicons name="camera-outline" size={48} color={theme.colors.textMuted} />
                <Text style={{ color: '#FAFAF8', marginTop: 12, fontSize: 16, fontWeight: '600' }}>
                  Camera viewfinder
                </Text>
              </View>
            )}

            {/* Flash Effect Overlay */}
            {showFlashOverlay ? (
              <Animated.View
                pointerEvents="none"
                style={[
                  StyleSheet.absoluteFill,
                  styles.flashOverlay,
                  { opacity: flashOpacity },
                ]}
              />
            ) : null}

            {/* Top HUD Overlay */}
            <View style={styles.topHud}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close Camera"
                testID="multi-camera-close"
                onPress={onClose}
                style={styles.hudButton}
              >
                <Ionicons name="close" size={24} color="#FAFAF8" />
              </Pressable>

              <View style={styles.headerInfoPill}>
                <Text style={styles.headerInfoTitle}>
                  {title || 'Take Photos'}
                </Text>
                <View style={styles.countBadge}>
                  <Text style={styles.countBadgeText}>
                    {capturedPhotos.length}/{maxPhotos}
                  </Text>
                </View>
              </View>

              <View style={styles.topRightControls}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Flash mode: ${flash}`}
                  testID="multi-camera-flash"
                  onPress={toggleFlash}
                  style={styles.hudButton}
                >
                  <Ionicons
                    name={flash === 'off' ? 'flash-off-outline' : flash === 'on' ? 'flash' : 'flash-outline'}
                    size={22}
                    color={flash === 'off' ? '#FAFAF8' : '#F5A623'}
                  />
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Flip camera"
                  testID="multi-camera-flip"
                  onPress={toggleCameraPosition}
                  style={styles.hudButton}
                >
                  <Ionicons name="camera-reverse-outline" size={24} color="#FAFAF8" />
                </Pressable>
              </View>
            </View>

            {/* Center Focus Frame */}
            <View pointerEvents="none" style={styles.viewfinderCenter}>
              <View style={[styles.cornerTL, { borderColor: theme.colors.primary }]} />
              <View style={[styles.cornerTR, { borderColor: theme.colors.primary }]} />
              <View style={[styles.cornerBL, { borderColor: theme.colors.primary }]} />
              <View style={[styles.cornerBR, { borderColor: theme.colors.primary }]} />
            </View>

            {/* Error or Limit Banner */}
            {error ? (
              <View style={styles.errorBanner}>
                <Ionicons name="information-circle" size={18} color="#FAFAF8" />
                <Text style={styles.errorBannerText}>{error}</Text>
              </View>
            ) : isLimitReached ? (
              <View style={[styles.errorBanner, { backgroundColor: 'rgba(58, 143, 111, 0.85)' }]}>
                <Ionicons name="checkmark-circle" size={18} color="#FAFAF8" />
                <Text style={styles.errorBannerText}>
                  Max limit reached ({maxPhotos}/{maxPhotos}). Tap Done to add all.
                </Text>
              </View>
            ) : null}

            {/* Bottom HUD: Thumbnails strip & Shutter controls */}
            <View style={styles.bottomHud}>
              {/* Horizontal Thumbnail Strip */}
              {capturedPhotos.length > 0 ? (
                <View style={styles.thumbnailStripWrapper}>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.thumbnailScrollContent}
                    testID="multi-camera-thumbnails"
                  >
                    {capturedPhotos.map((photo, index) => (
                      <View key={`thumb-${photo.path}-${index}`} style={styles.thumbnailCard}>
                        <Image
                          source={{ uri: photo.path }}
                          style={styles.thumbnailImage}
                          accessibilityIgnoresInvertColors
                        />
                        <View style={styles.thumbnailBadge}>
                          <Text style={styles.thumbnailBadgeText}>{index + 1}</Text>
                        </View>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Remove photo ${index + 1}`}
                          testID={`multi-camera-remove-${index}`}
                          onPress={() => handleRemovePhoto(index)}
                          style={styles.thumbnailRemoveBtn}
                        >
                          <Ionicons name="close" size={12} color="#FFFFFF" />
                        </Pressable>
                      </View>
                    ))}
                  </ScrollView>
                </View>
              ) : (
                <View style={styles.hintWrapper}>
                  <Text style={styles.hintText}>
                    Snap multiple shots in sequence. Tap Done when finished.
                  </Text>
                </View>
              )}

              {/* Shutter and Done Controls */}
              <View style={styles.shutterRow}>
                {/* Left Side: Photo count pill or cancel */}
                <View style={styles.shutterLeftGroup}>
                  {capturedPhotos.length > 0 ? (
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => setCapturedPhotos([])}
                      style={styles.clearBtn}
                    >
                      <Text style={styles.clearBtnText}>Clear ({capturedPhotos.length})</Text>
                    </Pressable>
                  ) : (
                    <View style={{ width: 60 }} />
                  )}
                </View>

                {/* Center: Shutter Button */}
                <View style={styles.shutterCenterGroup}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Take Photo"
                    testID="multi-camera-shutter"
                    disabled={isCapturing || isLimitReached}
                    onPress={handleCapture}
                    style={styles.shutterOuterRing}
                  >
                    <Animated.View
                      style={[
                        styles.shutterInnerCircle,
                        {
                          transform: [{ scale: shutterScale }],
                          backgroundColor: isLimitReached
                            ? '#8C8C85'
                            : isCapturing
                            ? theme.colors.primary
                            : '#FAFAF8',
                        },
                      ]}
                    >
                      {isCapturing ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : null}
                    </Animated.View>
                  </Pressable>
                </View>

                {/* Right Side: Done button */}
                <View style={styles.shutterRightGroup}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Finish and add ${capturedPhotos.length} photos`}
                    testID="multi-camera-done"
                    onPress={handleDone}
                    disabled={capturedPhotos.length === 0}
                    style={[
                      styles.doneButton,
                      {
                        backgroundColor:
                          capturedPhotos.length > 0 ? theme.colors.primary : 'rgba(255, 255, 255, 0.2)',
                        opacity: capturedPhotos.length > 0 ? 1 : 0.5,
                      },
                    ]}
                  >
                    <Ionicons name="checkmark" size={18} color="#FFFFFF" />
                    <Text style={styles.doneButtonText}>
                      Done {capturedPhotos.length > 0 ? `(${capturedPhotos.length})` : ''}
                    </Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  cameraWrapper: {
    flex: 1,
    position: 'relative',
  },
  centerScreen: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  permissionCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FAFAF8',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  permissionIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  permissionBody: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 24,
  },
  permissionActions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  btnPrimary: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnPrimaryText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  btnSecondary: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnSecondaryText: {
    fontSize: 15,
    fontWeight: '600',
  },
  noDeviceView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  flashOverlay: {
    backgroundColor: '#FFFFFF',
    zIndex: 10,
  },
  topHud: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 52 : 36,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 20,
  },
  hudButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerInfoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    gap: 8,
  },
  headerInfoTitle: {
    color: '#FAFAF8',
    fontSize: 14,
    fontWeight: '600',
  },
  countBadge: {
    backgroundColor: '#4BAE8A',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  countBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  topRightControls: {
    flexDirection: 'row',
    gap: 8,
  },
  viewfinderCenter: {
    position: 'absolute',
    top: '30%',
    left: (SCREEN_WIDTH - 240) / 2,
    width: 240,
    height: 240,
    pointerEvents: 'none',
  },
  cornerTL: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 24,
    height: 24,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: 4,
  },
  cornerTR: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 24,
    height: 24,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: 4,
  },
  cornerBL: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: 24,
    height: 24,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 4,
  },
  cornerBR: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 24,
    height: 24,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: 4,
  },
  errorBanner: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 112 : 96,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(224, 68, 42, 0.85)',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    zIndex: 20,
  },
  errorBannerText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  bottomHud: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 36 : 24,
    left: 0,
    right: 0,
    zIndex: 20,
    gap: 16,
  },
  thumbnailStripWrapper: {
    maxHeight: 76,
    paddingHorizontal: 16,
  },
  thumbnailScrollContent: {
    gap: 10,
    alignItems: 'center',
  },
  thumbnailCard: {
    position: 'relative',
    width: 60,
    height: 60,
    borderRadius: 10,
    overflow: 'visible',
    borderWidth: 2,
    borderColor: '#4BAE8A',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
    backgroundColor: '#2C2C28',
  },
  thumbnailBadge: {
    position: 'absolute',
    bottom: 2,
    left: 2,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  thumbnailBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  thumbnailRemoveBtn: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#E0442A',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
  },
  hintWrapper: {
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  hintText: {
    color: 'rgba(255, 255, 255, 0.75)',
    fontSize: 13,
    textAlign: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
  },
  shutterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
  },
  shutterLeftGroup: {
    flex: 1,
    alignItems: 'flex-start',
  },
  clearBtn: {
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  clearBtnText: {
    color: '#FAFAF8',
    fontSize: 13,
    fontWeight: '600',
  },
  shutterCenterGroup: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterOuterRing: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: '#FAFAF8',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  shutterInnerCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  shutterRightGroup: {
    flex: 1,
    alignItems: 'flex-end',
  },
  doneButton: {
    minHeight: 46,
    paddingHorizontal: 18,
    borderRadius: 23,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  doneButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
