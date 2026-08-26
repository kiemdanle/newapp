import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../theme/useTheme';
import { getAllCountries, type CountryMetadata } from '../utils/country-format';

export interface CountryPickerModalProps {
  visible: boolean;
  selectedCountry?: string | null;
  onSelect: (country: CountryMetadata) => void;
  onClose: () => void;
}

export function CountryPickerModal({
  visible,
  selectedCountry,
  onSelect,
  onClose,
}: CountryPickerModalProps) {
  const theme = useTheme();
  const [searchQuery, setSearchQuery] = useState('');

  const allCountries = useMemo(() => getAllCountries(), []);

  const filteredCountries = useMemo(() => {
    if (!searchQuery.trim()) return allCountries;
    const q = searchQuery.toLowerCase().trim();
    return allCountries.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q) ||
        c.currencyCode.toLowerCase().includes(q),
    );
  }, [allCountries, searchQuery]);

  const handleSelect = (country: CountryMetadata) => {
    onSelect(country);
    setSearchQuery('');
    onClose();
  };

  const handleClose = () => {
    setSearchQuery('');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <Pressable style={styles.backdrop} onPress={handleClose}>
        <Pressable
          style={[
            styles.modalCard,
            {
              backgroundColor: theme.colors.bgElevated,
              borderColor: theme.colors.border,
            },
          ]}
          onPress={(e) => e?.stopPropagation?.()}
        >
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: '700',
                  color: theme.colors.text,
                }}
              >
                Select Country & Region
              </Text>
              <Text
                style={{
                  fontSize: 13,
                  color: theme.colors.textMuted,
                  marginTop: 2,
                }}
              >
                Sets default currency, date, and regional formats
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close country picker"
              onPress={handleClose}
              style={({ pressed }) => [
                styles.closeButton,
                {
                  backgroundColor: theme.colors.bgGlass,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <Ionicons name="close" size={20} color={theme.colors.text} />
            </Pressable>
          </View>

          {/* Search Field */}
          <View
            style={[
              styles.searchBar,
              {
                backgroundColor: theme.colors.bgGlass,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <Ionicons
              name="search-outline"
              size={18}
              color={theme.colors.textMuted}
            />
            <TextInput
              testID="country-search-input"
              accessibilityLabel="Search countries"
              style={[
                styles.searchInput,
                {
                  color: theme.colors.text,
                },
              ]}
              placeholder="Search by country or code (e.g. Vietnam, VN, US)..."
              placeholderTextColor={theme.colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCorrect={false}
              clearButtonMode="while-editing"
            />
            {searchQuery ? (
              <Pressable onPress={() => setSearchQuery('')}>
                <Ionicons
                  name="close-circle"
                  size={16}
                  color={theme.colors.textMuted}
                />
              </Pressable>
            ) : null}
          </View>

          {/* Country List */}
          <FlatList
            testID="country-picker-list"
            data={filteredCountries}
            keyExtractor={(item) => item.code}
            initialNumToRender={50}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => {
              const isSelected =
                selectedCountry?.toUpperCase() === item.code.toUpperCase();
              return (
                <Pressable
                  testID={`country-item-${item.code}`}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.name} (${item.code})`}
                  onPress={() => handleSelect(item)}
                  style={({ pressed }) => [
                    styles.countryRow,
                    {
                      backgroundColor: isSelected
                        ? theme.colors.bgGlass
                        : pressed
                          ? theme.colors.bgGlass
                          : 'transparent',
                      borderColor: isSelected
                        ? theme.colors.primary
                        : theme.colors.border,
                    },
                  ]}
                >
                  <Text style={styles.flagEmoji}>{item.flag}</Text>
                  <View style={styles.countryInfo}>
                    <View style={styles.countryNameRow}>
                      <Text
                        style={[
                          styles.countryName,
                          {
                            color: isSelected
                              ? theme.colors.primaryDark
                              : theme.colors.text,
                            fontWeight: isSelected ? '700' : '600',
                          },
                        ]}
                      >
                        {item.name}
                      </Text>
                      <Text
                        style={[
                          styles.countryCodeBadge,
                          {
                            color: theme.colors.textMuted,
                            backgroundColor: theme.colors.bgGlass,
                          },
                        ]}
                      >
                        {item.code}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.countryDetails,
                        { color: theme.colors.textMuted },
                      ]}
                    >
                      {item.currencyCode} ({item.currencySymbol}) ·{' '}
                      {item.dateFormat === 'DMY'
                        ? 'DD/MM/YYYY'
                        : item.dateFormat === 'MDY'
                          ? 'MM/DD/YYYY'
                          : 'YYYY/MM/DD'}
                    </Text>
                  </View>

                  {isSelected && (
                    <Ionicons
                      name="checkmark-circle"
                      size={20}
                      color={theme.colors.primary}
                    />
                  )}
                </Pressable>
              );
            }}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    maxHeight: '82%',
    minHeight: '55%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    paddingTop: 20,
    paddingBottom: 34,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  closeButton: {
    width: 44,
    height: 44,
    minHeight: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    padding: 0,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  countryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 6,
  },
  flagEmoji: {
    fontSize: 26,
  },
  countryInfo: {
    flex: 1,
    gap: 2,
  },
  countryNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  countryName: {
    fontSize: 15,
  },
  countryCodeBadge: {
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  countryDetails: {
    fontSize: 12,
  },
});
