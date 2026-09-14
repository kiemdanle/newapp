import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import {
  PantryGridCardSkeleton,
  RecordCardSkeleton,
  SkeletonShimmer,
} from '../../components/skeleton';

export interface PantryListSkeletonProps {
  viewMode?: 'list' | 'grid';
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function PantryListSkeleton({
  viewMode = 'list',
  style,
  testID = 'pantry-list-skeleton',
}: PantryListSkeletonProps) {
  return (
    <View testID={testID} style={[styles.container, style]}>
      <SkeletonShimmer>
        {viewMode === 'grid' ? (
          <View style={styles.gridContainer}>
            {/* 3 rows of 2 cards = 6 cards total */}
            {[0, 1, 2].map((rowIndex) => (
              <View key={`grid-row-${rowIndex}`} style={styles.gridRow}>
                <PantryGridCardSkeleton testID={`pantry-grid-skeleton-${rowIndex * 2}`} />
                <PantryGridCardSkeleton testID={`pantry-grid-skeleton-${rowIndex * 2 + 1}`} />
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.listContainer}>
            {/* 5 items stacked */}
            {[0, 1, 2, 3, 4].map((index) => (
              <RecordCardSkeleton
                key={`record-skeleton-${index}`}
                testID={`record-card-skeleton-${index}`}
              />
            ))}
          </View>
        )}
      </SkeletonShimmer>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  listContainer: {
    gap: 8,
  },
  gridContainer: {
    gap: 12,
  },
  gridRow: {
    flexDirection: 'row',
    gap: 12,
  },
});
