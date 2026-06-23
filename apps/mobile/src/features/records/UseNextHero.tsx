import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { LocalRecord } from '../../api/records';
import { useTheme } from '../../theme/useTheme';
import { expiryStatus, EXPIRY_STATUS_TOKEN } from './expiryStatus';
import { GroupedRecords } from './groupRecords';

function pickMostUrgent(groups: GroupedRecords): LocalRecord | null {
  return groups.expired[0] ?? groups.today[0] ?? groups.thisWeek[0] ?? groups.later[0] ?? null;
}

function urgencyLabel(status: 'green' | 'amber' | 'red', daysLabel: string): string {
  if (status === 'red') return 'Use now';
  if (status === 'amber') return 'Use soon';
  return 'Plenty of time';
}

export function UseNextHero({ groups }: { groups: GroupedRecords }) {
  const theme = useTheme();
  const router = useRouter();
  const item = pickMostUrgent(groups);

  if (!item) return null;

  const status = expiryStatus(item.expiryDate);
  const statusColor = theme.colors[EXPIRY_STATUS_TOKEN[status]];
  const isUrgent = status === 'red' || status === 'amber';

  return (
    <Pressable
      testID="use-next-hero"
      accessibilityRole="button"
      accessibilityLabel={`Use next: ${item.customName ?? 'item'}, expires ${item.expiryDate}`}
      onPress={() => router.push(`/record/${item.id}`)}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: isUrgent ? theme.colors.hero : theme.colors.bgGlass,
          borderRadius: theme.radii.lg,
          opacity: pressed ? 0.92 : 1,
        },
        isUrgent && {
          shadowColor: statusColor,
          shadowOpacity: 0.25,
          shadowRadius: 20,
          shadowOffset: { width: 0, height: 6 },
          elevation: 4,
        },
      ]}
    >
      <View style={styles.eyebrowRow}>
        <View style={[styles.dot, { backgroundColor: statusColor }]} />
        <Text
          style={[
            styles.eyebrow,
            { color: isUrgent ? 'rgba(255,255,255,0.8)' : theme.colors.textMuted },
          ]}
        >
          USE NEXT
        </Text>
      </View>

      <Text
        style={[
          styles.itemName,
          { color: isUrgent ? '#FFFFFF' : theme.colors.text },
        ]}
        numberOfLines={2}
      >
        {item.customName ?? 'Item'}
      </Text>

      <View style={styles.footer}>
        <Text
          style={[
            styles.expiry,
            { color: isUrgent ? '#FFFFFF' : theme.colors.text },
          ]}
        >
          Expires {item.expiryDate}
        </Text>
        <View
          style={[
            styles.badge,
            { backgroundColor: isUrgent ? 'rgba(255,255,255,0.18)' : statusColor + '20' },
          ]}
        >
          <Text style={[styles.badgeText, { color: isUrgent ? '#FFFFFF' : statusColor }]}>
            {urgencyLabel(status, item.expiryDate)}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 22,
    gap: 10,
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.2,
  },
  itemName: {
    fontSize: 28,
    fontWeight: '600',
    letterSpacing: -0.6,
    lineHeight: 34,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  expiry: {
    fontSize: 14,
    fontWeight: '500',
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
