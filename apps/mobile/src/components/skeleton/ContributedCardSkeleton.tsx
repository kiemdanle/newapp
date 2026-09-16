import React from 'react';
import { ActivityIndicator, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { useTheme } from '../../theme/useTheme';
import { SkeletonBone } from './SkeletonBone';

export interface ContributedCardSkeletonProps {
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function ContributedCardSkeleton({ style, testID }: ContributedCardSkeletonProps) {
  const theme = useTheme();

  return (
    <View
      testID={testID}
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.bgElevated,
          borderColor: theme.colors.border,
          shadowColor: theme.colors.neutralDark,
          borderRadius: theme.radii.md,
          padding: theme.spacing.md,
        },
        style,
      ]}
    >
      {/* 48x48 Squircle Thumbnail Bone with Centered Spinner Badge */}
      <View
        style={[
          styles.thumbnailBox,
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
            styles.spinnerBadge,
            { backgroundColor: theme.colors.bgGlass },
          ]}
        >
          <ActivityIndicator size="small" color={theme.colors.primary} />
        </View>
      </View>

      {/* Middle Text Details */}
      <View style={styles.details}>
        <SkeletonBone
          testID="contributed-card-title-skeleton"
          width="65%"
          height={15}
          borderRadius={4}
          style={{ marginBottom: 6 }}
        />
        <SkeletonBone
          testID="contributed-card-subtitle-skeleton"
          width="45%"
          height={12}
          borderRadius={3}
          style={{ marginBottom: 4 }}
        />
        <SkeletonBone
          testID="contributed-card-barcode-skeleton"
          width="30%"
          height={10}
          borderRadius={3}
        />
      </View>

      {/* Right Status Pill Bone */}
      <SkeletonBone
        testID="contributed-card-status-skeleton"
        width={75}
        height={22}
        borderRadius={theme.radii.sm}
        style={styles.pill}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    minHeight: 76,
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  thumbnailBox: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  spinnerBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  details: {
    flex: 1,
    justifyContent: 'center',
  },
  pill: {
    marginLeft: 8,
  },
});
