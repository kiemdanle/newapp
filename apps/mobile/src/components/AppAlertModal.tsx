import React from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../theme/useTheme';
import {
  useAlertStore,
  type AlertTone,
  type AppAlertButton,
} from '../store/alertStore';
import type { Theme } from '@expyrico/theme';

function getBadgeColors(tone: AlertTone, theme: Theme) {
  const isDark = theme.scheme === 'dark';
  switch (tone) {
    case 'danger':
      return {
        bg: isDark ? 'rgba(224, 68, 42, 0.16)' : 'rgba(224, 68, 42, 0.10)',
        border: isDark ? 'rgba(224, 68, 42, 0.35)' : 'rgba(224, 68, 42, 0.25)',
        iconColor: '#E0442A',
      };
    case 'warning':
      return {
        bg: isDark ? 'rgba(245, 166, 35, 0.16)' : '#FEEFC3', // Soft Butter in light
        border: isDark ? 'rgba(245, 166, 35, 0.35)' : 'rgba(245, 166, 35, 0.30)',
        iconColor: '#F5A623', // Honey
      };
    case 'success':
      return {
        bg: isDark ? 'rgba(75, 174, 138, 0.16)' : '#D6F0E6', // Mint Mist in light
        border: isDark ? 'rgba(75, 174, 138, 0.35)' : 'rgba(75, 174, 138, 0.30)',
        iconColor: '#4BAE8A', // Fresh Sage
      };
    case 'info':
      return {
        bg: isDark ? 'rgba(43, 108, 176, 0.18)' : 'rgba(43, 108, 176, 0.10)', // Marine Slate
        border: isDark ? 'rgba(43, 108, 176, 0.35)' : 'rgba(43, 108, 176, 0.25)',
        iconColor: '#2B6CB0', // Marine Slate
      };
    case 'default':
    default:
      return {
        bg: isDark ? 'rgba(75, 174, 138, 0.16)' : '#D6F0E6',
        border: isDark ? 'rgba(75, 174, 138, 0.35)' : 'rgba(75, 174, 138, 0.30)',
        iconColor: '#4BAE8A',
      };
  }
}

export function AppAlertModal() {
  const theme = useTheme();
  const isDark = theme.scheme === 'dark';
  const { width } = useWindowDimensions();

  const current = useAlertStore((s) => s.current);
  const hide = useAlertStore((s) => s.hide);

  if (!current) {
    return null;
  }

  const { title, message, buttons, options, tone, icon } = current;
  const badgeColors = getBadgeColors(tone, theme);
  const cancelable = options?.cancelable !== false;

  const handleDismiss = () => {
    if (!cancelable) return;
    const cancelBtn = buttons.find((b) => b.style === 'cancel');
    if (cancelBtn) {
      cancelBtn.onPress?.();
    } else {
      options?.onDismiss?.();
    }
    hide();
  };

  const handlePressButton = (btn: AppAlertButton) => {
    hide();
    btn.onPress?.();
  };

  // Determine button layout: horizontal side-by-side if exactly 2 buttons with short labels
  const isHorizontalLayout =
    buttons.length === 2 &&
    (buttons[0]?.text?.length ?? 0) <= 14 &&
    (buttons[1]?.text?.length ?? 0) <= 14;

  const cardMaxWidth = Math.min(width - 48, 360);

  return (
    <Modal
      visible={Boolean(current)}
      transparent
      animationType="fade"
      onRequestClose={handleDismiss}
      testID="app-alert-modal"
    >
      <View style={styles.backdrop}>
        <Pressable
          style={styles.backdropDismiss}
          onPress={handleDismiss}
          accessibilityRole="button"
          accessibilityLabel="Dismiss alert"
        />

        <View
          style={[
            styles.card,
            {
              width: cardMaxWidth,
              backgroundColor: isDark ? theme.colors.bgElevated : '#FAFAF8',
              borderColor: isDark ? 'rgba(75, 174, 138, 0.28)' : theme.colors.border,
              shadowColor: isDark ? '#000' : 'rgba(44, 44, 40, 0.25)',
            },
          ]}
          accessibilityRole="alert"
        >
          {/* Top Status Icon Badge */}
          <View
            style={[
              styles.iconCircle,
              {
                backgroundColor: badgeColors.bg,
                borderColor: badgeColors.border,
              },
            ]}
          >
            <Ionicons name={icon} size={28} color={badgeColors.iconColor} />
          </View>

          {/* Alert Content */}
          <Text
            style={[styles.title, { color: theme.colors.text }]}
            testID="app-alert-title"
          >
            {title}
          </Text>

          {message ? (
            <Text
              style={[styles.message, { color: theme.colors.textMuted }]}
              testID="app-alert-message"
            >
              {message}
            </Text>
          ) : null}

          {/* Action Buttons */}
          <View
            style={[
              styles.actionsContainer,
              isHorizontalLayout ? styles.horizontalActions : styles.verticalActions,
            ]}
          >
            {buttons.map((btn, index) => {
              const isCancel = btn.style === 'cancel';
              const isDestructive = btn.style === 'destructive';

              let bg = isDark ? theme.colors.primary : theme.colors.primaryDark;
              let textColor = '#FFFFFF';
              let border = 'transparent';

              if (isDestructive) {
                bg = '#E0442A'; // Alert Red
                textColor = '#FFFFFF';
              } else if (isCancel) {
                bg = isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(44, 44, 40, 0.05)';
                border = theme.colors.border;
                textColor = theme.colors.text;
              }

              return (
                <Pressable
                  key={index}
                  testID={btn.testID || `app-alert-btn-${index}`}
                  accessibilityRole="button"
                  accessibilityLabel={btn.text || 'OK'}
                  onPress={() => handlePressButton(btn)}
                  style={({ pressed }) => [
                    styles.button,
                    isHorizontalLayout ? styles.horizontalButton : styles.verticalButton,
                    {
                      backgroundColor: bg,
                      borderColor: border,
                      borderWidth: isCancel ? 1 : 0,
                      opacity: pressed ? 0.86 : 1,
                      transform: [{ scale: pressed ? 0.98 : 1 }],
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.buttonText,
                      {
                        color: textColor,
                        fontWeight: isCancel ? '600' : '700',
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {btn.text || 'OK'}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  backdropDismiss: {
    ...StyleSheet.absoluteFillObject,
  },
  card: {
    borderRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 20,
    alignItems: 'center',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 16,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 24,
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 4,
  },
  actionsContainer: {
    width: '100%',
    marginTop: 20,
  },
  horizontalActions: {
    flexDirection: 'row',
    gap: 10,
  },
  verticalActions: {
    flexDirection: 'column',
    gap: 10,
  },
  button: {
    minHeight: 46,
    borderRadius: 9999,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  horizontalButton: {
    flex: 1,
  },
  verticalButton: {
    width: '100%',
  },
  buttonText: {
    fontSize: 14,
  },
});
