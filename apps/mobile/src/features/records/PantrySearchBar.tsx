// apps/mobile/src/features/records/PantrySearchBar.tsx
import React, { useEffect, useRef, useState } from 'react';
import {
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextInputSubmitEditingEventData,
  View,
} from 'react-native';
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
  const textRef = useRef(value);
  const isFocusedRef = useRef(false);

  // Synchronize ONLY when external reset occurs (e.g. from Clear All chips or reset)
  // NEVER push value back into localText if the input is actively focused by the user
  // and localText matches value. That prevents React Native Android from calling native
  // EditText.setText(), which cancels the active Shift/IME composition state!
  useEffect(() => {
    if (value === '') {
      textRef.current = '';
      setLocalText('');
    } else if (!isFocusedRef.current && value !== textRef.current) {
      textRef.current = value;
      setLocalText(value);
    }
  }, [value]);

  const handleChangeText = (text: string) => {
    textRef.current = text;
    setLocalText(text);
  };

  const handleSearch = () => {
    onChangeText(textRef.current.trim());
  };

  const handleSubmitEditing = (
    e?: NativeSyntheticEvent<TextInputSubmitEditingEventData>,
  ) => {
    const text = e?.nativeEvent?.text !== undefined ? e.nativeEvent.text : textRef.current;
    onChangeText(text.trim());
  };

  const handleClear = () => {
    textRef.current = '';
    setLocalText('');
  };
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
        <TextInput
          testID="pantry-search-input"
          accessibilityRole="search"
          accessibilityLabel="Search pantry items"
          placeholder="Search name, brand, category, notes…"
          placeholderTextColor={theme.colors.textMuted}
          value={localText}
          onFocus={() => {
            isFocusedRef.current = true;
          }}
          onBlur={() => {
            isFocusedRef.current = false;
          }}
          onChangeText={handleChangeText}
          onSubmitEditing={handleSubmitEditing}
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
            hitSlop={8}
            style={styles.clearBtn}
          >
            <Ionicons name="close-circle" size={18} color={theme.colors.textMuted} />
          </Pressable>
        ) : null}
        <Pressable
          testID="pantry-search-submit-btn"
          accessibilityRole="button"
          accessibilityLabel="Search"
          onPress={handleSearch}
          hitSlop={8}
          style={styles.searchSubmitBtn}
        >
          <Ionicons
            name="search-outline"
            size={20}
            color={localText.trim().length > 0 ? theme.colors.primary : theme.colors.textMuted}
          />
        </Pressable>
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
    paddingLeft: 14,
    paddingRight: 8,
    gap: 6,
  },
  input: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 0,
  },
  clearBtn: {
    padding: 4,
  },
  searchSubmitBtn: {
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
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
