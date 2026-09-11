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

export interface DeletePhotoConfirmModalProps {
  visible: boolean;
  title?: string;
  message?: string;
  onClose: () => void;
  onConfirmDelete: () => void;
  testID?: string;
}

export function DeletePhotoConfirmModal({
  visible,
  title = 'Delete Photo?',
  message = 'Are you sure you want to remove this photo from this pantry item? This action cannot be undone.',
  onClose,
  onConfirmDelete,
  testID = 'delete-photo-confirm-modal',
}: DeletePhotoConfirmModalProps) {
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
          testID="delete-photo-dismiss-overlay"
          accessibilityRole="button"
          accessibilityLabel="Cancel deletion and close dialog"
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
                  ? 'rgba(224, 68, 42, 0.16)'
                  : 'rgba(224, 68, 42, 0.1)',
              },
            ]}
          >
            <Ionicons name="trash-outline" size={26} color={theme.colors.danger} />
          </View>

          {/* Text Content */}
          <Text style={[styles.title, { color: theme.colors.text }]}>
            {title}
          </Text>
          <Text style={[styles.message, { color: theme.colors.textMuted }]}>
            {message}
          </Text>

          {/* Action Buttons */}
          <View style={styles.buttonRow}>
            <Pressable
              testID="delete-photo-cancel-btn"
              accessibilityRole="button"
              accessibilityLabel="Cancel photo deletion"
              onPress={onClose}
              style={({ pressed }) => [
                styles.cancelBtn,
                {
                  backgroundColor: isDark ? theme.colors.bgGlass : theme.colors.bgElevated,
                  borderColor: theme.colors.border,
                  opacity: pressed ? 0.82 : 1,
                },
              ]}
            >
              <Text style={[styles.cancelBtnText, { color: theme.colors.text }]}>
                Cancel
              </Text>
            </Pressable>

            <Pressable
              testID="delete-photo-confirm-btn"
              accessibilityRole="button"
              accessibilityLabel="Confirm photo deletion"
              onPress={() => {
                onClose();
                onConfirmDelete();
              }}
              style={({ pressed }) => [
                styles.deleteBtn,
                {
                  backgroundColor: theme.colors.danger,
                  opacity: pressed ? 0.88 : 1,
                },
              ]}
            >
              <Ionicons name="trash" size={16} color="#FFFFFF" />
              <Text style={styles.deleteBtnText}>Delete</Text>
            </Pressable>
          </View>
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
    maxWidth: 340,
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
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  cancelBtn: {
    flex: 1,
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  deleteBtn: {
    flex: 1,
    minHeight: 46,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  deleteBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
