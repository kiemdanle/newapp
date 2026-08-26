// apps/mobile/src/features/deals/DealFilterModal.tsx
import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { DealExpiryStatus } from '@expyrico/shared';
import type { DealFeedFilters } from '../../api/deals';
import { useDealStores } from '../../api/deals';
import { useTheme } from '../../theme/useTheme';

interface Props {
  visible: boolean;
  onClose: () => void;
  filters: DealFeedFilters;
  onApply: (nextFilters: DealFeedFilters) => void;
}

const PRICE_PRESETS: { label: string; min?: number; max?: number }[] = [
  { label: 'Under $5', max: 5 },
  { label: '$5 – $15', min: 5, max: 15 },
  { label: '$15 – $30', min: 15, max: 30 },
  { label: '$30+', min: 30 },
];

const EXPIRY_OPTIONS: { id: DealExpiryStatus; label: string }[] = [
  { id: 'all', label: 'All deals' },
  { id: 'expiring_soon', label: '⏳ Expiring in 7 days' },
  { id: 'unexpired', label: '✅ Unexpired only' },
];

const CURATED_FALLBACK_STORES = [
  { name: "Trader Joe's", count: 0 },
  { name: 'ALDI', count: 0 },
  { name: 'Costco', count: 0 },
  { name: 'Walmart', count: 0 },
  { name: 'Target', count: 0 },
  { name: 'Whole Foods', count: 0 },
];

