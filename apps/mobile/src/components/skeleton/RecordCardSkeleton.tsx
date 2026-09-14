import React from 'react';
import { ActivityIndicator, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { useTheme } from '../../theme/useTheme';
import { SkeletonBone } from './SkeletonBone';

export interface RecordCardSkeletonProps {
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function RecordCardSkeleton({ style, testID }: RecordCardSkeletonProps) {
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
      {/* 52x52 Squircle Thumbnail Bone with Centered Spinner Badge */}
      <View
        style={[
          styles.thumbnailBox,
          {
            width: 52,
            height: 52,
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
          width="35%"
          height={10}
          borderRadius={3}
          style={{ marginBottom: 6 }}
        />
        <SkeletonBone
          width="65%"
          height={16}
          borderRadius={4}
          style={{ marginBottom: 6 }}
        />
        <SkeletonBone
          width="45%"
          height={12}
          borderRadius={3}
        />
      </View>

      {/* Right Action / Expiry Pill Bone */}
      <SkeletonBone
        width={70}
        height={22}
        borderRadius={theme.radii.pill}
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
  details: {
    flex: 1,
    justifyContent: 'center',
  },
  thumbnailBox: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  spinnerBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: {
    marginLeft: 8,
  },
});
