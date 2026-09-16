import React from 'react';
import { ActivityIndicator, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { useTheme } from '../../theme/useTheme';
import { SkeletonBone } from './SkeletonBone';

export interface DraftCardSkeletonProps {
  viewMode?: 'list' | 'grid';
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function DraftCardSkeleton({
  viewMode = 'list',
  style,
  testID,
}: DraftCardSkeletonProps) {
  const theme = useTheme();

  if (viewMode === 'grid') {
    return (
      <View
        testID={testID}
        style={[
          styles.gridCard,
          {
            backgroundColor: theme.colors.bgElevated,
            borderColor: theme.colors.border,
            borderRadius: theme.radii.md,
          },
          style,
        ]}
      >
        {/* Top Header Row: Status Badge Bone */}
        <View style={styles.gridTopRow}>
          <SkeletonBone
            testID="draft-grid-status-skeleton"
            width={65}
            height={18}
            borderRadius={theme.radii.sm}
          />
        </View>

        {/* Center Product Image Bone */}
        <View style={styles.gridImageWrapper}>
          <View
            style={[
              styles.gridThumbnailBox,
              {
                width: 80,
                height: 80,
                borderRadius: theme.radii.sm,
                backgroundColor: theme.colors.neutralLight,
              },
            ]}
          >
            <View
              style={[
                styles.gridSpinnerBadge,
                { backgroundColor: theme.colors.bgGlass },
              ]}
            >
              <ActivityIndicator size="small" color={theme.colors.primary} />
            </View>
          </View>
        </View>

        {/* Bottom Details */}
        <View style={styles.gridDetails}>
          <SkeletonBone
            testID="draft-grid-title-skeleton"
            width="80%"
            height={14}
            borderRadius={3}
            style={{ marginBottom: 4 }}
          />
          <SkeletonBone
            testID="draft-grid-subtitle-skeleton"
            width="50%"
            height={11}
            borderRadius={3}
          />
        </View>
      </View>
    );
  }

  return (
    <View
      testID={testID}
      style={[
        styles.listCard,
        {
          backgroundColor: theme.colors.bgElevated,
          borderColor: theme.colors.border,
          borderRadius: theme.radii.md,
          padding: theme.spacing.md,
        },
        style,
      ]}
    >
      {/* 48x48 Squircle Thumbnail Bone with Centered Spinner Badge */}
      <View
        style={[
          styles.listThumbnailBox,
          {
            width: 48,
            height: 48,
            borderRadius: theme.radii.sm,
            backgroundColor: theme.colors.neutralLight,
            marginRight: theme.spacing.md,
          },
        ]}
      >
        <View
          style={[
            styles.listSpinnerBadge,
            { backgroundColor: theme.colors.bgGlass },
          ]}
        >
          <ActivityIndicator size="small" color={theme.colors.primary} />
        </View>
      </View>

      {/* Middle Details */}
      <View style={styles.listDetails}>
        <SkeletonBone
          testID="draft-list-title-skeleton"
          width="60%"
          height={16}
          borderRadius={4}
          style={{ marginBottom: 6 }}
        />
        <SkeletonBone
          testID="draft-list-subtitle-skeleton"
          width="40%"
          height={12}
          borderRadius={3}
        />
      </View>

      {/* Right Status Badge */}
      <SkeletonBone
        testID="draft-list-status-skeleton"
        width={75}
        height={20}
        borderRadius={theme.radii.sm}
        style={styles.listPill}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  listCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    minHeight: 76,
  },
  listThumbnailBox: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  listSpinnerBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listDetails: {
    flex: 1,
    justifyContent: 'center',
  },
  listPill: {
    marginLeft: 8,
  },
  gridCard: {
    flex: 1,
    padding: 12,
    borderWidth: 1,
    minHeight: 200,
    justifyContent: 'space-between',
  },
  gridTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  gridImageWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  gridThumbnailBox: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  gridSpinnerBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridDetails: {
    gap: 2,
    marginTop: 4,
  },
});
