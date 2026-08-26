// apps/mobile/src/features/giveaways/GiveawayFilterModal.tsx
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
import type { GiveawayStatus } from '@expyrico/shared';
import type { GiveawayFeedFilters } from '../../api/giveaways';
import { useTheme } from '../../theme/useTheme';

interface Props {
  visible: boolean;
  onClose: () => void;
  filters: GiveawayFeedFilters;
  onApply: (nextFilters: GiveawayFeedFilters) => void;
}

const STATUS_OPTIONS: { id: GiveawayStatus | 'all'; label: string }[] = [
  { id: 'open', label: '🎁 Open Offers' },
  { id: 'all', label: 'All Statuses' },
  { id: 'claimed', label: 'Claimed' },
  { id: 'completed', label: 'Completed' },
];

export function GiveawayFilterModal({ visible, onClose, filters, onApply }: Props) {
  const theme = useTheme();

  const [status, setStatus] = useState<GiveawayStatus | 'all'>(filters.status ?? 'open');
  const [location, setLocation] = useState<string>(filters.location ?? '');
  const [hasPhoto, setHasPhoto] = useState<boolean>(filters.hasPhoto ?? false);
  const [countryScope, setCountryScope] = useState<'local' | 'global'>(
    filters.country?.toUpperCase() === 'ALL' ? 'global' : 'local',
  );

  function handleReset() {
    setStatus('open');
    setLocation('');
    setHasPhoto(false);
    setCountryScope('local');
  }

  function handleApply() {
    onApply({
      ...filters,
      status: status !== 'open' ? status : undefined,
      location: location.trim() || undefined,
      hasPhoto: hasPhoto ? true : undefined,
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
            {/* Status Filter */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Offer Status</Text>
              <View style={styles.chipRow}>
                {STATUS_OPTIONS.map((opt) => {
                  const isSelected = status === opt.id;
                  return (
                    <Pressable
                      key={opt.id}
                      accessibilityRole="button"
                      onPress={() => setStatus(opt.id)}
                      style={[
                        styles.chip,
                        {
                          backgroundColor: isSelected ? theme.colors.primary : theme.colors.bgElevated,
                          borderColor: isSelected ? theme.colors.primary : theme.colors.border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          { color: isSelected ? theme.colors.primaryFg : theme.colors.text },
                        ]}
                      >
                        {opt.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Location / Neighborhood Filter */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                Location / Neighborhood
              </Text>
              <TextInput
                accessibilityLabel="Filter by location"
                placeholder="e.g. Downtown, West End, or zip code…"
                placeholderTextColor={theme.colors.textMuted}
                value={location}
                onChangeText={setLocation}
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
            </View>

            {/* Photo Filter */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Media</Text>
              <View style={styles.chipRow}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setHasPhoto((prev) => !prev)}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: hasPhoto ? theme.colors.primary : theme.colors.bgElevated,
                      borderColor: hasPhoto ? theme.colors.primary : theme.colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      { color: hasPhoto ? theme.colors.primaryFg : theme.colors.text },
                    ]}
                  >
                    📷 Has Photo Only
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* Country Scope */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Search Region</Text>
              <View style={styles.chipRow}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setCountryScope('local')}
                  style={[
                    styles.chip,
                    {
                      backgroundColor:
                        countryScope === 'local' ? theme.colors.primary : theme.colors.bgElevated,
                      borderColor:
                        countryScope === 'local' ? theme.colors.primary : theme.colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      { color: countryScope === 'local' ? theme.colors.primaryFg : theme.colors.text },
                    ]}
                  >
                    📍 Near Me (Local)
                  </Text>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  onPress={() => setCountryScope('global')}
                  style={[
                    styles.chip,
                    {
                      backgroundColor:
                        countryScope === 'global' ? theme.colors.primary : theme.colors.bgElevated,
                      borderColor:
                        countryScope === 'global' ? theme.colors.primary : theme.colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      { color: countryScope === 'global' ? theme.colors.primaryFg : theme.colors.text },
                    ]}
                  >
                    🌍 Worldwide
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
              style={[
                styles.resetBtn,
                { backgroundColor: theme.colors.bgElevated, borderColor: theme.colors.border },
              ]}
            >
              <Text style={[styles.resetText, { color: theme.colors.text }]}>Reset All</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={handleApply}
              style={[styles.applyBtn, { backgroundColor: theme.colors.primary }]}
            >
              <Text style={[styles.applyText, { color: theme.colors.primaryFg }]}>
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
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
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
    fontWeight: '800',
  },
  body: {
    maxHeight: 480,
  },
  bodyContent: {
    padding: 20,
    gap: 20,
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  textInput: {
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
  },
  resetBtn: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 999,
    borderWidth: 1,
    minHeight: 48,
  },
  resetText: {
    fontSize: 15,
    fontWeight: '700',
  },
  applyBtn: {
    flex: 2,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 999,
    minHeight: 48,
  },
  applyText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
