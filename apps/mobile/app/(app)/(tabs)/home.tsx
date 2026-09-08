import React, { useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, Text, View, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { AppNavigationProp } from '../../../src/navigation/AppNavigator';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Screen } from '../../../src/components/Screen';
import { RecordList } from '../../../src/features/records/RecordList';
import { UseNextHero } from '../../../src/features/records/UseNextHero';
import { ScopeToggle } from '../../../src/features/households/ScopeToggle';
import { usePantryScope } from '../../../src/store/pantryScope';
import { useActiveRecords, usePantryHistoryRecords } from '../../../src/api/records';
import { groupRecords } from '../../../src/features/records/groupRecords';
import { useTheme } from '../../../src/theme/useTheme';
import { Logo } from '../../../src/components/Logo';
import { HamburgerButton } from '../../../src/components/HamburgerButton';
import { useSelectionModeStore } from '../../../src/store/selectionModeStore';
import { PantryHistoryView } from '../../../src/features/records/PantryHistoryView';

export default function HomeTab() {
  const theme = useTheme();
  const navigation = useNavigation<AppNavigationProp>();
  const [activeTab, setActiveTab] = useState<'in_stock' | 'history'>('in_stock');
  const [isUrgentActive, setIsUrgentActive] = useState(false);
  const [dayTick, setDayTick] = useState(() => Date.now());
  const { scope, householdId } = usePantryScope();
  const isSelectionMode = useSelectionModeStore((s) => s.isSelectionMode);
  const previousScope = useRef({ scope, householdId });

  useEffect(() => {
    if (
      previousScope.current.scope !== scope ||
      previousScope.current.householdId !== householdId
    ) {
      previousScope.current = { scope, householdId };
      setIsUrgentActive(false);
    }
  }, [scope, householdId]);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        setDayTick(Date.now());
      }
    });
    return () => sub.remove();
  }, []);

  const records = useActiveRecords();
  const allHistoryRecords = usePantryHistoryRecords('all');
  const groups = groupRecords(records, new Date(dayTick));
  const totalUrgent = groups.expired.length + groups.today.length + groups.thisWeek.length;

  useEffect(() => {
    if (totalUrgent === 0 && isUrgentActive) {
      setIsUrgentActive(false);
    }
  }, [totalUrgent, isUrgentActive]);
  const handlePressUrgent = () => {
    if (activeTab === 'history') {
      setActiveTab('in_stock');
      setIsUrgentActive(true);
      return;
    }
    setIsUrgentActive((prev) => !prev);
  };

  const renderHeader = (isFiltered: boolean) => (
    <View style={styles.headerContent}>
      <View style={styles.header}>
        <View style={styles.brandRow}>
          {!isSelectionMode && <HamburgerButton testID="top-nav-menu-button" />}
          <Logo size={28} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.greeting, { color: theme.colors.text }]} numberOfLines={1}>
              Your pantry
            </Text>
            <Text style={[styles.headerSubcopy, { color: theme.colors.textMuted }]} numberOfLines={1}>
              Use what&apos;s expiring first.
            </Text>
          </View>
        </View>
        <View style={styles.headerActions}>
          {totalUrgent > 0 ? (
            <Pressable
              testID="home-urgent-pill"
              accessibilityRole="button"
              accessibilityLabel={`${totalUrgent} urgent ${totalUrgent === 1 ? 'item' : 'items'}. ${
                isUrgentActive ? 'Filter active. Tap to show all items.' : 'Tap to filter urgent items.'
              }`}
              accessibilityState={{ selected: isUrgentActive }}
              hitSlop={8}
              onPress={handlePressUrgent}
              style={({ pressed }) => [
                styles.countPill,
                {
                  backgroundColor: isUrgentActive ? theme.colors.accent : theme.colors.accentLight,
                  borderColor: isUrgentActive ? '#2C2C28' : theme.colors.accent,
                  borderWidth: 1.5,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              {isUrgentActive ? (
                <Ionicons
                  name="funnel"
                  size={11}
                  color="#2C2C28"
                  style={{ marginRight: 4 }}
                />
              ) : null}
              <Text
                style={[
                  styles.countText,
                  { color: isUrgentActive ? '#2C2C28' : theme.colors.primaryDark },
                ]}
                numberOfLines={1}
              >
                {totalUrgent} urgent
              </Text>
            </Pressable>
          ) : null}
          <Pressable
            testID="home-share-pantry-btn"
            accessibilityRole="button"
            accessibilityLabel="Share pantry with family or roommates"
            onPress={() => navigation.navigate('Household')}
            style={({ pressed }) => ({
              width: 44,
              height: 44,
              minHeight: 44,
              borderRadius: theme.radii.pill,
              backgroundColor: pressed ? theme.colors.bgGlass : theme.colors.bgElevated,
              borderWidth: 1,
              borderColor: pressed ? theme.colors.primary : theme.colors.border,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Ionicons name="share-social-outline" size={20} color={theme.colors.primary} />
          </Pressable>
        </View>
      </View>

      {/* Segmented Top Tabs: In Stock vs History */}
      <View style={styles.tabBar}>
        <Pressable
          testID="pantry-tab-in-stock"
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'in_stock' }}
          accessibilityLabel={`In Stock items, ${records.length} items`}
          onPress={() => setActiveTab('in_stock')}
          style={[
            styles.tabItem,
            {
              backgroundColor:
                activeTab === 'in_stock' ? 'rgba(75, 174, 138, 0.14)' : theme.colors.bgElevated,
              borderColor: activeTab === 'in_stock' ? '#4BAE8A' : theme.colors.border,
            },
          ]}
        >
          <Ionicons
            name="cube-outline"
            size={16}
            color={activeTab === 'in_stock' ? '#3A8F6F' : theme.colors.textMuted}
            style={{ marginRight: 6 }}
          />
          <Text
            style={[
              styles.tabText,
              {
                color: activeTab === 'in_stock' ? '#3A8F6F' : theme.colors.textMuted,
                fontWeight: activeTab === 'in_stock' ? '700' : '600',
              },
            ]}
          >
            In Stock ({records.length})
          </Text>
        </Pressable>

        <Pressable
          testID="pantry-tab-history"
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'history' }}
          accessibilityLabel={`Pantry history and discarded items, ${allHistoryRecords.length} items`}
          onPress={() => setActiveTab('history')}
          style={[
            styles.tabItem,
            {
              backgroundColor:
                activeTab === 'history' ? 'rgba(75, 174, 138, 0.14)' : theme.colors.bgElevated,
              borderColor: activeTab === 'history' ? '#4BAE8A' : theme.colors.border,
            },
          ]}
        >
          <Ionicons
            name="time-outline"
            size={16}
            color={activeTab === 'history' ? '#3A8F6F' : theme.colors.textMuted}
            style={{ marginRight: 6 }}
          />
          <Text
            style={[
              styles.tabText,
              {
                color: activeTab === 'history' ? '#3A8F6F' : theme.colors.textMuted,
                fontWeight: activeTab === 'history' ? '700' : '600',
              },
            ]}
          >
            History ({allHistoryRecords.length})
          </Text>
        </Pressable>
      </View>

      <ScopeToggle />
      {activeTab === 'in_stock' && records.length > 0 && !isFiltered ? (
        <UseNextHero groups={groups} />
      ) : null}
    </View>
  );

  const empty = (
    <View style={[styles.emptyCard, { backgroundColor: theme.colors.bgGlass, borderColor: theme.colors.border, borderRadius: theme.radii.lg }]}>
      <View style={[styles.emptyIcon, { backgroundColor: theme.colors.primaryLight, borderRadius: theme.radii.md }]}><Ionicons name="basket-outline" size={28} color={theme.colors.primaryDark} /></View>
      <Text style={[styles.emptyEyebrow, { color: theme.colors.primaryDark }]}>START FRESH</Text>
      <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>Start your pantry</Text>
      <Text style={[styles.emptyBody, { color: theme.colors.textMuted }]}>Scan the first item on your shelf or add produce and fresh goods manually.</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12, justifyContent: 'center' }}>
        <Pressable
          testID="home-empty-scan"
          accessibilityRole="button"
          accessibilityLabel="Scan an item"
          onPress={() => navigation.navigate('Scan')}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            backgroundColor: theme.colors.primary,
            paddingHorizontal: 16,
            paddingVertical: 10,
            borderRadius: theme.radii.pill,
            minHeight: 44,
          }}
        >
          <Ionicons name="scan-outline" size={18} color="#FFFFFF" />
          <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 13 }}>Scan item</Text>
        </Pressable>
        <Pressable
          testID="home-empty-manual-add"
          accessibilityRole="button"
          accessibilityLabel="Manually Input item"
          onPress={() => navigation.navigate('Scan', { initialPhase: 'manual' })}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            backgroundColor: theme.colors.bgElevated,
            borderWidth: 1,
            borderColor: theme.colors.border,
            paddingHorizontal: 16,
            paddingVertical: 10,
            borderRadius: theme.radii.pill,
            minHeight: 44,
          }}
        >
          <Ionicons name="create-outline" size={18} color={theme.colors.primaryDark} />
          <Text style={{ color: theme.colors.primaryDark, fontWeight: '700', fontSize: 13 }}>Manually Input</Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <Screen scroll={false} padded={false}>
        {activeTab === 'in_stock' ? (
          <RecordList
            header={renderHeader}
            empty={empty}
            urgentFilterActive={isUrgentActive}
            onUrgentFilterChange={setIsUrgentActive}
            dayTick={dayTick}
          />
        ) : (
          <PantryHistoryView header={renderHeader} />
        )}
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  headerContent: { gap: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0 },
  brandRow: { alignItems: 'center', flexDirection: 'row', gap: 10, flex: 1, minWidth: 0, marginRight: 8 },
  tabBar: { flexDirection: 'row', gap: 8, marginTop: 2, marginBottom: 2 },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
  },
  tabText: { fontSize: 13 },
  greeting: { fontSize: 20, fontWeight: '700' },
  countPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    minHeight: 32,
  },
  countText: { fontSize: 12, fontWeight: '700' },
  headerSubcopy: { fontSize: 13, marginTop: 2 },
  emptyCard: { alignItems: 'center', borderWidth: 1, gap: 10, padding: 24 },
  emptyIcon: { alignItems: 'center', height: 56, justifyContent: 'center', width: 56 },
  emptyEyebrow: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2, marginTop: 2 },
  emptyTitle: { fontSize: 24, fontWeight: '700' },
  emptyBody: { fontSize: 14, lineHeight: 20, maxWidth: 280, textAlign: 'center' },
});
