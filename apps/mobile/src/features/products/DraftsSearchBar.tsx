import React from 'react';
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../../theme/useTheme';

export interface DraftsSearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  viewMode?: 'list' | 'grid';
  onToggleViewMode?: () => void;
  placeholder?: string;
}

export function DraftsSearchBar({
  value,
  onChangeText,
  viewMode,
  onToggleViewMode,
  placeholder = 'Search by name or barcode...',
}: DraftsSearchBarProps) {
  const theme = useTheme();

  return (
    <View style={styles.container}>
      {/* Search Input Box */}
      <View
        style={[
          styles.searchBox,
          {
            backgroundColor: theme.colors.bgElevated,
            borderColor: theme.colors.border,
            borderRadius: theme.radii.md,
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
          testID="drafts-search-input"
          accessibilityLabel="Search product drafts"
          placeholder={placeholder}
          placeholderTextColor={theme.colors.textMuted}
          value={value}
          onChangeText={onChangeText}
          style={[styles.input, { color: theme.colors.text }]}
          returnKeyType="search"
          clearButtonMode="never"
          autoCorrect={false}
          autoCapitalize="none"
        />
        {value.length > 0 ? (
          <Pressable
            testID="drafts-search-clear-btn"
            accessibilityRole="button"
            accessibilityLabel="Clear search"
            onPress={() => onChangeText('')}
            hitSlop={8}
            style={styles.clearBtn}
          >
            <Ionicons name="close-circle" size={18} color={theme.colors.textMuted} />
          </Pressable>
        ) : null}
      </View>

      {/* View Mode Toggle Button */}
      {onToggleViewMode ? (
        <Pressable
        testID="drafts-view-mode-toggle-btn"
        accessibilityLabel={viewMode === 'grid' ? 'Switch to list view' : 'Switch to grid view'}
        onPress={onToggleViewMode}
        style={({ pressed }) => [
          styles.toggleBtn,
          {
            backgroundColor: pressed ? theme.colors.bgGlass : theme.colors.bgElevated,
            borderColor: theme.colors.border,
            borderRadius: theme.radii.md,
          },
        ]}
      >
        <Ionicons
          name={viewMode === 'grid' ? 'list-outline' : 'grid-outline'}
          size={20}
          color={theme.colors.text}
        />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 46,
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
  toggleBtn: {
    width: 46,
    height: 46,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
