import React from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../../theme/useTheme';

export type DraftSortOption = 'newest' | 'oldest' | 'name_asc' | 'name_desc';

export interface DraftSortItem {
  id: DraftSortOption;
  label: string;
  icon: string;
  accessibilityLabel: string;
}

export const DRAFT_SORT_OPTIONS: DraftSortItem[] = [
  { id: 'newest', label: 'Newest', icon: 'time-outline', accessibilityLabel: 'Sort by newest updated' },
  { id: 'oldest', label: 'Oldest', icon: 'hourglass-outline', accessibilityLabel: 'Sort by oldest updated' },
  { id: 'name_asc', label: 'Name A-Z', icon: 'text-outline', accessibilityLabel: 'Sort alphabetically A to Z' },
  { id: 'name_desc', label: 'Name Z-A', icon: 'text-outline', accessibilityLabel: 'Sort alphabetically Z to A' },
];

export interface DraftsSortPillsProps {
  selectedSort: DraftSortOption;
  onSelectSort: (sort: DraftSortOption) => void;
}

export function DraftsSortPills({
  selectedSort,
  onSelectSort,
}: DraftsSortPillsProps) {
  const theme = useTheme();

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        testID="drafts-sort-pills"
      >
        {DRAFT_SORT_OPTIONS.map((item) => {
          const isSelected = selectedSort === item.id;
          return (
            <Pressable
              key={item.id}
              testID={`drafts-sort-pill-${item.id}`}
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
                size={13}
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
    paddingBottom: 10,
  },
  scrollContent: {
    paddingHorizontal: 20,
    gap: 8,
    flexDirection: 'row',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
  },
  pillIcon: {
    marginRight: 5,
  },
  pillText: {
    fontSize: 12,
  },
});