export function DealFilterModal({ visible, onClose, filters, onApply }: Props) {
  const theme = useTheme();
  const storesQuery = useDealStores();

  const [selectedStore, setSelectedStore] = useState<string>(filters.store ?? '');
  const [minPrice, setMinPrice] = useState<string>(
    filters.minPrice !== undefined ? String(filters.minPrice) : '',
  );
  const [maxPrice, setMaxPrice] = useState<string>(
    filters.maxPrice !== undefined ? String(filters.maxPrice) : '',
  );
  const [expiryStatus, setExpiryStatus] = useState<DealExpiryStatus>(
    filters.expiryStatus ?? 'all',
  );
  const [countryScope, setCountryScope] = useState<'local' | 'global'>(
    filters.country?.toUpperCase() === 'ALL' ? 'global' : 'local',
  );

  const availableStores =
    storesQuery.data?.items && storesQuery.data.items.length > 0
      ? storesQuery.data.items
      : CURATED_FALLBACK_STORES;

  function handleReset() {
    setSelectedStore('');
    setMinPrice('');
    setMaxPrice('');
    setExpiryStatus('all');
    setCountryScope('local');
  }

  function handleApply() {
    const parsedMin = minPrice.trim() ? Number(minPrice) : undefined;
    const parsedMax = maxPrice.trim() ? Number(maxPrice) : undefined;

    onApply({
      ...filters,
      store: selectedStore.trim() || undefined,
      minPrice: parsedMin !== undefined && Number.isFinite(parsedMin) ? parsedMin : undefined,
      maxPrice: parsedMax !== undefined && Number.isFinite(parsedMax) ? parsedMax : undefined,
      expiryStatus: expiryStatus !== 'all' ? expiryStatus : undefined,
      country: countryScope === 'global' ? 'ALL' : undefined,
    });
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { backgroundColor: theme.colors.bg }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
            <Text style={[styles.title, { color: theme.colors.text }]}>Filters</Text>
            <Pressable accessibilityRole="button" onPress={onClose} hitSlop={10}>
              <Text style={{ color: theme.colors.textMuted, fontSize: 18, fontWeight: '700' }}>
                ✕
              </Text>
            </Pressable>
          </View>

          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
            {/* Store Name Filter */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Store Name</Text>
              <TextInput
                accessibilityLabel="Filter by store"
                placeholder="Search or enter store name…"
                placeholderTextColor={theme.colors.textMuted}
                value={selectedStore}
                onChangeText={setSelectedStore}
                style={[
                  styles.textInput,
                  {
                    color: theme.colors.text,
                    backgroundColor: theme.colors.bgElevated,
                    borderColor: theme.colors.border,
                    borderRadius: theme.radii.md,
                  },
                ]}
              />
              <View style={styles.chipRow}>
                {availableStores.slice(0, 8).map((store) => {
                  const isSelected = selectedStore.toLowerCase() === store.name.toLowerCase();
                  return (
                    <Pressable
                      key={store.name}
                      accessibilityRole="button"
                      onPress={() =>
                        setSelectedStore(isSelected ? '' : store.name)
                      }
                      style={[
                        styles.chip,
                        {
                          backgroundColor: isSelected
                            ? theme.colors.primary
                            : theme.colors.bgElevated,
                          borderColor: isSelected
                            ? theme.colors.primary
                            : theme.colors.border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          {
                            color: isSelected
                              ? theme.colors.primaryFg
                              : theme.colors.text,
                          },
                        ]}
                      >
                        {store.name} {store.count > 0 ? `(${store.count})` : ''}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Price Range Filter */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Price Range</Text>
              <View style={styles.chipRow}>
                {PRICE_PRESETS.map((preset) => {
                  const isSelected =
                    (preset.min === undefined ? minPrice === '' : minPrice === String(preset.min)) &&
                    (preset.max === undefined ? maxPrice === '' : maxPrice === String(preset.max));
                  return (
                    <Pressable
                      key={preset.label}
                      accessibilityRole="button"
                      onPress={() => {
                        if (isSelected) {
                          setMinPrice('');
                          setMaxPrice('');
                        } else {
                          setMinPrice(preset.min !== undefined ? String(preset.min) : '');
                          setMaxPrice(preset.max !== undefined ? String(preset.max) : '');
                        }
                      }}
                      style={[
                        styles.chip,
                        {
                          backgroundColor: isSelected
                            ? theme.colors.primary
                            : theme.colors.bgElevated,
                          borderColor: isSelected
                            ? theme.colors.primary
                            : theme.colors.border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          {
                            color: isSelected
                              ? theme.colors.primaryFg
                              : theme.colors.text,
                          },
                        ]}
                      >
                        {preset.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <View style={styles.priceInputRow}>
                <TextInput
                  accessibilityLabel="Minimum price"
                  placeholder="Min ($)"
                  placeholderTextColor={theme.colors.textMuted}
                  keyboardType="decimal-pad"
                  value={minPrice}
                  onChangeText={setMinPrice}
                  style={[
                    styles.priceInput,
                    {
                      color: theme.colors.text,
                      backgroundColor: theme.colors.bgElevated,
                      borderColor: theme.colors.border,
                      borderRadius: theme.radii.md,
                    },
                  ]}
                />
                <Text style={{ color: theme.colors.textMuted, fontSize: 16 }}>–</Text>
                <TextInput
                  accessibilityLabel="Maximum price"
                  placeholder="Max ($)"
                  placeholderTextColor={theme.colors.textMuted}
                  keyboardType="decimal-pad"
                  value={maxPrice}
                  onChangeText={setMaxPrice}
                  style={[
                    styles.priceInput,
                    {
                      color: theme.colors.text,
                      backgroundColor: theme.colors.bgElevated,
                      borderColor: theme.colors.border,
                      borderRadius: theme.radii.md,
                    },
                  ]}
                />
              </View>
            </View>

            {/* Expiry Status Filter */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Expiration Status</Text>
              <View style={styles.verticalOptionList}>
                {EXPIRY_OPTIONS.map((opt) => {
                  const isSelected = expiryStatus === opt.id;
                  return (
                    <Pressable
                      key={opt.id}
                      accessibilityRole="button"
                      onPress={() => setExpiryStatus(opt.id)}
                      style={[
                        styles.radioOption,
                        {
                          backgroundColor: isSelected
                            ? theme.colors.primary + '14'
                            : theme.colors.bgElevated,
                          borderColor: isSelected
                            ? theme.colors.primary
                            : theme.colors.border,
                          borderRadius: theme.radii.md,
                        },
                      ]}
                    >
                      <Text
                        style={{
                          color: isSelected ? theme.colors.primaryDark : theme.colors.text,
                          fontWeight: isSelected ? '700' : '500',
                          fontSize: 15,
                        }}
                      >
                        {opt.label}
                      </Text>
                      <View
                        style={[
                          styles.radioCircle,
                          {
                            borderColor: isSelected
                              ? theme.colors.primary
                              : theme.colors.border,
                          },
                        ]}
                      >
                        {isSelected && (
                          <View
                            style={[
                              styles.radioDot,
                              { backgroundColor: theme.colors.primary },
                            ]}
                          />
                        )}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Location Scope Toggle */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Location Scope</Text>
              <View style={styles.chipRow}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setCountryScope('local')}
                  style={[
                    styles.chip,
                    {
                      backgroundColor:
                        countryScope === 'local'
                          ? theme.colors.primary
                          : theme.colors.bgElevated,
                      borderColor:
                        countryScope === 'local'
                          ? theme.colors.primary
                          : theme.colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      {
                        color:
                          countryScope === 'local'
                            ? theme.colors.primaryFg
                            : theme.colors.text,
                      },
                    ]}
                  >
                    📍 Local / In My Area
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setCountryScope('global')}
                  style={[
                    styles.chip,
                    {
                      backgroundColor:
                        countryScope === 'global'
                          ? theme.colors.primary
                          : theme.colors.bgElevated,
                      borderColor:
                        countryScope === 'global'
                          ? theme.colors.primary
                          : theme.colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      {
                        color:
                          countryScope === 'global'
                            ? theme.colors.primaryFg
                            : theme.colors.text,
                      },
                    ]}
                  >
                    🌍 Worldwide Deals
                  </Text>
                </Pressable>
              </View>
            </View>
          </ScrollView>

          {/* Footer Actions */}
          <View style={[styles.footer, { borderTopColor: theme.colors.border }]}>
            <Pressable
              accessibilityRole="button"
              onPress={handleReset}
              style={[styles.btnReset, { borderColor: theme.colors.border }]}
            >
              <Text style={{ color: theme.colors.textMuted, fontWeight: '700', fontSize: 15 }}>
                Reset All
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={handleApply}
              style={[
                styles.btnApply,
                { backgroundColor: theme.colors.primary, borderRadius: theme.radii.pill },
              ]}
            >
              <Text style={{ color: theme.colors.primaryFg, fontWeight: '700', fontSize: 15 }}>
                Apply Filters
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    minHeight: 480,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    padding: 20,
    gap: 20,
  },
  section: {
    gap: 8,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  textInput: {
    borderWidth: 1,
    paddingHorizontal: 12,
    minHeight: 44,
    fontSize: 14,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    minHeight: 38,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  priceInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
  },
  priceInput: {
    flex: 1,
    borderWidth: 1,
    paddingHorizontal: 12,
    minHeight: 44,
    fontSize: 14,
    textAlign: 'center',
  },
  verticalOptionList: {
    gap: 8,
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    minHeight: 48,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 12,
    borderTopWidth: 1,
  },
  btnReset: {
    flex: 1,
    minHeight: 50,
    borderWidth: 1,
    borderRadius: 999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnApply: {
    flex: 2,
    minHeight: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
