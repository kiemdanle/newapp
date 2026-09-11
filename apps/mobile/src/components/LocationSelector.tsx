// apps/mobile/src/components/LocationSelector.tsx
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../theme/useTheme';
import {
  DEFAULT_TOP_LOCATIONS,
  normalizeLocation,
  normalizeLocationTitleCase,
} from '../utils/locations';
import { LocationPickerModal } from './LocationPickerModal';

export interface LocationSelectorProps {
  value?: string | null;
  onChange: (location: string | null) => void;
  label?: string;
  testID?: string;
}

export function LocationSelector({
  value,
  onChange,
  label = 'Location (optional)',
  testID = 'location-selector',
}: LocationSelectorProps) {
  const theme = useTheme();
  const isDark = theme.scheme === 'dark';
  const [modalVisible, setModalVisible] = useState(false);

  const normalizedValue = normalizeLocation(value);
  const isTopLocation = DEFAULT_TOP_LOCATIONS.some(
    (loc) => loc.toLowerCase() === normalizedValue,
  );

  const isAdaptivePillActive = Boolean(normalizedValue && !isTopLocation);
  const adaptivePillLabel = isAdaptivePillActive && value ? value : 'More';
  const handlePillPress = (loc: string) => {
    if (normalizedValue === loc.toLowerCase()) {
      // Tap-to-deselect: clear back to null
      onChange(null);
    } else {
      onChange(normalizeLocationTitleCase(loc));
    }
  };

  return (
    <View testID={testID} style={styles.container}>
      {label ? (
        <Text style={[styles.label, { color: theme.colors.textMuted }]}>
          {label}
        </Text>
      ) : null}

      <View style={styles.pillsRow}>
        {/* Top Quick-Tap Pills (Fridge, Freezer) */}
        {DEFAULT_TOP_LOCATIONS.map((loc) => {
          const isSelected = normalizedValue === loc.toLowerCase();
          return (
            <Pressable
              key={loc}
              testID={`location-pill-${loc.toLowerCase()}`}
              accessibilityRole="button"
              accessibilityLabel={`Location ${loc}`}
              accessibilityState={{ selected: isSelected }}
              onPress={() => handlePillPress(loc)}
              style={({ pressed }) => [
                styles.pill,
                {
                  backgroundColor: isSelected
                    ? theme.colors.primary
                    : isDark
                      ? theme.colors.bgGlass
                      : theme.colors.bgElevated,
                  borderColor: isSelected
                    ? theme.colors.primary
                    : isDark
                      ? theme.colors.border
                      : 'rgba(44, 44, 40, 0.08)',
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <Text
                numberOfLines={1}
                style={[
                  styles.pillText,
                  {
                    color: isSelected ? '#FFFFFF' : theme.colors.text,
                    fontWeight: isSelected ? '700' : '600',
                  },
                ]}
              >
                {loc}
              </Text>
            </Pressable>
          );
        })}
        {/* Adaptive More Pill ("More ▾" / "${value} ▾") */}
        <Pressable
          testID="location-pill-more"
          accessibilityRole="button"
          accessibilityLabel={
            isAdaptivePillActive ? `Selected location ${value}` : 'More locations'
          }
          accessibilityState={{ selected: isAdaptivePillActive }}
          onPress={() => setModalVisible(true)}
          style={({ pressed }) => [
            styles.pill,
            styles.adaptivePill,
            {
              backgroundColor: isAdaptivePillActive
                ? theme.colors.primary
                : isDark
                  ? theme.colors.bgGlass
                  : theme.colors.bgElevated,
              borderColor: isAdaptivePillActive
                ? theme.colors.primary
                : isDark
                  ? theme.colors.border
                  : 'rgba(44, 44, 40, 0.08)',
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <Text
            numberOfLines={1}
            ellipsizeMode="tail"
            style={[
              styles.pillText,
              {
                color: isAdaptivePillActive ? '#FFFFFF' : theme.colors.textMuted,
                fontWeight: isAdaptivePillActive ? '700' : '600',
              },
            ]}
          >
            {adaptivePillLabel}
          </Text>
          <Ionicons
            name="chevron-down"
            size={13}
            color={isAdaptivePillActive ? '#FFFFFF' : theme.colors.textMuted}
            style={styles.chevron}
          />
        </Pressable>
      </View>

      <LocationPickerModal
        visible={modalVisible}
        currentLocation={value}
        onSelect={(loc) => {
          onChange(loc ? normalizeLocationTitleCase(loc) : null);
          setModalVisible(false);
        }}
        onClose={() => setModalVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
  },
  pillsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  pill: {
    flex: 1,
    minHeight: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  adaptivePill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 8,
  },
  pillText: {
    fontSize: 14,
  },
  chevron: {
    marginTop: 1,
  },
});
