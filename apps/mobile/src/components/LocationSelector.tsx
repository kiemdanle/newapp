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
  const [modalVisible, setModalVisible] = useState(false);

  const normalizedValue = normalizeLocation(value);
  const isTop4 = DEFAULT_TOP_LOCATIONS.some(
    (loc) => loc.toLowerCase() === normalizedValue,
  );

  const isFifthPillActive = Boolean(normalizedValue && !isTop4);
  const fifthPillLabel = isFifthPillActive && value ? value : 'More';

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
        {/* Top 4 Quick-Tap Pills */}
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
                    : theme.colors.bgElevated,
                  borderColor: isSelected
                    ? theme.colors.primary
                    : theme.colors.neutralMid,
                  opacity: pressed ? 0.82 : 1,
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

        {/* 5th Adaptive Pill ("More ▾" / "${value} ▾") */}
        <Pressable
          testID="location-pill-more"
          accessibilityRole="button"
          accessibilityLabel={
            isFifthPillActive ? `Selected location ${value}` : 'More locations'
          }
          accessibilityState={{ selected: isFifthPillActive }}
          onPress={() => setModalVisible(true)}
          style={({ pressed }) => [
            styles.pill,
            styles.fifthPill,
            {
              backgroundColor: isFifthPillActive
                ? theme.colors.primary
                : theme.colors.bgElevated,
              borderColor: isFifthPillActive
                ? theme.colors.primary
                : theme.colors.neutralMid,
              opacity: pressed ? 0.82 : 1,
            },
          ]}
        >
          <Text
            numberOfLines={1}
            ellipsizeMode="tail"
            style={[
              styles.pillText,
              {
                color: isFifthPillActive ? '#FFFFFF' : theme.colors.textMuted,
                fontWeight: isFifthPillActive ? '700' : '600',
              },
            ]}
          >
            {fifthPillLabel}
          </Text>
          <Ionicons
            name="chevron-down"
            size={12}
            color={isFifthPillActive ? '#FFFFFF' : theme.colors.textMuted}
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
    gap: 6,
  },
  pill: {
    flex: 1,
    minHeight: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  fifthPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingHorizontal: 6,
  },
  pillText: {
    fontSize: 13,
  },
  chevron: {
    marginTop: 1,
  },
});
