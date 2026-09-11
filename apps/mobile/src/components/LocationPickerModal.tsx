// apps/mobile/src/components/LocationPickerModal.tsx
import React, { useState } from 'react';
import {
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
import {
  DEFAULT_TOP_LOCATIONS,
  COMMON_OTHER_LOCATIONS,
  normalizeLocation,
  normalizeLocationTitleCase,
  getLocationIcon,
} from '../utils/locations';

export interface LocationPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (location: string | null) => void;
  currentLocation?: string | null;
}

export function LocationPickerModal({
  visible,
  onClose,
  onSelect,
  currentLocation,
}: LocationPickerModalProps) {
  const theme = useTheme();
  const isDark = theme.scheme === 'dark';
  const [customInput, setCustomInput] = useState('');
  const [search, setSearch] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [customFocused, setCustomFocused] = useState(false);

  if (!visible) return null;

  const normalizedCurrent = normalizeLocation(currentLocation);
  const normalizedSearch = search.trim().toLowerCase();

  const allPresetLocations = [
    ...DEFAULT_TOP_LOCATIONS,
    ...COMMON_OTHER_LOCATIONS,
  ];

  const filteredLocations = allPresetLocations.filter((loc) => {
    if (!normalizedSearch) return true;
    return loc.toLowerCase().includes(normalizedSearch);
  });

  const handleApplyCustom = () => {
    const trimmed = search.trim();
    if (!trimmed) return;
    const titleCased = normalizeLocationTitleCase(trimmed);
    onSelect(titleCased);
    setSearch('');
    onClose();
  };

  const handleApplyDefinedLocation = (textToApply?: string) => {
    const raw = textToApply ?? customInput;
    const trimmed = raw.trim();
    if (!trimmed) return;
    const titleCased = normalizeLocationTitleCase(trimmed);
    onSelect(titleCased);
    setSearch('');
    setCustomInput('');
    onClose();
  };

  const handleSelectPreset = (loc: string) => {
    onSelect(normalizeLocationTitleCase(loc));
    setSearch('');
    onClose();
  };

  const handleClear = () => {
    onSelect(null);
    setSearch('');
    onClose();
  };

  const isCustomMatch =
    normalizedSearch.length > 0 &&
    !allPresetLocations.some(
      (l) => l.toLowerCase() === normalizedSearch,
    );

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
          accessibilityLabel="Dismiss location picker"
          style={styles.backdropOverlay}
          onPress={onClose}
        />

        <View
          testID="location-picker-modal"
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
                Storage Location
              </Text>
              <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>
                Select or enter where this item is stored.
              </Text>
            </View>
            <Pressable
              testID="location-picker-close-btn"
              accessibilityRole="button"
              accessibilityLabel="Close location picker"
              onPress={onClose}
              hitSlop={8}
              style={[
                styles.closeBtn,
                {
                  backgroundColor: isDark ? theme.colors.bgGlass : theme.colors.primaryLight,
                  borderColor: isDark ? theme.colors.border : 'rgba(75, 174, 138, 0.35)',
                },
              ]}
            >
              <Ionicons name="close" size={18} color={isDark ? theme.colors.text : theme.colors.primaryDark} />
            </Pressable>
          </View>

          {/* Search / Custom Location Input */}
          <View style={styles.searchRow}>
            <View
              style={[
                styles.searchBar,
                {
                  backgroundColor: isDark ? theme.colors.bgGlass : theme.colors.bgElevated,
                  borderColor: searchFocused
                    ? theme.colors.primary
                    : isDark
                      ? theme.colors.border
                      : 'rgba(75, 174, 138, 0.35)',
                  borderWidth: searchFocused ? 1.5 : 1,
                },
              ]}
            >
              <Ionicons
                name="search"
                size={16}
                color={searchFocused ? theme.colors.primary : (isDark ? theme.colors.textMuted : theme.colors.primaryDark)}
              />
              <TextInput
                accessibilityLabel="Search or enter location"
                testID="location-picker-search-input"
                value={search}
                onChangeText={setSearch}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                maxLength={50}
                placeholder="Search or enter location (e.g. Spice Rack)..."
                placeholderTextColor={theme.colors.textMuted}
                style={[styles.searchInput, { color: theme.colors.text }]}
                autoCapitalize="words"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={handleApplyCustom}
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

            {search.trim().length > 0 && (
              <Pressable
                testID="location-picker-apply-btn"
                accessibilityRole="button"
                accessibilityLabel="Apply custom location"
                onPress={handleApplyCustom}
                style={[
                  styles.applyBtn,
                  {
                    backgroundColor: theme.colors.accent,
                    borderColor: theme.colors.accent,
                  },
                ]}
              >
                <Text style={[styles.applyBtnText, { color: '#2C2C28' }]}>Apply</Text>
              </Pressable>
            )}
          </View>

          {/* Preset Chips */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.scrollContent}
          >
            {isCustomMatch && (
              <View style={styles.customMatchSection}>
                <View style={styles.categoryHeaderRow}>
                  <Ionicons name="pricetag-outline" size={13} color={isDark ? theme.colors.primary : theme.colors.primaryDark} />
                  <Text
                    style={[styles.sectionTitle, { color: isDark ? theme.colors.primary : theme.colors.primaryDark }]}
                  >
                    CUSTOM LOCATION
                  </Text>
                </View>
                <Pressable
                  testID="location-picker-custom-chip"
                  accessibilityRole="button"
                  accessibilityLabel={`Add custom location ${search.trim()}`}
                  onPress={handleApplyCustom}
                  style={[
                    styles.applyCustomChip,
                    {
                      backgroundColor: theme.colors.accent,
                      borderColor: theme.colors.accent,
                    },
                  ]}
                >
                  <Ionicons
                    name="add-circle-outline"
                    size={16}
                    color="#2C2C28"
                  />
                  <Text
                    style={[
                      styles.applyCustomChipText,
                      { color: '#2C2C28' },
                    ]}
                  >
                    Add &quot;{normalizeLocationTitleCase(search)}&quot;
                  </Text>
                </Pressable>
              </View>
            )}

            {filteredLocations.length === 0 && search.trim().length > 0 && (
              <View
                style={[
                  styles.notFoundBox,
                  {
                    backgroundColor: isDark ? theme.colors.bgGlass : 'rgba(214, 240, 230, 0.35)',
                    borderColor: isDark ? theme.colors.border : 'rgba(75, 174, 138, 0.3)',
                  },
                ]}
              >
                <Ionicons
                  name="search-outline"
                  size={18}
                  color={isDark ? theme.colors.primary : theme.colors.primaryDark}
                />
                <Text
                  style={[styles.notFoundText, { color: theme.colors.text }]}
                >
                  No preset found for &quot;{search}&quot;.
                </Text>
                <Pressable
                  testID="location-picker-not-found-chip"
                  accessibilityRole="button"
                  accessibilityLabel={`Define and use ${search.trim()} as storage location`}
                  onPress={() => handleApplyDefinedLocation(search)}
                  style={[
                    styles.applyCustomChip,
                    {
                      backgroundColor: theme.colors.accent,
                      borderColor: theme.colors.accent,
                    },
                  ]}
                >
                  <Ionicons name="add" size={16} color="#2C2C28" />
                  <Text
                    style={[
                      styles.applyCustomChipText,
                      { color: '#2C2C28' },
                    ]}
                  >
                    Define &quot;{normalizeLocationTitleCase(search)}&quot;
                  </Text>
                </Pressable>
              </View>
            )}

            <View style={styles.categoryHeaderRow}>
              <Ionicons name="navigate-outline" size={13} color={isDark ? theme.colors.primary : theme.colors.primaryDark} />
              <Text
                style={[styles.sectionTitle, { color: isDark ? theme.colors.primary : theme.colors.primaryDark }]}
              >
                PRESET LOCATIONS
              </Text>
            </View>

            <View style={styles.chipsWrap}>
              {filteredLocations.map((loc) => {
                const isSelected = normalizedCurrent === loc.toLowerCase();
                const iconName = getLocationIcon(loc);

                return (
                  <Pressable
                    key={loc}
                    testID={`location-picker-chip-${loc.toLowerCase().replace(/\s+/g, '-')}`}
                    accessibilityRole="button"
                    accessibilityLabel={`Select location ${loc}`}
                    accessibilityState={{ selected: isSelected }}
                    onPress={() => handleSelectPreset(loc)}
                    style={({ pressed }) => [
                      styles.locationChip,
                      {
                        backgroundColor: isSelected
                          ? (isDark ? 'rgba(75, 174, 138, 0.22)' : theme.colors.primaryLight)
                          : (isDark ? theme.colors.bgGlass : 'rgba(214, 240, 230, 0.35)'),
                        borderColor: isSelected
                          ? theme.colors.primary
                          : (isDark ? theme.colors.border : 'rgba(75, 174, 138, 0.28)'),
                        borderWidth: isSelected ? 2 : 1,
                        opacity: pressed ? 0.82 : 1,
                      },
                    ]}
                  >
                    <Ionicons
                      name={iconName}
                      size={15}
                      color={isSelected ? (isDark ? theme.colors.primary : theme.colors.primaryDark) : (isDark ? theme.colors.textMuted : theme.colors.primaryDark)}
                    />
                    <Text
                      style={[
                        styles.chipText,
                        {
                          color: isSelected
                            ? (isDark ? theme.colors.primary : theme.colors.primaryDark)
                            : theme.colors.text,
                          fontWeight: isSelected ? '800' : '600',
                        },
                      ]}
                    >
                      {loc}
                    </Text>
                    {isSelected && (
                      <Ionicons
                        name="checkmark-circle"
                        size={12}
                        color={theme.colors.primary}
                      />
                    )}
                  </Pressable>
                );
              })}
            </View>

            {/* Dedicated Custom Location Definition Section */}
            <View
              style={[
                styles.customSection,
                {
                  backgroundColor: isDark ? theme.colors.bgGlass : 'rgba(214, 240, 230, 0.25)',
                  borderColor: isDark ? theme.colors.border : 'rgba(75, 174, 138, 0.25)',
                },
              ]}
            >
              <View style={styles.categoryHeaderRow}>
                <Ionicons name="sparkles-outline" size={13} color={isDark ? theme.colors.primary : theme.colors.primaryDark} />
                <Text
                  style={[
                    styles.sectionTitle,
                    { color: isDark ? theme.colors.primary : theme.colors.primaryDark },
                  ]}
                >
                  DEFINE CUSTOM LOCATION
                </Text>
              </View>
              <Text
                style={[styles.customSubcopy, { color: theme.colors.textMuted }]}
              >
                Can&apos;t find your storage spot above? Type and define your own:
              </Text>
              <View style={styles.customInputRow}>
                <TextInput
                  accessibilityLabel="Custom storage location"
                  testID="location-picker-custom-input"
                  value={customInput}
                  onChangeText={setCustomInput}
                  onFocus={() => setCustomFocused(true)}
                  onBlur={() => setCustomFocused(false)}
                  maxLength={50}
                  placeholder="e.g. Wine Cooler, Deep Freezer, Garage..."
                  placeholderTextColor={theme.colors.textMuted}
                  style={[
                    styles.customInput,
                    {
                      color: theme.colors.text,
                      backgroundColor: isDark ? theme.colors.bgElevated : '#FFFFFF',
                      borderColor: customFocused
                        ? theme.colors.primary
                        : isDark
                          ? theme.colors.border
                          : 'rgba(75, 174, 138, 0.35)',
                      borderWidth: customFocused ? 1.5 : 1,
                    },
                  ]}
                  autoCapitalize="words"
                  autoCorrect={false}
                  returnKeyType="done"
                  onSubmitEditing={() => handleApplyDefinedLocation(customInput)}
                />
                <Pressable
                  testID="location-picker-custom-apply-btn"
                  accessibilityRole="button"
                  accessibilityLabel="Apply custom defined location"
                  onPress={() => handleApplyDefinedLocation(customInput)}
                  style={[
                    styles.customApplyBtn,
                    {
                      backgroundColor: customInput.trim()
                        ? theme.colors.accent
                        : (isDark ? 'rgba(245, 166, 35, 0.12)' : 'rgba(245, 166, 35, 0.15)'),
                      borderColor: customInput.trim()
                        ? theme.colors.accent
                        : (isDark ? 'rgba(245, 166, 35, 0.25)' : 'rgba(245, 166, 35, 0.3)'),
                    },
                  ]}
                  disabled={!customInput.trim()}
                >
                  <Text
                    style={[
                      styles.customApplyBtnText,
                      {
                        color: customInput.trim()
                          ? '#2C2C28'
                          : theme.colors.textMuted,
                      },
                    ]}
                  >
                    Apply
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* Clear Location Button */}
            {normalizedCurrent.length > 0 && (
              <View style={styles.clearSection}>
                <Pressable
                  testID="location-picker-clear-btn"
                  accessibilityRole="button"
                  accessibilityLabel="Clear storage location"
                  onPress={handleClear}
                  style={({ pressed }) => [
                    styles.clearBtn,
                    {
                      borderColor: isDark ? 'rgba(224, 68, 42, 0.45)' : 'rgba(224, 68, 42, 0.35)',
                      backgroundColor: isDark ? 'rgba(224, 68, 42, 0.14)' : 'rgba(224, 68, 42, 0.08)',
                      opacity: pressed ? 0.82 : 1,
                    },
                  ]}
                >
                  <Ionicons
                    name="trash-outline"
                    size={16}
                    color={theme.colors.danger}
                  />
                  <Text
                    style={[
                      styles.clearBtnText,
                      { color: theme.colors.danger },
                    ]}
                  >
                    Clear Location
                  </Text>
                </Pressable>
              </View>
            )}
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    gap: 10,
    marginBottom: 12,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
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
  applyBtn: {
    paddingHorizontal: 16,
    minHeight: 44,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  customMatchSection: {
    marginBottom: 14,
  },
  categoryHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  locationChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 16,
    minHeight: 44,
  },
  chipText: {
    fontSize: 13,
  },
  clearSection: {
    marginTop: 8,
    paddingTop: 8,
    marginBottom: 16,
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    minHeight: 44,
  },
  clearBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  notFoundBox: {
    padding: 14,
    borderRadius: 12,
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
  customSection: {
    marginTop: 8,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
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
  customApplyBtnText: {
    fontWeight: '700',
    fontSize: 14,
  },
});
