import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '@/theme/useTheme';
import type { FeedbackMessage } from '@expyrico/shared';

export function FeedbackMessageBubble({
  message,
  userName,
  isInitial,
}: {
  message: FeedbackMessage;
  userName?: string;
  isInitial?: boolean;
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
        styles.messageRow,
        isAdmin ? styles.adminRow : styles.userRow,
      ]}
    >
      {/* Avatar Node */}
      <View
        style={[
          styles.avatarCircle,
          {
            backgroundColor: isAdmin ? theme.colors.primary : theme.colors.border,
          },
        ]}
      >
        {isAdmin ? (
          <Ionicons name="shield-checkmark" size={16} color="#FFFFFF" />
        ) : (
          <Ionicons name="person" size={16} color={theme.colors.textMuted} />
        )}
      </View>

      {/* Speech Bubble */}
      <View
        style={[
          styles.bubble,
          isAdmin
            ? [
                styles.adminBubble,
                {
                  backgroundColor: theme.colors.bgElevated,
                  borderColor: theme.colors.primary + '35',
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
            <Text
              style={[
                styles.senderName,
                {
                  color: isAdmin ? theme.colors.primaryDark : theme.colors.text,
                  fontWeight: '700',
                },
              ]}
            >
              {isAdmin
                ? 'Support Team'
                : isInitial
                ? 'You (Initial Report)'
                : userName || 'You'}
            </Text>
            {isAdmin && (
              <View
                style={[
                  styles.staffPill,
                  {
                    backgroundColor: theme.colors.primaryLight,
                  },
                ]}
              >
                <Text style={[styles.staffText, { color: theme.colors.primaryDark }]}>
                  Staff
                </Text>
              </View>
            )}
          </View>

          <Text style={[styles.time, { color: theme.colors.textMuted }]}>
            {dateStr} • {timeStr}
          </Text>
        </View>

        <Text style={[styles.body, { color: theme.colors.text }]}>{message.message}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 16,
  },
  adminRow: {
    marginRight: 24,
  },
  userRow: {
    flexDirection: 'row-reverse',
    marginLeft: 24,
  },
  avatarCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  bubble: {
    flex: 1,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 18,
  },
  adminBubble: {
    borderTopLeftRadius: 4,
  },
  userBubble: {
    borderTopRightRadius: 4,
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
    gap: 6,
  },
  senderName: {
    fontSize: 13,
  },
  staffPill: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  staffText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  time: {
    fontSize: 11,
    fontFamily: 'monospace',
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
  },
});
