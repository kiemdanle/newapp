// apps/mobile/src/features/records/PantryHistoryView.tsx
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
import type { AppNavigationProp } from '../../navigation/AppNavigator';
import {
  usePantryHistoryRecords,
  restoreLocalRecord,
  type LocalRecord,
} from '../../api/records';
import { useMyHouseholds } from '../../api/households';
import { useSessionStore } from '../../auth/session-store';
import { useTheme } from '../../theme/useTheme';
import { calculatePantryWasteStats } from '../../utils/waste-metrics';
import { HistoryRecordCard } from './HistoryRecordCard';
import { ScopeToggle } from '../households/ScopeToggle';

export type HistoryFilter = 'all' | 'consumed' | 'discarded';

export interface PantryHistoryViewProps {
  header?: (isFiltered: boolean) => React.ReactNode;
  showBackHeader?: boolean;
  onBack?: () => void;
}

export function PantryHistoryView({
  header,
  showBackHeader = false,
  onBack,
}: PantryHistoryViewProps) {
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

  const renderHeaderContent = () => (
    <View style={styles.headerStack}>
      {header ? header(activeFilter !== 'all') : null}

      {showBackHeader && (
        <View
          style={[
            styles.standaloneHeader,
            {
              backgroundColor: theme.colors.bgElevated,
              borderBottomColor: theme.colors.border,
              paddingTop: Math.max(insets.top, 12) + 8,
            },
          ]}
        >
          <View style={styles.standaloneHeaderTop}>
            <Pressable
              testID="pantry-history-back-btn"
              accessibilityRole="button"
              accessibilityLabel="Back to pantry"
              onPress={onBack || (() => navigation.goBack())}
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
        </View>
      )}

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
          <Text style={[styles.kpiValue, { color: theme.colors.text }]}>
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
          <Text style={[styles.kpiValue, { color: theme.colors.text }]}>
            {stats.discarded} {stats.discarded === 1 ? 'item' : 'items'}
          </Text>
          <Text style={[styles.kpiSub, { color: '#B8740B' }]}>
            {stats.wasteRate}% waste rate
          </Text>
        </View>
      </View>

      {/* Sub-Filter Pills */}
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
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.bg }]}>
      <FlatList
        data={displayRecords}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <HistoryRecordCard
            record={item}
            onRestore={handleRestoreItem}
            onPress={(id) => navigation.navigate('Record', { id })}
            userCountry={userCountry}
          />
        )}
        ListHeaderComponent={renderHeaderContent}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: Math.max(insets.bottom, 24) + 80 },
        ]}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerStack: {
    gap: 12,
    marginBottom: 8,
  },
  standaloneHeader: {
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    paddingBottom: 12,
    marginHorizontal: -16,
    marginTop: -16,
    marginBottom: 8,
  },
  standaloneHeaderTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  backBtn: {
    width: 44,
    height: 44,
    minHeight: 44,
    borderRadius: 22,
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
    marginBottom: 4,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  filterPill: {
    flex: 1,
    minHeight: 44,
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
    marginTop: 4,
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
