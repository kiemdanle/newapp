// apps/mobile/src/features/records/PantryFilterModal.tsx
import { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import type { LocalRecord } from '../../api/records';
import { useTheme } from '../../theme/useTheme';
import type { PantryFilterState } from './pantryFilterTypes';
import { useMyHouseholds } from '../../api/households';
import {
  DEFAULT_TOP_LOCATIONS,
  normalizeLocationTitleCase,
  getLocationIcon,
} from '../../utils/locations';

export interface PantryFilterModalProps {
  visible: boolean;
  onClose: () => void;
  filters: PantryFilterState;
  onApply: (filters: PantryFilterState) => void;
  records: LocalRecord[];
}

export const STANDARD_CATEGORIES = [
  'Produce',
  'Dairy',
  'Bakery',
  'Meat & Seafood',
  'Pantry',
  'Frozen',
  'Beverages',
  'Snacks',
  'Other',
];

export function PantryFilterModal({
  visible,
  onClose,
  filters,
  onApply,
  records,
}: PantryFilterModalProps) {
  const theme = useTheme();

  const [draftFilters, setDraftFilters] = useState<PantryFilterState>(filters);

  const { data: myHh } = useMyHouseholds();
  const householdCount = myHh?.items?.length ?? 0;

  useEffect(() => {
    if (visible) {
      setDraftFilters({
        ...filters,
        householdScope: filters.householdScope ?? 'all',
      });
    }
  }, [visible, filters]);

  const categoryOptions = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const record of records) {
      const category = record.category?.trim();
      if (category) {
        counts[category] = (counts[category] || 0) + 1;
      }
    }

    return Array.from(
      new Set([...Object.keys(counts), ...STANDARD_CATEGORIES]),
      (name) => ({ name, count: counts[name] || 0 }),
    );
  }, [records]);

  const locationOptions = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const record of records) {
      const loc = record.location?.trim();
      if (loc) {
        const titleCased = normalizeLocationTitleCase(loc);
        counts[titleCased] = (counts[titleCased] || 0) + 1;
      }
    }

    const allNames = Array.from(
      new Set([...DEFAULT_TOP_LOCATIONS, 'Pantry', 'Counter', ...Object.keys(counts)]),
    );

    return allNames.map((name) => ({
      name,
      count: counts[name] || 0,
    }));
  }, [records]);

  const handleReset = () => {
    setDraftFilters({
      query: draftFilters.query,
      expiryStatus: 'all',
      category: undefined,
      inStockOnly: false,
      householdScope: 'all',
      store: undefined,
      locations: undefined,
    });
  };

  const handleApply = () => {
    onApply(draftFilters);
    onClose();
  };

  const showHouseholdScope = useMemo(
    () => householdCount > 0 || records.some((record) => record.householdId !== null),
    [householdCount, records],
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalOverlay}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss filter modal backdrop"
          style={styles.backdrop}
          onPress={onClose}
        />
        <View
          testID="pantry-filter-modal"
          style={[
            styles.sheetContainer,
            {
              backgroundColor: theme.colors.bgElevated,
              borderColor: theme.colors.border,
            },
          ]}
        >
          <View style={[styles.sheetHeader, { borderBottomColor: theme.colors.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.sheetTitle, { color: theme.colors.text }]}>
                Filter Pantry
              </Text>
              <Text style={[styles.sheetSubtitle, { color: theme.colors.textMuted }]}>
                Refine items by expiration date, category, and availability.
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close filters"
              onPress={onClose}
              hitSlop={10}
              style={[
                styles.closeBtn,
                {
                  backgroundColor: theme.colors.primaryLight,
                  borderColor: 'rgba(75, 174, 138, 0.35)',
                },
              ]}
            >
              <Ionicons name="close" size={18} color={theme.colors.primaryDark} />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            automaticallyAdjustKeyboardInsets={true}
          >
            {/* EXPIRY STATUS */}
            <View style={styles.section}>
              <View style={styles.categoryHeaderRow}>
                <Ionicons name="time-outline" size={13} color={theme.colors.primaryDark} />
                <Text style={[styles.sectionTitle, { color: theme.colors.primaryDark }]}>
                  EXPIRY STATUS
                </Text>
              </View>
              <View style={styles.pillsRow}>
                {[
                  { id: 'all', label: 'All Items' },
                  { id: 'urgent', label: 'Urgent' },
                  { id: 'expiring_soon', label: 'Expiring Soon' },
                  { id: 'good', label: 'Fresh / Good' },
                  { id: 'expired', label: 'Expired' },
                ].map((item) => {
                  const isSelected = (draftFilters.expiryStatus || 'all') === item.id;
                  let selectedBg = theme.colors.primaryLight;
                  let selectedBorder = theme.colors.primary;
                  let selectedText = theme.colors.primaryDark;

                  if (item.id === 'expired') {
                    selectedBg = 'rgba(224, 68, 42, 0.12)';
                    selectedBorder = theme.colors.danger;
                    selectedText = theme.colors.danger;
                  } else if (item.id === 'urgent' || item.id === 'expiring_soon') {
                    selectedBg = theme.colors.accentLight;
                    selectedBorder = theme.colors.accent;
                    selectedText = theme.colors.primaryDark;
                  }

                  return (
                    <Pressable
                      key={item.id}
                      testID={`pantry-filter-expiry-${item.id}`}
                      accessibilityRole="button"
                      accessibilityLabel={`Filter by ${item.label}`}
                      accessibilityState={{ selected: isSelected }}
                      onPress={() =>
                        setDraftFilters((prev) => ({
                          ...prev,
                          expiryStatus: item.id as PantryFilterState['expiryStatus'],
                        }))
                      }
                      style={({ pressed }) => [
                        styles.choicePill,
                        {
                          backgroundColor: isSelected
                            ? selectedBg
                            : 'rgba(214, 240, 230, 0.45)',
                          borderColor: isSelected
                            ? selectedBorder
                            : 'rgba(75, 174, 138, 0.28)',
                          borderWidth: isSelected ? 2 : 1,
                          opacity: pressed ? 0.82 : 1,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.choiceText,
                          {
                            color: isSelected ? selectedText : theme.colors.text,
                            fontWeight: isSelected ? '800' : '600',
                          },
                        ]}
                      >
                        {item.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* FOOD CATEGORY */}
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <View style={styles.categoryHeaderRow}>
                  <Ionicons name="restaurant-outline" size={13} color={theme.colors.primaryDark} />
                  <Text style={[styles.sectionTitle, { color: theme.colors.primaryDark }]}>
                    FOOD CATEGORY
                  </Text>
                </View>
                {draftFilters.category ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Clear selected category"
                    onPress={() => setDraftFilters((prev) => ({ ...prev, category: undefined }))}
                    hitSlop={6}
                  >
                    <Text style={[styles.clearLink, { color: theme.colors.primaryDark }]}>
                      Clear
                    </Text>
                  </Pressable>
                ) : null}
              </View>
              <View style={styles.chipsWrap}>
                {categoryOptions.map((cat) => {
                  const isSelected =
                    draftFilters.category?.toLowerCase() === cat.name.toLowerCase();
                  return (
                    <Pressable
                      key={cat.name}
                      testID={`pantry-filter-cat-${cat.name.toLowerCase().replace(/\s+/g, '-')}`}
                      accessibilityRole="button"
                      accessibilityLabel={`Filter by category ${cat.name}`}
                      accessibilityState={{ selected: isSelected }}
                      onPress={() =>
                        setDraftFilters((prev) => ({
                          ...prev,
                          category: isSelected ? undefined : cat.name,
                        }))
                      }
                      style={({ pressed }) => [
                        styles.catChip,
                        {
                          backgroundColor: isSelected
                            ? theme.colors.primaryLight
                            : 'rgba(214, 240, 230, 0.45)',
                          borderColor: isSelected
                            ? theme.colors.primary
                            : 'rgba(75, 174, 138, 0.28)',
                          borderWidth: isSelected ? 2 : 1,
                          opacity: pressed ? 0.82 : 1,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.catChipText,
                          {
                            color: isSelected
                              ? theme.colors.primaryDark
                              : theme.colors.text,
                            fontWeight: isSelected ? '800' : '600',
                          },
                        ]}
                      >
                        {cat.name}
                      </Text>
                      {cat.count > 0 ? (
                        <View
                          style={[
                            styles.countBadge,
                            {
                              backgroundColor: isSelected
                                ? theme.colors.primary
                                : 'rgba(75, 174, 138, 0.25)',
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.countBadgeText,
                              {
                                color: isSelected
                                  ? '#FFFFFF'
                                  : theme.colors.primaryDark,
                              },
                            ]}
                          >
                            {cat.count}
                          </Text>
                        </View>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* STORAGE LOCATION (Multi-Select) */}
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <View style={styles.categoryHeaderRow}>
                  <Ionicons name="navigate-outline" size={13} color={theme.colors.primaryDark} />
                  <Text style={[styles.sectionTitle, { color: theme.colors.primaryDark }]}>
                    STORAGE LOCATION
                  </Text>
                </View>
                {draftFilters.locations && draftFilters.locations.length > 0 ? (
                  <Pressable
                    testID="pantry-filter-locations-clear"
                    accessibilityRole="button"
                    accessibilityLabel="Clear storage location filter"
                    onPress={() =>
                      setDraftFilters((prev) => ({ ...prev, locations: undefined }))
                    }
                    hitSlop={6}
                  >
                    <Text style={[styles.clearLink, { color: theme.colors.primaryDark }]}>
                      Clear
                    </Text>
                  </Pressable>
                ) : null}
              </View>
              <View style={styles.chipsWrap}>
                {locationOptions.map((loc) => {
                  const selectedSet = new Set(
                    (draftFilters.locations || []).map((l) => l.toLowerCase()),
                  );
                  const isSelected = selectedSet.has(loc.name.toLowerCase());
                  const iconName = getLocationIcon(loc.name);

                  return (
                    <Pressable
                      key={loc.name}
                      testID={`pantry-filter-loc-${loc.name.toLowerCase().replace(/\s+/g, '-')}`}
                      accessibilityRole="button"
                      accessibilityLabel={`Filter by location ${loc.name}`}
                      accessibilityState={{ selected: isSelected }}
                      onPress={() =>
                        setDraftFilters((prev) => {
                          const current = prev.locations || [];
                          const exists = current.some(
                            (l) => l.toLowerCase() === loc.name.toLowerCase(),
                          );
                          const next = exists
                            ? current.filter(
                                (l) => l.toLowerCase() !== loc.name.toLowerCase(),
                              )
                            : [...current, loc.name];
                          return {
                            ...prev,
                            locations: next.length > 0 ? next : undefined,
                          };
                        })
                      }
                      style={({ pressed }) => [
                        styles.catChip,
                        {
                          backgroundColor: isSelected
                            ? theme.colors.primaryLight
                            : 'rgba(214, 240, 230, 0.45)',
                          borderColor: isSelected
                            ? theme.colors.primary
                            : 'rgba(75, 174, 138, 0.28)',
                          borderWidth: isSelected ? 2 : 1,
                          opacity: pressed ? 0.82 : 1,
                        },
                      ]}
                    >
                      <Ionicons
                        name={iconName}
                        size={14}
                        color={isSelected ? theme.colors.primaryDark : theme.colors.primaryDark}
                      />
                      <Text
                        style={[
                          styles.catChipText,
                          {
                            color: isSelected
                              ? theme.colors.primaryDark
                              : theme.colors.text,
                            fontWeight: isSelected ? '800' : '600',
                          },
                        ]}
                      >
                        {loc.name}
                      </Text>
                      {loc.count > 0 ? (
                        <View
                          style={[
                            styles.countBadge,
                            {
                              backgroundColor: isSelected
                                ? theme.colors.primary
                                : 'rgba(75, 174, 138, 0.25)',
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.countBadgeText,
                              {
                                color: isSelected
                                  ? '#FFFFFF'
                                  : theme.colors.primaryDark,
                              },
                            ]}
                          >
                            {loc.count}
                          </Text>
                        </View>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* AVAILABILITY */}
            <View style={styles.section}>
              <View style={styles.categoryHeaderRow}>
                <Ionicons name="checkbox-outline" size={13} color={theme.colors.primaryDark} />
                <Text style={[styles.sectionTitle, { color: theme.colors.primaryDark }]}>
                  AVAILABILITY
                </Text>
              </View>
              <View
                style={[
                  styles.toggleRow,
                  {
                    backgroundColor: 'rgba(214, 240, 230, 0.25)',
                    borderColor: 'rgba(75, 174, 138, 0.25)',
                  },
                ]}
              >
                <View style={{ flex: 1, marginRight: 12 }}>
                  <Text style={[styles.toggleLabel, { color: theme.colors.text }]}>
                    In-Stock Items Only
                  </Text>
                  <Text style={[styles.toggleSubcopy, { color: theme.colors.textMuted }]}>
                    Hide items with 0 stock
                  </Text>
                </View>
                <Switch
                  testID="pantry-filter-instock-toggle"
                  accessibilityLabel="Toggle in-stock items only"
                  value={Boolean(draftFilters.inStockOnly)}
                  onValueChange={(val) =>
                    setDraftFilters((prev) => ({ ...prev, inStockOnly: val }))
                  }
                  trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                  thumbColor="#FFFFFF"
                />
              </View>
            </View>

            {/* INVENTORY SCOPE */}
            {showHouseholdScope ? (
              <View style={styles.section}>
                <View style={styles.categoryHeaderRow}>
                  <Ionicons name="people-outline" size={13} color={theme.colors.primaryDark} />
                  <Text style={[styles.sectionTitle, { color: theme.colors.primaryDark }]}>
                    INVENTORY SCOPE
                  </Text>
                </View>
                <View style={styles.pillsRow}>
                  {[
                    { id: 'all', label: 'All Items' },
                    { id: 'personal', label: 'Personal Only' },
                    { id: 'household', label: 'Household Only' },
                  ].map((scope) => {
                    const isSelected = (draftFilters.householdScope || 'all') === scope.id;
                    return (
                      <Pressable
                        key={scope.id}
                        testID={`pantry-filter-scope-${scope.id}`}
                        accessibilityRole="button"
                        accessibilityLabel={`Scope ${scope.label}`}
                        accessibilityState={{ selected: isSelected }}
                        onPress={() =>
                          setDraftFilters((prev) => ({
                            ...prev,
                            householdScope: scope.id as PantryFilterState['householdScope'],
                          }))
                        }
                        style={({ pressed }) => [
                          styles.choicePill,
                          {
                            backgroundColor: isSelected
                              ? theme.colors.primaryLight
                              : 'rgba(214, 240, 230, 0.45)',
                            borderColor: isSelected
                              ? theme.colors.primary
                              : 'rgba(75, 174, 138, 0.28)',
                            borderWidth: isSelected ? 2 : 1,
                            opacity: pressed ? 0.82 : 1,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.choiceText,
                            {
                              color: isSelected
                                ? theme.colors.primaryDark
                                : theme.colors.text,
                              fontWeight: isSelected ? '800' : '600',
                            },
                          ]}
                        >
                          {scope.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : null}
          </ScrollView>

          {/* Footer Actions */}
          <View style={[styles.footer, { borderTopColor: theme.colors.border }]}>
            <Pressable
              testID="pantry-filter-reset-btn"
              accessibilityRole="button"
              accessibilityLabel="Reset all filters"
              onPress={handleReset}
              style={({ pressed }) => [
                styles.resetBtn,
                {
                  borderColor: theme.colors.border,
                  backgroundColor: theme.colors.bgElevated,
                  opacity: pressed ? 0.82 : 1,
                },
              ]}
            >
              <Text style={[styles.resetText, { color: theme.colors.textMuted }]}>
                Reset
              </Text>
            </Pressable>

            <Pressable
              testID="pantry-filter-apply-btn"
              accessibilityRole="button"
              accessibilityLabel="Apply filters"
              onPress={handleApply}
              style={({ pressed }) => [
                styles.applyBtn,
                {
                  backgroundColor: theme.colors.accent,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <Text style={styles.applyText}>
                Apply
              </Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  backdrop: {
    flex: 1,
  },
  sheetContainer: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    maxHeight: '85%',
    overflow: 'hidden',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  sheetSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 18,
  },
  section: {
    gap: 8,
  },
  categoryHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  clearLink: {
    fontSize: 12,
    fontWeight: '600',
  },
  pillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  choicePill: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceText: {
    fontSize: 13,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    minHeight: 44,
    gap: 6,
  },
  catChipText: {
    fontSize: 13,
  },
  countBadge: {
    marginLeft: 2,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  countBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderRadius: 14,
  },
  toggleLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  toggleSubcopy: {
    fontSize: 12,
    marginTop: 2,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
  },
  resetBtn: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderRadius: 10,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetText: {
    fontSize: 14,
    fontWeight: '600',
  },
  applyBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
