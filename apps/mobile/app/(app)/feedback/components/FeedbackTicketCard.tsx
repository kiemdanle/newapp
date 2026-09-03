import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '@/theme/useTheme';
import type { FeedbackTicket } from '@expyrico/shared';

function statusColors(status: string, theme: ReturnType<typeof useTheme>) {
  switch (status) {
    case 'open':
      return { bg: theme.colors.primaryLight, text: theme.colors.primaryDark, label: 'Open' };
    case 'in_progress':
      return { bg: 'rgba(245, 166, 35, 0.15)', text: '#F5A623', label: 'In Progress' };
    case 'replied':
      return { bg: theme.colors.primaryLight, text: theme.colors.primaryDark, label: 'Replied' };
    case 'resolved':
      return { bg: 'rgba(254, 239, 195, 0.6)', text: '#3A8F6F', label: 'Resolved' };
    case 'closed':
    default:
      return { bg: theme.colors.border, text: theme.colors.textMuted, label: 'Closed' };
  }
}

export function FeedbackTicketCard({
  ticket,
  onPress,
}: {
  ticket: FeedbackTicket;
  onPress: () => void;
}) {
  const theme = useTheme();
  const st = statusColors(ticket.status, theme);

  const iconName: keyof typeof Ionicons.glyphMap =
    ticket.type === 'bug'
      ? 'bug-outline'
      : ticket.type === 'suggestion'
      ? 'bulb-outline'
      : 'chatbubble-ellipses-outline';

  const typeLabel =
    ticket.type === 'bug' ? 'Bug' : ticket.type === 'suggestion' ? 'Idea' : 'Feedback';

  const dateStr = new Date(ticket.createdAt).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });

  return (
    <Pressable
      testID={`feedback-ticket-card-${ticket.id}`}
      accessibilityRole="button"
      accessibilityLabel={`Ticket ${ticket.title}, status ${st.label}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: theme.colors.bgElevated,
          borderColor: theme.colors.border,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      <View style={styles.topRow}>
        <View style={styles.typeBadge}>
          <Ionicons name={iconName} size={13} color={theme.colors.text} />
          <Text style={[styles.typeText, { color: theme.colors.text }]}>{typeLabel}</Text>
        </View>

        <View style={[styles.statusPill, { backgroundColor: st.bg }]}>
          <Text style={[styles.statusText, { color: st.text }]}>{st.label}</Text>
        </View>
      </View>

      <Text style={[styles.title, { color: theme.colors.text }]} numberOfLines={2}>
        {ticket.title}
      </Text>

      <Text style={[styles.description, { color: theme.colors.textMuted }]} numberOfLines={1}>
        {ticket.description}
      </Text>

      <View style={styles.bottomRow}>
        <Text style={[styles.date, { color: theme.colors.textMuted }]}>{dateStr}</Text>
        <View style={styles.chevronWrap}>
          <Text style={[styles.viewLink, { color: theme.colors.primaryDark }]}>View discussion</Text>
          <Ionicons name="chevron-forward" size={14} color={theme.colors.primaryDark} />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  typeText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  statusPill: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
    marginBottom: 4,
  },
  description: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 12,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.06)',
    paddingTop: 8,
  },
  date: {
    fontSize: 11,
    fontFamily: 'monospace',
  },
  chevronWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  viewLink: {
    fontSize: 11,
    fontWeight: '600',
  },
});
