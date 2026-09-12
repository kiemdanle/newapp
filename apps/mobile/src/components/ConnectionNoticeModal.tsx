import React from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../theme/useTheme';
import { useConnectionStore } from '../store/connectionStore';
import { useConnectionGuardStore } from '../store/connectionGuardStore';

export function ConnectionNoticeModal() {
  const theme = useTheme();
  const isDark = theme.scheme === 'dark';

  const isModalVisible = useConnectionGuardStore((s) => s.isModalVisible);
  const actionName = useConnectionGuardStore((s) => s.actionName);
  const closeModal = useConnectionGuardStore((s) => s.closeModal);
  const executePendingAction = useConnectionGuardStore((s) => s.executePendingAction);

  const status = useConnectionStore((s) => s.status);
  const isRetrying = useConnectionStore((s) => s.isRetrying);
  const retry = useConnectionStore((s) => s.retry);

  const isOffline = status === 'offline';
  const isServerUnreachable = status === 'server_unreachable';

  const title = actionName
    ? `Connection Required for ${actionName}`
    : 'Server Connection Required';

  const description = isOffline
    ? 'This action requires an active server connection to validate and save changes safely. We paused this action to prevent lost data sync.'
    : 'Unable to reach the Expyrico backend server right now. Your local data is safe, but this action needs server validation to proceed.';

  const diagnosticText = isOffline
    ? 'Offline • Check network settings'
    : isServerUnreachable
    ? 'Internet Active • Server Unreachable'
    : 'Checking connection...';

  const diagnosticColor = isOffline
    ? theme.colors.danger
    : isServerUnreachable
    ? theme.colors.warning
    : theme.colors.primary;

  const handleRetry = async () => {
    const result = await retry();
    if (result.status === 'ready') {
      executePendingAction();
    }
  };

  return (
    <Modal
      visible={isModalVisible}
      transparent
      animationType="fade"
      onRequestClose={closeModal}
      testID="connection-notice-modal"
    >
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropDismiss} onPress={closeModal} />
        <View
          style={[
            styles.card,
            {
              backgroundColor: isDark ? theme.colors.bgElevated : '#FFFFFF',
              borderColor: theme.colors.border,
            },
          ]}
        >
          {/* Header Icon */}
          <View
            style={[
              styles.iconCircle,
              {
                backgroundColor: isDark ? 'rgba(75, 174, 138, 0.12)' : 'rgba(75, 174, 138, 0.14)',
                borderColor: isDark ? 'rgba(75, 174, 138, 0.28)' : 'rgba(75, 174, 138, 0.35)',
              },
            ]}
          >
            <Ionicons
              name={isOffline ? 'cloud-offline-outline' : 'server-outline'}
              size={36}
              color={isOffline ? theme.colors.textMuted : theme.colors.primary}
            />
          </View>

          {/* Diagnostic Status Pill */}
          <View
            style={[
              styles.diagnosticPill,
              {
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(44, 44, 40, 0.05)',
                borderColor: theme.colors.border,
              },
            ]}
          >
            <View style={[styles.diagnosticDot, { backgroundColor: diagnosticColor }]} />
            <Text style={[styles.diagnosticText, { color: theme.colors.textMuted }]}>
              {diagnosticText}
            </Text>
          </View>

          {/* Title & Description */}
          <Text style={[styles.title, { color: theme.colors.text }]}>
            {title}
          </Text>
          <Text style={[styles.description, { color: theme.colors.textMuted }]}>
            {description}
          </Text>

          {/* Action Buttons */}
          <View style={styles.actions}>
            <Pressable
              style={({ pressed }) => [
                styles.retryButton,
                {
                  backgroundColor: isDark ? theme.colors.primary : theme.colors.primaryDark,
                  opacity: isRetrying ? 0.7 : pressed ? 0.88 : 1,
                },
              ]}
              onPress={() => void handleRetry()}
              disabled={isRetrying}
              testID="modal-retry-button"
            >
              {isRetrying ? (
                <View style={styles.buttonRow}>
                  <ActivityIndicator color="#FAFAF8" size="small" style={styles.spinner} />
                  <Text style={styles.retryButtonText}>Checking...</Text>
                </View>
              ) : (
                <View style={styles.buttonRow}>
                  <Ionicons name="refresh-outline" size={18} color="#FAFAF8" style={styles.buttonIcon} />
                  <Text style={styles.retryButtonText}>Try Again</Text>
                </View>
              )}
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.cancelButton,
                {
                  borderColor: theme.colors.border,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
              onPress={closeModal}
              testID="modal-dismiss-button"
            >
              <Text style={[styles.cancelButtonText, { color: theme.colors.textMuted }]}>
                Keep Browsing
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
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  backdropDismiss: {
    ...StyleSheet.absoluteFillObject,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 24,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  diagnosticPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    marginBottom: 14,
  },
  diagnosticDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    marginRight: 6,
  },
  diagnosticText: {
    fontSize: 11,
    fontWeight: '600',
  },
  title: {
    fontSize: 19,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 22,
  },
  actions: {
    width: '100%',
    gap: 10,
  },
  retryButton: {
    minHeight: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spinner: {
    marginRight: 6,
  },
  buttonIcon: {
    marginRight: 6,
  },
  retryButtonText: {
    color: '#FAFAF8',
    fontSize: 15,
    fontWeight: '600',
  },
  cancelButton: {
    minHeight: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
});
