import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../theme/useTheme';
import { usePantryTopUnits, normalizeUnit } from '../utils/units';
import { UnitPickerModal } from './UnitPickerModal';

export interface UnitSelectorProps {
  value: string;
  onChange: (unit: string) => void;
  label?: string;
  testID?: string;
}

export function UnitSelector({
  value,
  onChange,
  label = 'Unit',
  testID = 'unit-selector',
}: UnitSelectorProps) {
  const theme = useTheme();
  const topUnits = usePantryTopUnits();
  const [modalVisible, setModalVisible] = useState(false);

  const normalizedValue = normalizeUnit(value);
  const isTop4 = topUnits.some((u) => u.toLowerCase() === normalizedValue);

  const fifthPillLabel = isTop4 ? 'More' : value;
  const isFifthPillActive = !isTop4;

  return (
    <View testID={testID} style={styles.container}>
      {label ? (
        <Text style={[styles.label, { color: theme.colors.textMuted }]}>
          {label}
        </Text>
      ) : null}

      <View style={styles.pillsRow}>
        {/* Top 4 One-Tap Pills */}
        {topUnits.slice(0, 4).map((u) => {
          const isSelected = normalizedValue === u.toLowerCase();
          return (
            <Pressable
              key={u}
              testID={`unit-pill-${u.replace(/\s+/g, '-')}`}
              accessibilityRole="button"
              accessibilityLabel={`Unit ${u}`}
              accessibilityState={{ selected: isSelected }}
              onPress={() => onChange(u)}
              style={({ pressed }) => [
                styles.pill,
                {
                  backgroundColor: isSelected
                    ? theme.colors.primary
                    : theme.colors.bgGlass,
                  borderColor: isSelected
                    ? theme.colors.primary
                    : theme.colors.border,
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
                {u}
              </Text>
            </Pressable>
          );
        })}

        {/* 5th Adaptive Pill ("More ▾" / "${value} ▾") */}
        <Pressable
          testID="unit-pill-more"
          accessibilityRole="button"
          accessibilityLabel={isFifthPillActive ? `Selected unit ${value}` : 'More units'}
          accessibilityState={{ selected: isFifthPillActive }}
          onPress={() => setModalVisible(true)}
          style={({ pressed }) => [
            styles.pill,
            styles.fifthPill,
            {
              backgroundColor: isFifthPillActive
                ? theme.colors.primary
                : theme.colors.bgGlass,
              borderColor: isFifthPillActive
                ? theme.colors.primary
                : theme.colors.border,
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

      <UnitPickerModal
        visible={modalVisible}
        currentUnit={value}
        onClose={() => setModalVisible(false)}
        onSelect={onChange}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  pillsRow: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  pill: {
    flex: 1,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  fifthPill: {
    flexDirection: 'row',
    gap: 3,
  },
  pillText: {
    fontSize: 13,
  },
  chevron: {
    marginLeft: 1,
  },
});
