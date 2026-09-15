import React from 'react';
import { Modal, View, Text, Pressable, StyleSheet } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../../theme/useTheme';

interface Props {
  visible: boolean;
  onAllow: () => void;
  onCancel: () => void;
  onAddManually?: () => void;
}

export function PrePromptModal({ visible, onAllow, onCancel, onAddManually }: Props) {
  const theme = useTheme();
  const isDark = theme.scheme === 'dark';

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onCancel}>
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
          style={[
            styles.card,
            {
              backgroundColor: isDark ? theme.colors.bgElevated : '#FAFAF8',
              borderColor: isDark ? 'rgba(75, 174, 138, 0.28)' : theme.colors.border,
              shadowColor: isDark ? '#000' : 'rgba(44, 44, 40, 0.25)',
            },
          ]}
        >
          {/* Top Sage Icon Enclosure */}
          <View
            style={[
              styles.iconCircle,
              {
                backgroundColor: isDark ? 'rgba(75, 174, 138, 0.16)' : '#D6F0E6',
                borderColor: isDark ? 'rgba(75, 174, 138, 0.35)' : 'rgba(75, 174, 138, 0.30)',
              },
            ]}
          >
            <Ionicons
              name="barcode-outline"
              size={30}
              color={isDark ? '#4BAE8A' : '#3A8F6F'}
            />
          </View>

          <Text
            style={[
              styles.title,
              {
                color: theme.colors.text,
              },
            ]}
          >
            Camera access
          </Text>

          <Text
            style={[
              styles.message,
              {
                color: theme.colors.textMuted,
              },
            ]}
          >
            Expyrico needs your camera to scan barcodes and QR codes on your items. We don't store images.
          </Text>

          <View style={styles.actionsContainer}>
            {/* Primary Action */}
            <Pressable
              accessibilityRole="button"
              onPress={onAllow}
              testID="pre-prompt-allow"
              style={({ pressed }) => [
                styles.button,
                {
                  backgroundColor: isDark ? '#4BAE8A' : '#3A8F6F',
                  opacity: pressed ? 0.88 : 1,
                  transform: [{ scale: pressed ? 0.98 : 1 }],
                },
              ]}
            >
              <Text style={styles.primaryButtonText}>Continue</Text>
            </Pressable>

            {/* Secondary: Manual Add if provided */}
            {onAddManually ? (
              <Pressable
                accessibilityRole="button"
                onPress={onAddManually}
                testID="pre-prompt-manual-add"
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

            {/* Cancel */}
            <Pressable
              accessibilityRole="button"
              onPress={onCancel}
              testID="pre-prompt-cancel"
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
                Not now
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
