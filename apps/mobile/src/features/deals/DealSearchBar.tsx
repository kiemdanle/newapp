// apps/mobile/src/features/deals/DealSearchBar.tsx
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTheme } from '../../theme/useTheme';

interface Props {
  value: string;
  onChangeText: (text: string) => void;
  onOpenFilter: () => void;
  activeFilterCount: number;
}

export function DealSearchBar({
  value,
  onChangeText,
  onOpenFilter,
  activeFilterCount,
}: Props) {
  const theme = useTheme();
  const [localText, setLocalText] = useState(value);

  // Sync external resets
  useEffect(() => {
    setLocalText(value);
  }, [value]);

  // Debounce search query
  useEffect(() => {
    const handler = setTimeout(() => {
      if (localText !== value) {
        onChangeText(localText);
      }
    }, 300);
    return () => clearTimeout(handler);
  }, [localText, value, onChangeText]);

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
        <Text style={[styles.searchIcon, { color: theme.colors.textMuted }]}>🔍</Text>
        <TextInput
          accessibilityLabel="Search deals"
          placeholder="Search products, stores, brands…"
          placeholderTextColor={theme.colors.textMuted}
          value={localText}
          onChangeText={setLocalText}
          returnKeyType="search"
          style={[styles.input, { color: theme.colors.text }]}
        />
        {localText.length > 0 && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear search"
            onPress={() => {
              setLocalText('');
              onChangeText('');
            }}
            hitSlop={8}
            style={styles.clearBtn}
          >
            <Text style={{ color: theme.colors.textMuted, fontSize: 16, fontWeight: '700' }}>✕</Text>
          </Pressable>
        )}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open filters"
        onPress={onOpenFilter}
        style={[
          styles.filterBtn,
          {
            backgroundColor: activeFilterCount > 0 ? theme.colors.primary : theme.colors.bgElevated,
            borderColor: activeFilterCount > 0 ? theme.colors.primary : theme.colors.border,
            borderRadius: theme.radii.lg,
          },
        ]}
      >
        <Text
          style={[
            styles.filterIcon,
            { color: activeFilterCount > 0 ? theme.colors.primaryFg : theme.colors.text },
          ]}
        >
          ⚙️
        </Text>
        {activeFilterCount > 0 && (
          <View style={[styles.badge, { backgroundColor: theme.colors.accent }]}>
            <Text style={[styles.badgeText, { color: theme.colors.text }]}>
              {activeFilterCount}
            </Text>
          </View>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 6,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    paddingHorizontal: 12,
    minHeight: 48,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 8,
  },
  clearBtn: {
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterBtn: {
    minHeight: 48,
    minWidth: 48,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
    flexDirection: 'row',
  },
  filterIcon: {
    fontSize: 18,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
});
