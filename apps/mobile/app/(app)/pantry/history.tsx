// apps/mobile/app/(app)/pantry/history.tsx
import React, { useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { AppNavigationProp } from '../../../src/navigation/AppNavigator';
import {
  usePantryHistoryRecords,
  restoreLocalRecord,
  type LocalRecord,
} from '../../../src/api/records';
import { ProductThumbnail } from '../../../src/components/ProductThumbnail';
import { useProduct } from '../../../src/api/products';
import { calculatePantryWasteStats } from '../../../src/utils/waste-metrics';
import { useMyHouseholds } from '../../../src/api/households';
import { useSessionStore } from '../../../src/auth/session-store';
import { formatDate } from '../../../src/utils/country-format';
import { useTheme } from '../../../src/theme/useTheme';
import { ScopeToggle } from '../../../src/features/households/ScopeToggle';
type HistoryFilter = 'all' | 'consumed' | 'discarded';

function HistoryRecordCard({
  record,
  onRestore,
  onPress,
  userCountry,
}: {
  record: LocalRecord;
  onRestore: (record: LocalRecord) => void;
  onPress: () => void;
  userCountry: string | null;
}) {
  const theme = useTheme();
  const { data: product } = useProduct(record.productId ?? undefined);
  const displayName = record.customName || product?.name || 'Pantry Item';
  const category = record.category || product?.category;
  const isConsumed = record.status === 'consumed';

  const actionDate = isConsumed ? record.consumedAt : record.discardedAt;
  const formattedActionDate = actionDate
    ? formatDate(actionDate.slice(0, 10), userCountry)
    : null;

  return (
    <Pressable
      testID={`history-card-${record.id}`}
      accessibilityRole="button"
      accessibilityLabel={`${displayName}, ${isConsumed ? 'used' : 'discarded'}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: theme.colors.bgElevated,
          borderColor: theme.colors.border,
          opacity: pressed ? 0.88 : 1,
        },
      ]}
    >
      <View style={styles.cardMain}>
        <ProductThumbnail
          product={product}
          photoUrl={record.photoUrl}
          size={56}
          fallbackIcon={isConsumed ? 'checkmark-circle-outline' : 'trash-outline'}
          style={styles.thumbnail}
        />

        <View style={styles.cardContent}>
          <View style={styles.titleRow}>
            <Text style={[styles.itemTitle, { color: theme.colors.text }]} numberOfLines={1}>
              {displayName}
            </Text>
          </View>

          <Text style={[styles.itemSubtitle, { color: theme.colors.textMuted }]}>
            {record.quantity} {record.unit}
            {category ? ` · ${category}` : ''}
          </Text>

          {/* Status & Date Badges */}
          <View style={styles.badgeRow}>
            <View
              style={[
                styles.statusBadge,
                {
                  backgroundColor: isConsumed
                    ? 'rgba(75, 174, 138, 0.12)'
                    : 'rgba(245, 166, 35, 0.14)',
                },
              ]}
            >
              <Ionicons
                name={isConsumed ? 'checkmark-circle' : 'trash'}
                size={13}
                color={isConsumed ? '#4BAE8A' : '#F5A623'}
              />
              <Text
                style={[
                  styles.statusBadgeText,
                  { color: isConsumed ? '#3A8F6F' : '#B8740B' },
                ]}
              >
                {isConsumed ? 'Used' : 'Discarded'}
                {formattedActionDate ? ` ${formattedActionDate}` : ''}
              </Text>
            </View>

            {record.discardReason ? (
              <View
                style={[
                  styles.reasonBadge,
                  { backgroundColor: theme.colors.bgGlass, borderColor: theme.colors.border },
                ]}
              >
                <Text style={[styles.reasonBadgeText, { color: theme.colors.textMuted }]}>
                  {record.discardReason.charAt(0).toUpperCase() + record.discardReason.slice(1)}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>

      {/* Restore Button */}
      <View style={styles.cardFooter}>
        <Text style={[styles.expiryMeta, { color: theme.colors.textMuted }]}>
          Exp: {formatDate(record.expiryDate, userCountry)}
        </Text>
        <Pressable
          testID={`history-restore-${record.id}`}
          accessibilityRole="button"
          accessibilityLabel={`Restore ${displayName} to active pantry`}
          onPress={() => onRestore(record)}
          style={({ pressed }) => [
            styles.restoreBtn,
            {
              backgroundColor: pressed ? theme.colors.primaryLight : 'rgba(75, 174, 138, 0.1)',
              borderColor: '#4BAE8A',
              opacity: pressed ? 0.8 : 1,
            },
          ]}
        >
          <Ionicons name="refresh-outline" size={14} color="#3A8F6F" />
          <Text style={styles.restoreBtnText}>Restore to Pantry</Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

export default function PantryHistoryScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<AppNavigationProp>();
  const userCountry = useSessionStore((s) => s.user?.country ?? null);
  const { data: householdsData } = useMyHouseholds();

  const [activeFilter, setActiveFilter] = useState<HistoryFilter>('all');

  // Query all history items for stats and counts
  const allHistoryRecords = usePantryHistoryRecords('all');
  // Query filtered items for list view
  const displayRecords = usePantryHistoryRecords(activeFilter);

  const stats = useMemo(() => {
    const raw = calculatePantryWasteStats(allHistoryRecords);
    return {
      consumed: raw.totalConsumed,
      discarded: raw.totalDiscarded,
      total: raw.totalFinished,
      consumptionRate: raw.consumptionRatePercent,
      wasteRate: raw.wasteRatePercent,
      valueSaved: raw.estimatedValueSaved,
      valueWasted: raw.estimatedValueWasted,
      reasonCounts: raw.reasonCounts,
    };
  }, [allHistoryRecords]);

  const handleRestoreItem = async (record: LocalRecord) => {
    const accessibleHouseholdIds = householdsData?.items?.map((h) => h.id) ?? [];
    const result = await restoreLocalRecord(record.id, accessibleHouseholdIds);
    if (result.wasReassignedToPersonal) {
      Alert.alert(
        'Restored to Personal Pantry',
        'Your previous household is no longer accessible, so this item was restored to your personal pantry.',
        [{ text: 'OK' }],
      );
    }
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <View style={[styles.emptyIconWrap, { backgroundColor: theme.colors.bgGlass }]}>
        <Ionicons name="time-outline" size={32} color={theme.colors.textMuted} />
      </View>
      <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
        {activeFilter === 'consumed'
          ? 'No used items yet'
          : activeFilter === 'discarded'
            ? 'No discarded items yet'
            : 'Pantry history is empty'}
      </Text>
      <Text style={[styles.emptySubtitle, { color: theme.colors.textMuted }]}>
        {activeFilter === 'consumed'
          ? 'Items you mark as used will appear here.'
          : activeFilter === 'discarded'
            ? 'Items you mark as discarded will appear here for future waste tracking.'
            : 'Items you mark as used or discarded will be safely stored here with full restore ability.'}
      </Text>
    </View>
  );

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.bg }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: theme.colors.bgElevated,
            borderBottomColor: theme.colors.border,
            paddingTop: Math.max(insets.top, 12) + 8,
          },
        ]}
      >
        <View style={styles.headerTop}>
          <Pressable
            testID="pantry-history-back-btn"
            accessibilityRole="button"
            accessibilityLabel="Back to pantry"
            onPress={() => navigation.goBack()}
            style={({ pressed }) => [
              styles.backBtn,
              { backgroundColor: theme.colors.bg, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Ionicons name="arrow-back" size={20} color={theme.colors.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
            Pantry History
          </Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.scopeWrap}>
          <ScopeToggle />
        </View>

        {/* Filter Pills */}
        <View style={styles.filterRow}>
          <Pressable
            testID="history-filter-all"
            accessibilityRole="button"
            accessibilityLabel={`All items: ${stats.total}`}
            onPress={() => setActiveFilter('all')}
            style={[
              styles.filterPill,
              {
                backgroundColor:
                  activeFilter === 'all' ? theme.colors.primaryLight : theme.colors.bg,
                borderColor:
                  activeFilter === 'all' ? theme.colors.primary : theme.colors.border,
              },
            ]}
          >
            <Text
              style={[
                styles.filterPillText,
                {
                  color:
                    activeFilter === 'all' ? theme.colors.primaryDark : theme.colors.textMuted,
                  fontWeight: activeFilter === 'all' ? '700' : '500',
                },
              ]}
            >
              All ({stats.total})
            </Text>
          </Pressable>

          <Pressable
            testID="history-filter-used"
            accessibilityRole="button"
            accessibilityLabel={`Used items: ${stats.consumed}`}
            onPress={() => setActiveFilter('consumed')}
            style={[
              styles.filterPill,
              {
                backgroundColor:
                  activeFilter === 'consumed' ? theme.colors.primaryLight : theme.colors.bg,
                borderColor:
                  activeFilter === 'consumed' ? theme.colors.primary : theme.colors.border,
              },
            ]}
          >
            <Text
              style={[
                styles.filterPillText,
                {
                  color:
                    activeFilter === 'consumed'
                      ? theme.colors.primaryDark
                      : theme.colors.textMuted,
                  fontWeight: activeFilter === 'consumed' ? '700' : '500',
                },
              ]}
            >
              Used ({stats.consumed})
            </Text>
          </Pressable>

          <Pressable
            testID="history-filter-discarded"
            accessibilityRole="button"
            accessibilityLabel={`Discarded items: ${stats.discarded}`}
            onPress={() => setActiveFilter('discarded')}
            style={[
              styles.filterPill,
              {
                backgroundColor:
                  activeFilter === 'discarded' ? 'rgba(245, 166, 35, 0.16)' : theme.colors.bg,
                borderColor:
                  activeFilter === 'discarded' ? theme.colors.accent : theme.colors.border,
              },
            ]}
          >
            <Text
              style={[
                styles.filterPillText,
                {
                  color:
                    activeFilter === 'discarded' ? '#B8740B' : theme.colors.textMuted,
                  fontWeight: activeFilter === 'discarded' ? '700' : '500',
                },
              ]}
            >
              Discarded ({stats.discarded})
            </Text>
          </Pressable>
        </View>
      </View>

      {/* KPI Stats Banner */}
      <View style={styles.kpiContainer}>
        <View
          style={[
            styles.kpiCard,
            {
              backgroundColor: 'rgba(75, 174, 138, 0.12)',
              borderColor: 'rgba(75, 174, 138, 0.3)',
            },
          ]}
        >
          <View style={styles.kpiHeader}>
            <Ionicons name="checkmark-done-circle" size={18} color="#3A8F6F" />
            <Text style={[styles.kpiTitle, { color: '#3A8F6F' }]}>Consumed</Text>
          </View>
          <Text style={[styles.kpiValue, { color: '#2C2C28' }]}>
            {stats.consumed} {stats.consumed === 1 ? 'item' : 'items'}
          </Text>
          <Text style={[styles.kpiSub, { color: '#3A8F6F' }]}>
            {stats.consumptionRate}% consumption rate
          </Text>
        </View>

        <View
          style={[
            styles.kpiCard,
            {
              backgroundColor: 'rgba(254, 239, 195, 0.5)',
              borderColor: 'rgba(245, 166, 35, 0.35)',
            },
          ]}
        >
          <View style={styles.kpiHeader}>
            <Ionicons name="trash-bin-outline" size={18} color="#B8740B" />
            <Text style={[styles.kpiTitle, { color: '#B8740B' }]}>Discarded</Text>
          </View>
          <Text style={[styles.kpiValue, { color: '#2C2C28' }]}>
            {stats.discarded} {stats.discarded === 1 ? 'item' : 'items'}
          </Text>
          <Text style={[styles.kpiSub, { color: '#B8740B' }]}>
            {stats.wasteRate}% waste rate
          </Text>
        </View>
      </View>

      {/* History Items List */}
      <FlatList
        data={displayRecords}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <HistoryRecordCard
            record={item}
            onRestore={handleRestoreItem}
            onPress={() => navigation.navigate('Record', { id: item.id })}
            userCountry={userCountry}
          />
        )}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: Math.max(insets.bottom, 24) + 20 },
        ]}
        ListEmptyComponent={renderEmpty}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  scopeWrap: {
    marginBottom: 10,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
  },
  filterPill: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
  },
  filterPillText: {
    fontSize: 13,
  },
  kpiContainer: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  kpiCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
  },
  kpiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  kpiTitle: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  kpiValue: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 2,
  },
  kpiSub: {
    fontSize: 11,
    fontWeight: '600',
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  cardMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  thumbnail: {
    borderRadius: 12,
  },
  cardContent: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  itemSubtitle: {
    fontSize: 13,
    marginBottom: 6,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  reasonBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  reasonBadgeText: {
    fontSize: 11,
    fontWeight: '500',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  expiryMeta: {
    fontSize: 12,
  },
  restoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  restoreBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#3A8F6F',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 6,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    maxWidth: 260,
  },
});
