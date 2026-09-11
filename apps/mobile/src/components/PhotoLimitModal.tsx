import React from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../theme/useTheme';

export interface PhotoLimitModalProps {
  visible: boolean;
  maxPhotos?: number;
  onClose: () => void;
  testID?: string;
}

export function PhotoLimitModal({
  visible,
  maxPhotos = 5,
  onClose,
  testID = 'photo-limit-modal',
}: PhotoLimitModalProps) {
  const theme = useTheme();
  const isDark = theme.scheme === 'dark';

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable
          testID="photo-limit-dismiss-overlay"
          accessibilityRole="button"
          accessibilityLabel="Dismiss photo limit dialog"
          style={styles.dismissOverlay}
          onPress={onClose}
        />

        <View
          testID={testID}
          style={[
            styles.card,
            {
              backgroundColor: theme.colors.bgElevated,
              borderColor: theme.colors.border,
            },
          ]}
        >
          {/* Warning Icon Badge */}
          <View
            style={[
              styles.iconBadge,
              {
                backgroundColor: isDark
                  ? 'rgba(245, 166, 35, 0.18)'
                  : 'rgba(245, 166, 35, 0.12)',
              },
            ]}
          >
            <Ionicons name="images-outline" size={26} color={theme.colors.accent} />
          </View>

          {/* Text Content */}
          <Text style={[styles.title, { color: theme.colors.text }]}>
            Photo Limit Reached
          </Text>
          <Text style={[styles.message, { color: theme.colors.textMuted }]}>
            You can attach up to {maxPhotos} photos per item. Remove an existing photo to add a new one.
          </Text>

          {/* OK Button */}
          <Pressable
            testID="photo-limit-ok-btn"
            accessibilityRole="button"
            accessibilityLabel="Close photo limit notice"
            onPress={onClose}
            style={({ pressed }) => [
              styles.okBtn,
              {
                backgroundColor: theme.colors.primary,
                opacity: pressed ? 0.88 : 1,
              },
            ]}
          >
            <Text style={styles.okBtnText}>Got it</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.52)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  dismissOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  card: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 20,
    borderWidth: 1,
    padding: 22,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 8,
  },
  iconBadge: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  okBtn: {
    width: '100%',
    minHeight: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  okBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
