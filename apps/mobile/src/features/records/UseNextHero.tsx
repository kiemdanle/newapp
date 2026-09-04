import React, { useMemo } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import type { AppNavigationProp } from '../../navigation/AppNavigator';
import { useActiveRecords, type LocalRecord } from '../../api/records';
import { useProduct } from '../../api/products';
import { useMyHouseholds } from '../../api/households';
import { useTheme } from '../../theme/useTheme';
import { expiryStatus, EXPIRY_STATUS_TOKEN } from './expiryStatus';
import { ProductThumbnail } from '../../components/ProductThumbnail';
import { groupRecords, type GroupedRecords } from './groupRecords';
function pickMostUrgent(groups: GroupedRecords): LocalRecord | null {
  return groups.expired[0] ?? groups.today[0] ?? groups.thisWeek[0] ?? groups.later[0] ?? null;
}

function urgencyLabel(status: 'green' | 'amber' | 'red'): string {
  if (status === 'red') return 'Use now';
  if (status === 'amber') return 'Use soon';
  return 'Plenty of time';
}

export function UseNextHero({ groups: propGroups }: { groups?: GroupedRecords }) {
  const theme = useTheme();
  const navigation = useNavigation<AppNavigationProp>();
  const activeRecords = useActiveRecords();
  const groups = useMemo(() => propGroups ?? groupRecords(activeRecords), [propGroups, activeRecords]);
  const item = pickMostUrgent(groups);
  const { data: product } = useProduct(item?.productId ?? undefined);
  const { data: myHouseholdsData } = useMyHouseholds();
  if (!item) return null;
  const householdName = item.householdId
    ? myHouseholdsData?.items?.find((h) => h.id === item.householdId)?.name ?? 'Shared'
    : null;

  const displayName = item.customName || product?.name || 'Item';
  const brand = product?.brand;
  const imageUrl = item.photoUrl || product?.imageUrl || (product?.photos && (product.photos[0]?.displayUrl || product.photos[0]?.thumbnailUrl)) || null;

  const status = expiryStatus(item.expiryDate);
  const statusColor = theme.colors[EXPIRY_STATUS_TOKEN[status]];
  const isUrgent = status === 'red' || status === 'amber';
  const urgentBg = status === 'red' ? theme.colors.danger + '14' : theme.colors.warning + '24';
  return (
    <Pressable
      testID="use-next-hero"
      accessibilityRole="button"
      accessibilityLabel={`Use next: ${displayName}, expires ${item.expiryDate}`}
      onPress={() => navigation.navigate('Record', { id: item.id })}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: isUrgent ? urgentBg : theme.colors.bgGlass,
          borderColor: isUrgent ? statusColor : theme.colors.border,
          borderRadius: theme.radii.lg,
          borderWidth: 1,
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
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
          <View style={[styles.dot, { backgroundColor: statusColor }]} />
          <Text
            style={[
              styles.eyebrow,
              { color: isUrgent ? statusColor : theme.colors.textMuted },
            ]}
          >
            USE NEXT
          </Text>
        </View>
        {householdName ? (
          <View
            testID="use-next-household-badge"
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 3,
              backgroundColor: 'rgba(75, 174, 138, 0.16)',
              borderColor: 'rgba(75, 174, 138, 0.45)',
              borderWidth: 1,
              paddingHorizontal: 7,
              paddingVertical: 2,
              borderRadius: theme.radii.pill,
            }}
          >
            <Ionicons name="people" size={11} color="#4BAE8A" />
            <Text style={{ color: '#4BAE8A', fontSize: 11, fontWeight: '700' }}>
              {householdName}
            </Text>
          </View>
        ) : (
          <View
            testID="use-next-personal-badge"
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 3,
              backgroundColor: theme.colors.bgGlass,
              borderColor: theme.colors.border,
              borderWidth: 1,
              paddingHorizontal: 7,
              paddingVertical: 2,
              borderRadius: theme.radii.pill,
            }}
          >
            <Ionicons name="person" size={10} color={theme.colors.textMuted} />
            <Text style={{ color: theme.colors.textMuted, fontSize: 11, fontWeight: '600' }}>
              Personal
            </Text>
          </View>
        )}
      </View>

      {brand ? (
        <Text style={{ color: theme.colors.textMuted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 2 }}>
          {brand}
        </Text>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <ProductThumbnail
          product={product}
          photoUrl={item.photoUrl}
          size={44}
          style={{ width: 44, height: 44, borderRadius: theme.radii.sm }}
        />
        <Text
          style={[
            styles.itemName,
            { color: theme.colors.text, flex: 1 },
          ]}
          numberOfLines={2}
        >
          {displayName}
        </Text>
      </View>

      <View style={styles.footer}>
        <Text
          style={[
            styles.expiry,
            { color: theme.colors.text },
          ]}
        >
          Expires {item.expiryDate}
        </Text>
        <View
          style={[
            styles.badge,
            { backgroundColor: theme.colors.bg },
          ]}
        >
          <Text style={[styles.badgeText, { color: statusColor }]}>
            {urgencyLabel(status)}
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
