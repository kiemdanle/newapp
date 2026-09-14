import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
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
      {/* 52x52 Squircle Thumbnail Bone */}
      <SkeletonBone
        width={52}
        height={52}
        borderRadius={theme.radii.sm}
        style={{ marginRight: theme.spacing.md }}
      />

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
  pill: {
    marginLeft: 8,
  },
});
