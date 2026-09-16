import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { DraftCardSkeleton, SkeletonShimmer } from '../../components/skeleton';

export interface ProductDraftsSkeletonProps {
  viewMode?: 'list' | 'grid';
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function ProductDraftsSkeleton({
  viewMode = 'list',
  style,
  testID = 'product-drafts-skeleton',
}: ProductDraftsSkeletonProps) {
  return (
    <View testID={testID} style={[styles.container, style]}>
      <SkeletonShimmer>
        {viewMode === 'grid' ? (
          <View style={styles.gridContainer}>
            {[0, 1, 2].map((rowIndex) => (
              <View key={`draft-grid-row-${rowIndex}`} style={styles.gridRow}>
                <DraftCardSkeleton
                  viewMode="grid"
                  testID={`draft-grid-skeleton-${rowIndex * 2}`}
                />
                <DraftCardSkeleton
                  viewMode="grid"
                  testID={`draft-grid-skeleton-${rowIndex * 2 + 1}`}
                />
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.listContainer}>
            {[0, 1, 2, 3, 4].map((index) => (
              <DraftCardSkeleton
                key={`draft-row-skeleton-${index}`}
                viewMode="list"
                testID={`draft-row-skeleton-${index}`}
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
    gap: 10,
  },
  gridContainer: {
    gap: 12,
  },
  gridRow: {
    flexDirection: 'row',
    gap: 12,
  },
});
