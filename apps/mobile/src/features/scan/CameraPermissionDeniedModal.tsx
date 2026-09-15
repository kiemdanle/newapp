import React from 'react';
import { Modal, View, Text, Pressable, StyleSheet } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../../theme/useTheme';

interface Props {
  onCancel: () => void;
  onOpenSettings: () => void;
  onAddManually?: () => void;
}

export function CameraPermissionDeniedModal({ onCancel, onOpenSettings, onAddManually }: Props) {
  const theme = useTheme();
  const isDark = theme.scheme === 'dark';

  return (
    <Modal transparent visible animationType="fade" onRequestClose={onCancel}>
      <View
        style={[
          styles.backdrop,
          {
            backgroundColor: isDark ? 'rgba(0, 0, 0, 0.75)' : 'rgba(44, 44, 40, 0.40)',
          },
        ]}
      >
        <Pressable
          style={styles.backdropDismiss}
          onPress={onCancel}
          accessibilityRole="button"
          accessibilityLabel="Dismiss modal"
        />

        <View
          testID="camera-permission-denied-modal"
          style={[
            styles.card,
            {
              backgroundColor: isDark ? theme.colors.bgElevated : '#FAFAF8',
              borderColor: isDark ? 'rgba(245, 166, 35, 0.32)' : theme.colors.border,
              shadowColor: isDark ? '#000' : 'rgba(44, 44, 40, 0.25)',
            },
          ]}
        >
          {/* Top Honey/Warning Icon Enclosure */}
          <View
            style={[
              styles.iconCircle,
              {
                backgroundColor: isDark ? 'rgba(245, 166, 35, 0.16)' : '#FEEFC3',
                borderColor: isDark ? 'rgba(245, 166, 35, 0.35)' : 'rgba(245, 166, 35, 0.30)',
              },
            ]}
          >
            <Ionicons name="camera-outline" size={30} color="#F5A623" />
          </View>

          <Text
            style={[
              styles.title,
              {
                color: theme.colors.text,
              },
            ]}
          >
            Camera access is off
          </Text>

          <Text
            style={[
              styles.message,
              {
                color: theme.colors.textMuted,
              },
            ]}
          >
            Allow camera access in your phone settings to scan a barcode or QR code.
          </Text>

          <View style={styles.actionsContainer}>
            {/* Primary Action: Open Settings */}
            <Pressable
              accessibilityRole="button"
              onPress={onOpenSettings}
              testID="camera-permission-denied-open-settings"
              style={({ pressed }) => [
                styles.button,
                {
                  backgroundColor: isDark ? '#4BAE8A' : '#3A8F6F',
                  opacity: pressed ? 0.88 : 1,
                  transform: [{ scale: pressed ? 0.98 : 1 }],
                },
              ]}
            >
              <Text style={styles.primaryButtonText}>Open Settings</Text>
            </Pressable>

            {/* Secondary Action: Manually Input */}
            {onAddManually ? (
              <Pressable
                accessibilityRole="button"
                onPress={onAddManually}
                testID="camera-permission-denied-manual-add"
                style={({ pressed }) => [
                  styles.button,
                  {
                    backgroundColor: isDark ? 'rgba(75, 174, 138, 0.12)' : '#D6F0E6',
                    borderColor: isDark ? 'rgba(75, 174, 138, 0.32)' : 'rgba(75, 174, 138, 0.35)',
                    borderWidth: 1,
                    flexDirection: 'row',
                    gap: 6,
                    opacity: pressed ? 0.86 : 1,
                    transform: [{ scale: pressed ? 0.98 : 1 }],
                  },
                ]}
              >
                <Ionicons
                  name="create-outline"
                  size={16}
                  color={isDark ? '#4BAE8A' : '#3A8F6F'}
                />
                <Text
                  style={[
                    styles.secondaryButtonText,
                    {
                      color: isDark ? '#4BAE8A' : '#3A8F6F',
                    },
                  ]}
                >
                  Manually Input
                </Text>
              </Pressable>
            ) : null}

            {/* Cancel Action */}
            <Pressable
              accessibilityRole="button"
              onPress={onCancel}
              testID="camera-permission-denied-cancel"
              style={({ pressed }) => [
                styles.button,
                {
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(44, 44, 40, 0.05)',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.18)' : theme.colors.border,
                  borderWidth: 1,
                  opacity: pressed ? 0.86 : 1,
                  transform: [{ scale: pressed ? 0.98 : 1 }],
                },
              ]}
            >
              <Text
                style={[
                  styles.cancelButtonText,
                  {
                    color: theme.colors.text,
                  },
                ]}
              >
                Cancel
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  backdropDismiss: {
    ...StyleSheet.absoluteFillObject,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 20,
    alignItems: 'center',
    elevation: 16,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 22,
    paddingHorizontal: 4,
  },
  actionsContainer: {
    width: '100%',
    flexDirection: 'column',
    gap: 10,
  },
  button: {
    width: '100%',
    minHeight: 46,
    borderRadius: 9999,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
