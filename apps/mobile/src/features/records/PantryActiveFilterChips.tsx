// apps/mobile/src/features/records/PantryActiveFilterChips.tsx
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../../theme/useTheme';
import type { PantryFilterState } from './pantryFilterTypes';

export interface PantryActiveFilterChipsProps {
  filters: PantryFilterState;
  searchQuery?: string;
  onRemoveFilter: (key: keyof PantryFilterState) => void;
  onClearSearch: () => void;
  onClearAll: () => void;
}

interface ActiveChip {
  id: string;
  label: string;
  onRemove: () => void;
  color?: string;
  bg?: string;
}

export function PantryActiveFilterChips({
  filters,
  searchQuery,
  onRemoveFilter,
  onClearSearch,
  onClearAll,
}: PantryActiveFilterChipsProps) {
  const theme = useTheme();

  const chips: ActiveChip[] = [];

  const trimmedQuery = searchQuery?.trim();
  if (trimmedQuery) {
    chips.push({
      id: 'query',
      label: `"${trimmedQuery}"`,
      onRemove: onClearSearch,
    });
  }

  if (filters.category) {
    chips.push({
      id: 'category',
      label: `Category: ${filters.category}`,
      onRemove: () => onRemoveFilter('category'),
    });
  }

  if (filters.expiryStatus && filters.expiryStatus !== 'all') {
    let label = 'Status: Good';
    let color = theme.colors.primaryDark;
    let bg = theme.colors.primaryLight;

    if (filters.expiryStatus === 'expired') {
      label = 'Status: Expired';
      color = theme.colors.danger;
      bg = theme.colors.bgGlass;
    } else if (filters.expiryStatus === 'expiring_soon') {
      label = 'Status: Expiring soon';
      color = theme.colors.primaryDark;
      bg = theme.colors.accentLight;
    }

    chips.push({
      id: 'expiryStatus',
      label,
      color,
      bg,
      onRemove: () => onRemoveFilter('expiryStatus'),
    });
  }

  if (filters.inStockOnly) {
    chips.push({
      id: 'inStockOnly',
      label: 'In-stock only',
      onRemove: () => onRemoveFilter('inStockOnly'),
    });
  }

  if (filters.householdScope && filters.householdScope !== 'all') {
    chips.push({
      id: 'householdScope',
      label: filters.householdScope === 'household' ? 'Household' : 'Personal',
      onRemove: () => onRemoveFilter('householdScope'),
    });
  }

  if (filters.store) {
    chips.push({
      id: 'store',
      label: `Store: ${filters.store}`,
      onRemove: () => onRemoveFilter('store'),
    });
  }

  if (chips.length === 0) {
    return null;
  }

  return (
    <View style={styles.container} testID="pantry-active-filter-chips">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {chips.map((chip) => (
          <View
            key={chip.id}
            testID={`pantry-active-chip-${chip.id}`}
            style={[
              styles.chip,
              {
                backgroundColor: chip.bg || theme.colors.bgElevated,
                borderColor: chip.color || theme.colors.border,
                borderRadius: theme.radii.sm,
              },
            ]}
          >
            <Text
              style={[
                styles.chipLabel,
                { color: chip.color || theme.colors.text },
              ]}
              numberOfLines={1}
            >
              {chip.label}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Remove filter: ${chip.label}`}
              onPress={chip.onRemove}
              hitSlop={8}
              style={styles.removeBtn}
            >
              <Ionicons
                name="close-circle"
                size={14}
                color={chip.color || theme.colors.textMuted}
              />
            </Pressable>
          </View>
        ))}

        <Pressable
          testID="pantry-clear-all-filters-btn"
          accessibilityRole="button"
          accessibilityLabel="Clear all filters"
          onPress={onClearAll}
          style={styles.clearAllBtn}
        >
          <Text style={[styles.clearAllText, { color: theme.colors.primaryDark }]}>
            Clear all
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
  },
  scrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 2,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
  },
  chipLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginRight: 6,
  },
  removeBtn: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  clearAllBtn: {
    paddingHorizontal: 6,
    paddingVertical: 5,
  },
  clearAllText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
