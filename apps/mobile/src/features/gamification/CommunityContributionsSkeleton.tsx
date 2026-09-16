import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { ContributedCardSkeleton, SkeletonShimmer } from '../../components/skeleton';

export interface CommunityContributionsSkeletonProps {
  style?: StyleProp<ViewStyle>;
  testID?: string;
  count?: number;
}

export function CommunityContributionsSkeleton({
  style,
  testID = 'community-contributions-skeleton',
  count = 5,
}: CommunityContributionsSkeletonProps) {
  return (
    <View testID={testID} style={[styles.container, style]}>
      <SkeletonShimmer style={styles.list}>
        {Array.from({ length: count }, (_, index) => (
          <ContributedCardSkeleton
            key={`contributed-skeleton-${index}`}
            testID={`contributed-card-skeleton-${index}`}
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
    gap: 10,
  },
});
