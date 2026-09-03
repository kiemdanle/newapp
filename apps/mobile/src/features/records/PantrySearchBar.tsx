// apps/mobile/src/features/records/PantrySearchBar.tsx
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../../theme/useTheme';

export interface PantrySearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  onOpenFilter: () => void;
  activeFilterCount: number;
}

export function PantrySearchBar({
  value,
  onChangeText,
  onOpenFilter,
  activeFilterCount,
}: PantrySearchBarProps) {
  const theme = useTheme();
  const [localText, setLocalText] = useState(value);
  const debounceTimerRef = useRef<NodeJS.Timeout | undefined>(undefined);

  // Synchronize when external reset occurs (e.g. from Clear All chips)
  useEffect(() => {
    setLocalText(value);
  }, [value]);

  const handleChangeText = (text: string) => {
    setLocalText(text);
    clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      onChangeText(text);
    }, 300);
  };

  const handleClear = () => {
    clearTimeout(debounceTimerRef.current);
    setLocalText('');
    onChangeText('');
  };

  useEffect(() => {
    return () => {
      clearTimeout(debounceTimerRef.current);
    };
  }, []);

  const isFilterActive = activeFilterCount > 0;

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.searchBox,
          {
            backgroundColor: theme.colors.bgElevated,
            borderColor: theme.colors.border,
            borderRadius: theme.radii.lg,
          },
        ]}
      >
        <Ionicons
          name="search-outline"
          size={18}
          color={theme.colors.textMuted}
          style={styles.searchIcon}
        />
        <TextInput
          testID="pantry-search-input"
          accessibilityRole="search"
          accessibilityLabel="Search pantry items"
          placeholder="Search name, brand, category, notes…"
          placeholderTextColor={theme.colors.textMuted}
          value={localText}
          onChangeText={handleChangeText}
          returnKeyType="search"
          autoCapitalize="none"
          autoCorrect={false}
          style={[styles.input, { color: theme.colors.text }]}
        />
        {localText.length > 0 ? (
          <Pressable
            testID="pantry-search-clear-btn"
            accessibilityRole="button"
            accessibilityLabel="Clear search"
            onPress={handleClear}
            hitSlop={12}
            style={styles.clearBtn}
          >
            <Ionicons name="close-circle" size={18} color={theme.colors.textMuted} />
          </Pressable>
        ) : null}
      </View>

      <Pressable
        testID="pantry-filter-toggle-btn"
        accessibilityRole="button"
        accessibilityLabel={
          isFilterActive
            ? `Open filters, ${activeFilterCount} active filters`
            : 'Open filters'
        }
        onPress={onOpenFilter}
        style={[
          styles.filterBtn,
          {
            backgroundColor: isFilterActive ? theme.colors.primaryLight : theme.colors.bgElevated,
            borderColor: isFilterActive ? theme.colors.primary : theme.colors.border,
            borderRadius: theme.radii.lg,
          },
        ]}
      >
        <Ionicons
          name="options-outline"
          size={20}
          color={isFilterActive ? theme.colors.primaryDark : theme.colors.text}
        />
        {isFilterActive ? (
          <View
            testID="pantry-filter-badge"
            style={[styles.badge, { backgroundColor: theme.colors.accent }]}
          >
            <Text style={[styles.badgeText, { color: theme.colors.text }]}>
              {activeFilterCount}
            </Text>
          </View>
        ) : null}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    borderWidth: 1,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 0,
  },
  clearBtn: {
    padding: 4,
  },
  filterBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
});
