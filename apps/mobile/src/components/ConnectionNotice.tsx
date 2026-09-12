import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../theme/useTheme';
import { useConnectionStore } from '../store/connectionStore';

export interface ConnectionNoticeProps {
  testID?: string;
}

export function ConnectionNotice({ testID = 'connection-notice' }: ConnectionNoticeProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const isDark = theme.scheme === 'dark';

  const status = useConnectionStore((s) => s.status);
  const isRetrying = useConnectionStore((s) => s.isRetrying);
  const retry = useConnectionStore((s) => s.retry);

  const isOffline = status === 'offline';
  const isServerUnreachable = status === 'server_unreachable';

  const title = isOffline
    ? 'No Internet Connection'
    : isServerUnreachable
    ? "Can't Connect to Server"
    : 'Checking Connection...';

  const description = isOffline
    ? 'Please check your Wi-Fi or mobile network settings. Expyrico requires an active connection to keep your pantry, household sharing, and catalog safely in sync.'
    : 'We are unable to reach the Expyrico server right now. Your pantry and household data are safe, and we will reconnect automatically as soon as the service is ready.';

  const diagnosticText = isOffline
    ? 'Offline • Check network settings'
    : isServerUnreachable
    ? 'Internet Active • Server Unreachable'
    : 'Verifying connection...';

  const diagnosticColor = isOffline
    ? theme.colors.danger
    : isServerUnreachable
    ? theme.colors.warning
    : theme.colors.primary;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.bg,
          paddingTop: Math.max(insets.top, 24) + 16,
          paddingBottom: Math.max(insets.bottom, 24) + 16,
        },
      ]}
      testID={testID}
      accessibilityRole="alert"
      accessibilityLiveRegion="assertive"
    >
      <View style={styles.content}>
        {/* Visual Badge Halo */}
        <View
          style={[
            styles.iconHalo,
            {
              backgroundColor: isDark ? 'rgba(75, 174, 138, 0.12)' : 'rgba(75, 174, 138, 0.14)',
              borderColor: isDark ? 'rgba(75, 174, 138, 0.28)' : 'rgba(75, 174, 138, 0.35)',
            },
          ]}
        >
          <View
            style={[
              styles.iconCircle,
              {
                backgroundColor: isDark ? theme.colors.bgElevated : '#FFFFFF',
                borderColor: theme.colors.border,
              },
            ]}
          >
            <Ionicons
              name={isOffline ? 'cloud-offline-outline' : 'server-outline'}
              size={44}
              color={isOffline ? theme.colors.textMuted : theme.colors.primary}
            />
          </View>
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

        {/* Title and Explanation */}
        <Text style={[styles.title, { color: theme.colors.text }]}>
          {title}
        </Text>
        <Text style={[styles.description, { color: theme.colors.textMuted }]}>
          {description}
        </Text>
      </View>

      {/* Action Footer */}
      <View style={styles.footer}>
        <Pressable
          style={({ pressed }) => [
            styles.retryButton,
            {
              backgroundColor: isDark ? theme.colors.primary : theme.colors.primaryDark,
              opacity: isRetrying ? 0.7 : pressed ? 0.88 : 1,
            },
          ]}
          onPress={() => void retry()}
          disabled={isRetrying}
          accessibilityRole="button"
          accessibilityLabel="Retry connection"
          testID="connection-retry-button"
        >
          {isRetrying ? (
            <View style={styles.retryingRow}>
              <ActivityIndicator color="#FAFAF8" size="small" style={styles.spinner} />
              <Text style={styles.retryButtonText}>Checking Connection...</Text>
            </View>
          ) : (
            <View style={styles.retryingRow}>
              <Ionicons name="refresh-outline" size={20} color="#FAFAF8" style={styles.buttonIcon} />
              <Text style={styles.retryButtonText}>Try Again</Text>
            </View>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 99999,
    justifyContent: 'space-between',
    paddingHorizontal: 28,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  iconHalo: {
    width: 108,
    height: 108,
    borderRadius: 54,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  iconCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  diagnosticPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    marginBottom: 20,
  },
  diagnosticDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  diagnosticText: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: -0.4,
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    maxWidth: 340,
  },
  footer: {
    width: '100%',
    paddingBottom: 8,
  },
  retryButton: {
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#4BAE8A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  retryingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spinner: {
    marginRight: 8,
  },
  buttonIcon: {
    marginRight: 8,
  },
  retryButtonText: {
    color: '#FAFAF8',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
