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
import { filterAndSortRecords } from './filterAndSortRecords';
import type { PantryFilterState } from './pantryFilterTypes';
import { useMyHouseholds } from '../../api/households';

export interface PantryFilterModalProps {
  visible: boolean;
  onClose: () => void;
  filters: PantryFilterState;
  onApply: (filters: PantryFilterState) => void;
  records: LocalRecord[];
  productNameLookup?: Record<string, string>;
}

const STANDARD_CATEGORIES = [
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
  productNameLookup,
}: PantryFilterModalProps) {
  const theme = useTheme();

  const [draftFilters, setDraftFilters] = useState<PantryFilterState>(filters);

  const { data: myHh } = useMyHouseholds();
  const householdCount = myHh?.items.length ?? 0;

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

  const matchingCount = useMemo(
    () => filterAndSortRecords(records, draftFilters, 'expiry_asc', productNameLookup).length,
    [records, draftFilters, productNameLookup],
  );

  const handleReset = () => {
    setDraftFilters({
      query: draftFilters.query,
      expiryStatus: 'all',
      category: undefined,
      inStockOnly: false,
      householdScope: 'all',
      store: undefined,
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
              backgroundColor: theme.colors.bg,
              borderTopLeftRadius: theme.radii.lg,
              borderTopRightRadius: theme.radii.lg,
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
              style={[styles.closeBtn, { backgroundColor: theme.colors.bgElevated }]}
            >
              <Ionicons name="close" size={20} color={theme.colors.text} />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.colors.textMuted }]}>
                EXPIRY STATUS
              </Text>
              <View style={styles.pillsRow}>
                {[
                  { id: 'all', label: 'All Items' },
                  { id: 'expiring_soon', label: 'Expiring Soon' },
                  { id: 'good', label: 'Fresh / Good' },
                  { id: 'expired', label: 'Expired' },
                ].map((item) => {
                  const isSelected = (draftFilters.expiryStatus || 'all') === item.id;
                  let selectedBg = theme.colors.primaryLight;
                  let selectedBorder = theme.colors.primary;
                  let selectedText = theme.colors.primaryDark;

                  if (item.id === 'expired') {
                    selectedBg = theme.colors.bgGlass;
                    selectedBorder = theme.colors.danger;
                    selectedText = theme.colors.danger;
                  } else if (item.id === 'expiring_soon') {
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
                      onPress={() =>
                        setDraftFilters((prev) => ({
                          ...prev,
                          expiryStatus: item.id as PantryFilterState['expiryStatus'],
                        }))
                      }
                      style={[
                        styles.choicePill,
                        {
                          backgroundColor: isSelected ? selectedBg : theme.colors.bgElevated,
                          borderColor: isSelected ? selectedBorder : theme.colors.border,
                          borderRadius: theme.radii.md,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.choiceText,
                          {
                            color: isSelected ? selectedText : theme.colors.text,
                            fontWeight: isSelected ? '700' : '500',
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

            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <Text style={[styles.sectionTitle, { color: theme.colors.textMuted }]}>
                  FOOD CATEGORY
                </Text>
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
                      onPress={() =>
                        setDraftFilters((prev) => ({
                          ...prev,
                          category: isSelected ? undefined : cat.name,
                        }))
                      }
                      style={[
                        styles.catChip,
                        {
                          backgroundColor: isSelected
                            ? theme.colors.primaryLight
                            : theme.colors.bgElevated,
                          borderColor: isSelected
                            ? theme.colors.primary
                            : theme.colors.border,
                          borderRadius: theme.radii.pill,
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
                            fontWeight: isSelected ? '700' : '500',
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
                                : theme.colors.border,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.countBadgeText,
                              {
                                color: isSelected
                                  ? theme.colors.bgElevated
                                  : theme.colors.textMuted,
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

            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.colors.textMuted }]}>
                AVAILABILITY
              </Text>
              <View
                style={[
                  styles.toggleRow,
                  {
                    backgroundColor: theme.colors.bgElevated,
                    borderColor: theme.colors.border,
                    borderRadius: theme.radii.md,
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

            {showHouseholdScope ? (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: theme.colors.textMuted }]}>
                  INVENTORY SCOPE
                </Text>
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
                        onPress={() =>
                          setDraftFilters((prev) => ({
                            ...prev,
                            householdScope: scope.id as PantryFilterState['householdScope'],
                          }))
                        }
                        style={[
                          styles.choicePill,
                          {
                            backgroundColor: isSelected
                              ? theme.colors.primaryLight
                              : theme.colors.bgElevated,
                            borderColor: isSelected
                              ? theme.colors.primary
                              : theme.colors.border,
                            borderRadius: theme.radii.md,
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
                              fontWeight: isSelected ? '700' : '500',
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

          <View style={[styles.footer, { borderTopColor: theme.colors.border }]}>
            <Pressable
              testID="pantry-filter-reset-btn"
              accessibilityRole="button"
              accessibilityLabel="Reset all filters"
              onPress={handleReset}
              style={[
                styles.resetBtn,
                {
                  borderColor: theme.colors.border,
                  borderRadius: theme.radii.md,
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
              accessibilityLabel={`Apply filters, ${matchingCount} matching items`}
              onPress={handleApply}
              style={[
                styles.applyBtn,
                {
                  backgroundColor: theme.colors.accent,
                  borderRadius: theme.radii.md,
                },
              ]}
            >
              <Text style={[styles.applyText, { color: theme.colors.text }]}>
                Apply ({matchingCount} items)
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
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  backdrop: {
    flex: 1,
  },
  sheetContainer: {
    maxHeight: '88%',
    overflow: 'hidden',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  sheetSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 20,
  },
  section: {
    gap: 10,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
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
    borderWidth: 1,
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
    borderWidth: 1,
  },
  catChipText: {
    fontSize: 13,
  },
  countBadge: {
    marginLeft: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
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
    paddingVertical: 16,
    borderTopWidth: 1,
  },
  resetBtn: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderWidth: 1,
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
