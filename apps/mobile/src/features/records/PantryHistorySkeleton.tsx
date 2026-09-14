import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { RecordCardSkeleton, SkeletonShimmer } from '../../components/skeleton';

export interface PantryHistorySkeletonProps {
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function PantryHistorySkeleton({
  style,
  testID = 'pantry-history-skeleton',
}: PantryHistorySkeletonProps) {
  return (
    <View testID={testID} style={[styles.container, style]}>
      <SkeletonShimmer style={styles.list}>
        {[0, 1, 2, 3, 4].map((index) => (
          <RecordCardSkeleton
            key={`history-skeleton-${index}`}
            testID={`history-record-skeleton-${index}`}
          />
        ))}
      </SkeletonShimmer>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  list: {
    gap: 8,
  },
});
