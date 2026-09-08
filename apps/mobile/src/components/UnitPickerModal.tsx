// apps/mobile/src/components/UnitPickerModal.tsx
import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../theme/useTheme';
import { UNIT_CATEGORIES, normalizeUnit } from '../utils/units';

export interface UnitPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (unit: string) => void;
  currentUnit: string;
}

const CUSTOM_UNIT_REGEX = /^[a-zA-Z0-9\s/°\-_.]+$/;

export function UnitPickerModal({
  visible,
  onClose,
  onSelect,
  currentUnit,
}: UnitPickerModalProps) {
  const theme = useTheme();
  const [search, setSearch] = useState('');
  const [customUnit, setCustomUnit] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [customFocused, setCustomFocused] = useState(false);

  if (!visible) return null;

  const normalizedCurrent = normalizeUnit(currentUnit);
  const normalizedSearch = search.trim().toLowerCase();

  const handleApplyCustom = (rawText?: string) => {
    const text = rawText ?? customUnit;
    const trimmed = text.trim().toLowerCase();
    if (!trimmed) return;

    if (!CUSTOM_UNIT_REGEX.test(trimmed)) {
      Alert.alert(
        'Invalid Unit',
        'Unit may only contain letters, numbers, spaces, and basic symbols (/, -, _, .).',
      );
      return;
    }

    if (trimmed.length > 16) {
      Alert.alert('Unit Too Long', 'Unit cannot exceed 16 characters.');
      return;
    }

    onSelect(trimmed);
    setCustomUnit('');
    setSearch('');
    onClose();
  };

  // Check if any category has matching units
  const totalMatchingUnits = UNIT_CATEGORIES.reduce((count, cat) => {
    return (
      count +
      cat.units.filter((u) => {
        if (!normalizedSearch) return true;
        return (
          u.key.toLowerCase().includes(normalizedSearch) ||
          u.label.toLowerCase().includes(normalizedSearch) ||
          u.sublabel?.toLowerCase().includes(normalizedSearch)
        );
      }).length
    );
  }, 0);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.backdrop}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss unit picker"
          style={styles.backdropOverlay}
          onPress={onClose}
        />

        <View
          testID="unit-picker-modal"
          style={[
            styles.sheet,
            {
              backgroundColor: theme.colors.bgElevated,
              borderColor: theme.colors.border,
            },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: theme.colors.text }]}>
                Select Unit
              </Text>
              <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>
                Choose a measurement unit or enter a custom one.
              </Text>
            </View>
            <Pressable
              testID="unit-picker-close-btn"
              accessibilityRole="button"
              accessibilityLabel="Close unit picker"
              onPress={onClose}
              hitSlop={8}
              style={[
                styles.closeBtn,
                {
                  backgroundColor: theme.colors.bgGlass,
                  borderColor: theme.colors.border,
                },
              ]}
            >
              <Ionicons name="close" size={20} color={theme.colors.textMuted} />
            </Pressable>
          </View>

          {/* Search bar */}
          <View style={styles.searchRow}>
            <View
              style={[
                styles.searchBar,
                {
                  backgroundColor: theme.colors.bgElevated,
                  borderColor: searchFocused
                    ? theme.colors.primary
                    : theme.colors.neutralMid,
                },
              ]}
            >
              <Ionicons
                name="search"
                size={16}
                color={searchFocused ? theme.colors.primary : theme.colors.textMuted}
              />
              <TextInput
                testID="unit-picker-search-input"
                value={search}
                onChangeText={setSearch}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                placeholder="Search units (e.g. oz, lb, fl oz, kg)..."
                placeholderTextColor={theme.colors.textMuted}
                style={[styles.searchInput, { color: theme.colors.text }]}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={() => handleApplyCustom(search)}
              />
              {search.length > 0 && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Clear search input"
                  onPress={() => setSearch('')}
                  hitSlop={6}
                >
                  <Ionicons
                    name="close-circle"
                    size={16}
                    color={theme.colors.textMuted}
                  />
                </Pressable>
              )}
            </View>
          </View>

          {/* Categorized List */}
          <ScrollView
            style={styles.scrollList}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.scrollContent}
          >
            {/* Fallback chip when search has no matching preset units */}
            {totalMatchingUnits === 0 && search.trim().length > 0 && (
              <View
                style={[
                  styles.notFoundBox,
                  {
                    backgroundColor: theme.colors.bgElevated,
                    borderColor: theme.colors.border,
                  },
                ]}
              >
                <Ionicons
                  name="search-outline"
                  size={18}
                  color={theme.colors.textMuted}
                />
                <Text
                  style={[styles.notFoundText, { color: theme.colors.textMuted }]}
                >
                  No preset unit found for &quot;{search}&quot;.
                </Text>
                <Pressable
                  testID="unit-picker-not-found-chip"
                  accessibilityRole="button"
                  accessibilityLabel={`Use ${search.trim()} as measurement unit`}
                  onPress={() => handleApplyCustom(search)}
                  style={[
                    styles.applyCustomChip,
                    {
                      backgroundColor: theme.colors.accentLight,
                      borderColor: theme.colors.accent,
                    },
                  ]}
                >
                  <Ionicons name="add" size={16} color={theme.colors.neutralDark} />
                  <Text
                    style={[
                      styles.applyCustomChipText,
                      { color: theme.colors.neutralDark },
                    ]}
                  >
                    Use &quot;{search.trim().toLowerCase().slice(0, 16)}&quot;
                  </Text>
                </Pressable>
              </View>
            )}

            {UNIT_CATEGORIES.map((cat) => {
              const matchingUnits = cat.units.filter((u) => {
                if (!normalizedSearch) return true;
                return (
                  u.key.toLowerCase().includes(normalizedSearch) ||
                  u.label.toLowerCase().includes(normalizedSearch) ||
                  u.sublabel?.toLowerCase().includes(normalizedSearch)
                );
              });

              if (matchingUnits.length === 0) return null;

              return (
                <View key={cat.title} style={styles.categorySection}>
                  <Text
                    style={[
                      styles.categoryTitle,
                      { color: theme.colors.textMuted },
                    ]}
                  >
                    {cat.title}
                  </Text>

                  <View style={styles.unitGrid}>
                    {matchingUnits.map((u) => {
                      const isSelected = normalizedCurrent === u.key.toLowerCase();
                      return (
                        <Pressable
                          key={u.key}
                          testID={`unit-option-${u.key.replace(/\s+/g, '-')}`}
                          accessibilityRole="button"
                          accessibilityLabel={u.label}
                          accessibilityState={{ selected: isSelected }}
                          onPress={() => {
                            onSelect(u.key);
                            onClose();
                          }}
                          style={({ pressed }) => [
                            styles.unitCard,
                            {
                              backgroundColor: isSelected
                                ? theme.colors.primaryLight
                                : theme.colors.bgElevated,
                              borderColor: isSelected
                                ? theme.colors.primary
                                : theme.colors.neutralMid,
                              opacity: pressed ? 0.82 : 1,
                            },
                          ]}
                        >
                          <View style={styles.unitCardCopy}>
                            <View style={styles.unitHeaderRow}>
                              <Text
                                style={[
                                  styles.unitKeyText,
                                  {
                                    color: isSelected
                                      ? theme.colors.primaryDark
                                      : theme.colors.text,
                                    fontWeight: isSelected ? '700' : '600',
                                  },
                                ]}
                              >
                                {u.key}
                              </Text>
                              {isSelected && (
                                <Ionicons
                                  name="checkmark-circle"
                                  size={12}
                                  color={theme.colors.primaryDark}
                                />
                              )}
                            </View>
                            <Text
                              numberOfLines={1}
                              ellipsizeMode="tail"
                              style={[
                                styles.unitLabelText,
                                {
                                  color: isSelected
                                    ? theme.colors.primaryDark
                                    : theme.colors.textMuted,
                                },
                              ]}
                            >
                              {u.label}
                            </Text>
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              );
            })}

            {/* Dedicated Custom Unit Definition Section */}
            <View
              style={[
                styles.customSection,
                { borderTopColor: theme.colors.border },
              ]}
            >
              <Text
                style={[
                  styles.categoryTitle,
                  { color: theme.colors.textMuted },
                ]}
              >
                DEFINE CUSTOM UNIT
              </Text>
              <Text
                style={[styles.customSubcopy, { color: theme.colors.textMuted }]}
              >
                Can&apos;t find your measurement unit above? Type and define your own:
              </Text>
              <View style={styles.customInputRow}>
                <TextInput
                  testID="unit-picker-custom-input"
                  value={customUnit}
                  onChangeText={setCustomUnit}
                  onFocus={() => setCustomFocused(true)}
                  onBlur={() => setCustomFocused(false)}
                  placeholder="e.g. tray, bunch, tub..."
                  placeholderTextColor={theme.colors.textMuted}
                  maxLength={16}
                  style={[
                    styles.customInput,
                    {
                      color: theme.colors.text,
                      backgroundColor: theme.colors.bgElevated,
                      borderColor: customFocused
                        ? theme.colors.primary
                        : theme.colors.neutralMid,
                    },
                  ]}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="done"
                  onSubmitEditing={() => handleApplyCustom()}
                />
                <Pressable
                  testID="unit-picker-custom-apply-btn"
                  accessibilityRole="button"
                  accessibilityLabel="Apply custom unit"
                  onPress={() => handleApplyCustom()}
                  style={[
                    styles.customApplyBtn,
                    {
                      backgroundColor: customUnit.trim()
                        ? theme.colors.accent
                        : theme.colors.bgElevated,
                      borderColor: customUnit.trim()
                        ? theme.colors.accent
                        : theme.colors.neutralMid,
                    },
                  ]}
                  disabled={!customUnit.trim()}
                >
                  <Text
                    style={[
                      styles.customApplyText,
                      {
                        color: customUnit.trim()
                          ? '#FFFFFF'
                          : theme.colors.textMuted,
                      },
                    ]}
                  >
                    Apply
                  </Text>
                </Pressable>
              </View>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdropOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 0,
    maxHeight: '82%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  subtitle: {
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
  },
  searchRow: {
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 44,
    minHeight: 44,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 0,
  },
  scrollList: {
    flexGrow: 0,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  categorySection: {
    marginBottom: 16,
  },
  categoryTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  unitGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  unitCard: {
    width: '31.3%',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    paddingHorizontal: 4,
    borderRadius: 12,
    borderWidth: 1,
    minHeight: 50,
    height: 50,
  },
  unitCardCopy: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    gap: 2,
  },
  unitHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  unitKeyText: {
    fontSize: 13,
    textAlign: 'center',
  },
  unitLabelText: {
    fontSize: 10,
    textAlign: 'center',
  },
  customSection: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    marginBottom: 16,
  },
  customSubcopy: {
    fontSize: 12,
    marginTop: 2,
    marginBottom: 10,
  },
  customInputRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  customInput: {
    flex: 1,
    height: 44,
    minHeight: 44,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 15,
  },
  customApplyBtn: {
    paddingHorizontal: 16,
    height: 44,
    minHeight: 44,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customApplyText: {
    fontWeight: '700',
    fontSize: 14,
  },
  notFoundBox: {
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  notFoundText: {
    fontSize: 13,
  },
  applyCustomChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1,
    minHeight: 44,
  },
  applyCustomChipText: {
    fontWeight: '700',
    fontSize: 13,
  },
});
