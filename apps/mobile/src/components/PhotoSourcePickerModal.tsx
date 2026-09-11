import React from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../theme/useTheme';

export interface PhotoSourcePickerModalProps {
  visible: boolean;
  title?: string;
  subtitle?: string;
  onClose: () => void;
  onTakePhoto: () => void;
  onChooseGallery: () => void;
  testID?: string;
}

export function PhotoSourcePickerModal({
  visible,
  title = 'Add Item Photo',
  subtitle = 'Choose how you want to add a photo for this item',
  onClose,
  onTakePhoto,
  onChooseGallery,
  testID = 'photo-source-picker-modal',
}: PhotoSourcePickerModalProps) {
  const theme = useTheme();
  const isDark = theme.scheme === 'dark';

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        {/* Full screen dismiss overlay */}
        <Pressable
          testID="photo-source-dismiss-overlay"
          accessibilityRole="button"
          accessibilityLabel="Dismiss photo source selection"
          style={styles.dismissOverlay}
          onPress={onClose}
        />

        {/* Bottom Sheet Container */}
        <View
          testID={testID}
          style={[
            styles.sheetCard,
            {
              backgroundColor: theme.colors.bgElevated,
              borderColor: theme.colors.border,
            },
          ]}
        >
          {/* Top Drag Handle */}
          <View style={styles.handleBar}>
            <View
              style={[
                styles.handlePill,
                { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(44, 44, 40, 0.15)' },
              ]}
            />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <View
              style={[
                styles.headerIconCircle,
                {
                  backgroundColor: isDark
                    ? 'rgba(75, 174, 138, 0.2)'
                    : theme.colors.primaryLight,
                },
              ]}
            >
              <Ionicons
                name="camera"
                size={18}
                color={isDark ? theme.colors.primary : theme.colors.primaryDark}
              />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[styles.title, { color: theme.colors.text }]}>
                {title}
              </Text>
              <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>
                {subtitle}
              </Text>
            </View>
            <Pressable
              testID="photo-source-close-btn"
              accessibilityRole="button"
              accessibilityLabel="Close photo source picker"
              onPress={onClose}
              hitSlop={8}
              style={[
                styles.closeBtn,
                {
                  backgroundColor: isDark ? theme.colors.bgGlass : theme.colors.primaryLight,
                  borderColor: isDark ? theme.colors.border : 'rgba(75, 174, 138, 0.35)',
                },
              ]}
            >
              <Ionicons
                name="close"
                size={18}
                color={isDark ? theme.colors.text : theme.colors.primaryDark}
              />
            </Pressable>
          </View>

          {/* Action Options */}
          <View style={styles.actionsContainer}>
            {/* Take Photo Option */}
            <Pressable
              testID="photo-source-take-photo-btn"
              accessibilityRole="button"
              accessibilityLabel="Take a photo with camera"
              onPress={() => {
                onClose();
                onTakePhoto();
              }}
              style={({ pressed }) => [
                styles.actionCard,
                {
                  backgroundColor: isDark ? theme.colors.bgGlass : '#FFFFFF',
                  borderColor: isDark ? theme.colors.border : 'rgba(44, 44, 40, 0.08)',
                  opacity: pressed ? 0.85 : 1,
                  transform: [{ scale: pressed ? 0.985 : 1 }],
                },
              ]}
            >
              <View
                style={[
                  styles.cardIconBadge,
                  {
                    backgroundColor: isDark
                      ? 'rgba(75, 174, 138, 0.2)'
                      : theme.colors.primaryLight,
                  },
                ]}
              >
                <Ionicons
                  name="camera-outline"
                  size={22}
                  color={isDark ? theme.colors.primary : theme.colors.primaryDark}
                />
              </View>
              <View style={styles.cardTextCol}>
                <Text style={[styles.cardTitle, { color: theme.colors.text }]}>
                  Take Photo
                </Text>
                <Text style={[styles.cardSubtitle, { color: theme.colors.textMuted }]}>
                  Snap a new photo with camera
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={18}
                color={theme.colors.textMuted}
              />
            </Pressable>

            {/* Choose from Gallery Option */}
            <Pressable
              testID="photo-source-gallery-btn"
              accessibilityRole="button"
              accessibilityLabel="Choose photo from photo library"
              onPress={() => {
                onClose();
                onChooseGallery();
              }}
              style={({ pressed }) => [
                styles.actionCard,
                {
                  backgroundColor: isDark ? theme.colors.bgGlass : '#FFFFFF',
                  borderColor: isDark ? theme.colors.border : 'rgba(44, 44, 40, 0.08)',
                  opacity: pressed ? 0.85 : 1,
                  transform: [{ scale: pressed ? 0.985 : 1 }],
                },
              ]}
            >
              <View
                style={[
                  styles.cardIconBadge,
                  {
                    backgroundColor: isDark
                      ? 'rgba(245, 166, 35, 0.15)'
                      : 'rgba(245, 166, 35, 0.12)',
                  },
                ]}
              >
                <Ionicons
                  name="images-outline"
                  size={22}
                  color={theme.colors.accent}
                />
              </View>
              <View style={styles.cardTextCol}>
                <Text style={[styles.cardTitle, { color: theme.colors.text }]}>
                  Choose from Gallery
                </Text>
                <Text style={[styles.cardSubtitle, { color: theme.colors.textMuted }]}>
                  Select from your photo library
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={18}
                color={theme.colors.textMuted}
              />
            </Pressable>
          </View>

          {/* Cancel Button */}
          <Pressable
            testID="photo-source-cancel-btn"
            accessibilityRole="button"
            accessibilityLabel="Cancel photo selection"
            onPress={onClose}
            style={({ pressed }) => [
              styles.cancelButton,
              {
                backgroundColor: isDark ? theme.colors.bgGlass : theme.colors.bgElevated,
                borderColor: theme.colors.border,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <Text style={[styles.cancelButtonText, { color: theme.colors.textMuted }]}>
              Cancel
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  dismissOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  sheetCard: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 38 : 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 8,
  },
  handleBar: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  handlePill: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 18,
    paddingTop: 4,
  },
  headerIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 12,
    lineHeight: 16,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionsContainer: {
    gap: 10,
    marginBottom: 6,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    gap: 14,
    minHeight: 64,
  },
  cardIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTextCol: {
    flex: 1,
    gap: 2,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  cardSubtitle: {
    fontSize: 12,
  },
  cancelButton: {
    marginTop: 12,
    minHeight: 44,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
