import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '@/theme/useTheme';
import type { FeedbackMessage } from '@expyrico/shared';

export function FeedbackMessageBubble({
  message,
  userName,
}: {
  message: FeedbackMessage;
  userName?: string;
}) {
  const theme = useTheme();
  const isAdmin = message.senderType === 'admin';

  const timeStr = new Date(message.createdAt).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
  const dateStr = new Date(message.createdAt).toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
  });

  return (
    <View
      testID={`feedback-message-${message.id}`}
      style={[
        styles.bubble,
        isAdmin
          ? [
              styles.adminBubble,
              {
                backgroundColor: theme.colors.primaryLight,
                borderColor: theme.colors.primary,
              },
            ]
          : [
              styles.userBubble,
              {
                backgroundColor: theme.colors.bgElevated,
                borderColor: theme.colors.border,
              },
            ],
      ]}
    >
      <View style={styles.topRow}>
        <View style={styles.senderBadge}>
          {isAdmin ? (
            <>
              <Ionicons name="shield-checkmark" size={13} color={theme.colors.primaryDark} />
              <Text style={[styles.senderName, { color: theme.colors.primaryDark, fontWeight: '700' }]}>
                Support Team
              </Text>
            </>
          ) : (
            <>
              <Ionicons name="person-circle-outline" size={14} color={theme.colors.textMuted} />
              <Text style={[styles.senderName, { color: theme.colors.text }]}>
                {userName || 'You'}
              </Text>
            </>
          )}
        </View>

        <Text style={[styles.time, { color: theme.colors.textMuted }]}>
          {dateStr} • {timeStr}
        </Text>
      </View>

      <Text style={[styles.body, { color: theme.colors.text }]}>{message.message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  adminBubble: {
    marginLeft: 16,
    borderLeftWidth: 4,
  },
  userBubble: {
    marginRight: 16,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  senderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  senderName: {
    fontSize: 12,
  },
  time: {
    fontSize: 10,
    fontFamily: 'monospace',
  },
  body: {
    fontSize: 13,
    lineHeight: 18,
  },
});
