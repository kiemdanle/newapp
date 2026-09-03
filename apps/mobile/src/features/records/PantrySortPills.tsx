// apps/mobile/src/features/records/PantrySortPills.tsx
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../../theme/useTheme';
import { PANTRY_SORT_OPTIONS, type PantrySortOption } from './pantryFilterTypes';

export interface PantrySortPillsProps {
  selectedSort: PantrySortOption;
  onSelectSort: (sort: PantrySortOption) => void;
}

export function PantrySortPills({ selectedSort, onSelectSort }: PantrySortPillsProps) {
  const theme = useTheme();

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        testID="pantry-sort-pills"
      >
        {PANTRY_SORT_OPTIONS.map((item) => {
          const isSelected = selectedSort === item.id;
          return (
            <Pressable
              key={item.id}
              testID={`pantry-sort-pill-${item.id}`}
              accessibilityRole="button"
              accessibilityLabel={item.accessibilityLabel}
              accessibilityState={{ selected: isSelected }}
              onPress={() => onSelectSort(item.id)}
              style={({ pressed }) => [
                styles.pill,
                {
                  backgroundColor: isSelected
                    ? theme.colors.primaryLight
                    : theme.colors.bgElevated,
                  borderColor: isSelected
                    ? theme.colors.primary
                    : theme.colors.border,
                  borderRadius: theme.radii.pill,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <Ionicons
                name={item.icon}
                size={14}
                color={isSelected ? theme.colors.primaryDark : theme.colors.textMuted}
                style={styles.pillIcon}
              />
              <Text
                style={[
                  styles.pillText,
                  {
                    color: isSelected
                      ? theme.colors.primaryDark
                      : theme.colors.textMuted,
                    fontWeight: isSelected ? '700' : '500',
                  },
                ]}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
  },
  scrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 2,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
  },
  pillIcon: {
    marginRight: 6,
  },
  pillText: {
    fontSize: 13,
  },
});
