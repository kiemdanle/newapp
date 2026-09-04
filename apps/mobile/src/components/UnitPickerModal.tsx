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

  if (!visible) return null;

  const normalizedCurrent = normalizeUnit(currentUnit);
  const normalizedSearch = search.trim().toLowerCase();

  const handleApplyCustom = () => {
    const trimmed = customUnit.trim().toLowerCase();
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
    onClose();
  };

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
        <Pressable style={styles.backdropOverlay} onPress={onClose} />

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
            <Text style={[styles.title, { color: theme.colors.text }]}>
              Select Unit
            </Text>
            <Pressable
              testID="unit-picker-close-btn"
              accessibilityRole="button"
              accessibilityLabel="Close unit picker"
              onPress={onClose}
              hitSlop={8}
            >
              <Ionicons name="close" size={24} color={theme.colors.textMuted} />
            </Pressable>
          </View>

          {/* Search bar */}
          <View
            style={[
              styles.searchBar,
              {
                backgroundColor: theme.colors.bg,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <Ionicons name="search" size={16} color={theme.colors.textMuted} />
            <TextInput
              testID="unit-picker-search-input"
              value={search}
              onChangeText={setSearch}
              placeholder="Search units (e.g. oz, lb, fl oz, kg)..."
              placeholderTextColor={theme.colors.textMuted}
              style={[styles.searchInput, { color: theme.colors.text }]}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {search ? (
              <Pressable onPress={() => setSearch('')} hitSlop={6}>
                <Ionicons name="close-circle" size={16} color={theme.colors.textMuted} />
              </Pressable>
            ) : null}
          </View>

          {/* Categorized List */}
          <ScrollView
            style={styles.scrollList}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
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
                      { color: theme.colors.primaryDark },
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
                          style={[
                            styles.unitCard,
                            {
                              borderColor: isSelected
                                ? theme.colors.primary
                                : theme.colors.border,
                              backgroundColor: isSelected
                                ? theme.colors.primaryLight
                                : theme.colors.bg,
                            },
                          ]}
                        >
                          <View style={styles.unitCardCopy}>
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
                            <Text
                              numberOfLines={1}
                              style={[
                                styles.unitLabelText,
                                { color: theme.colors.textMuted },
                              ]}
                            >
                              {u.label}
                            </Text>
                          </View>
                          {isSelected && (
                            <Ionicons
                              name="checkmark"
                              size={16}
                              color={theme.colors.primaryDark}
                            />
                          )}
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              );
            })}

            {/* Custom Unit Entry */}
            <View style={styles.customSection}>
              <Text
                style={[
                  styles.categoryTitle,
                  { color: theme.colors.textMuted },
                ]}
              >
                Custom Unit
              </Text>
              <View style={styles.customInputRow}>
                <TextInput
                  testID="unit-picker-custom-input"
                  value={customUnit}
                  onChangeText={setCustomUnit}
                  placeholder="Type custom unit (e.g. tray, bunch)..."
                  placeholderTextColor={theme.colors.textMuted}
                  maxLength={16}
                  style={[
                    styles.customTextInput,
                    {
                      backgroundColor: theme.colors.bg,
                      borderColor: theme.colors.border,
                      color: theme.colors.text,
                    },
                  ]}
                />
                <Pressable
                  testID="unit-picker-custom-apply-btn"
                  accessibilityRole="button"
                  accessibilityLabel="Apply custom unit"
                  onPress={handleApplyCustom}
                  style={[
                    styles.customApplyBtn,
                    {
                      backgroundColor: customUnit.trim()
                        ? theme.colors.primary
                        : theme.colors.border,
                    },
                  ]}
                  disabled={!customUnit.trim()}
                >
                  <Text style={styles.customApplyText}>Apply</Text>
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
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    maxHeight: '82%',
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 28,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
    marginBottom: 14,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 0,
  },
  scrollList: {
    flexGrow: 0,
  },
  categorySection: {
    marginBottom: 16,
  },
  categoryTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  unitGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  unitCard: {
    width: '48.5%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    minHeight: 46,
  },
  unitCardCopy: {
    flex: 1,
    gap: 1,
  },
  unitKeyText: {
    fontSize: 14,
  },
  unitLabelText: {
    fontSize: 11,
  },
  customSection: {
    marginTop: 8,
    marginBottom: 24,
  },
  customInputRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  customTextInput: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 14,
  },
  customApplyBtn: {
    height: 44,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customApplyText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
