import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { useTheme } from '../../theme/useTheme';
import { SkeletonBone } from './SkeletonBone';

export interface PantryGridCardSkeletonProps {
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function PantryGridCardSkeleton({ style, testID }: PantryGridCardSkeletonProps) {
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
        },
        style,
      ]}
    >
      <View style={styles.content}>
        {/* Top Row: Qty Pill & More Trigger */}
        <View style={styles.topRow}>
          <SkeletonBone
            width={48}
            height={18}
            borderRadius={8}
          />
          <SkeletonBone
            width={18}
            height={18}
            borderRadius={9}
          />
        </View>

        {/* 72x72 Centered Thumbnail Bone */}
        <View style={styles.thumbnailContainer}>
          <SkeletonBone
            width={72}
            height={72}
            borderRadius={theme.radii.sm}
          />
        </View>

        {/* Details Container */}
        <View style={styles.detailsContainer}>
          {/* Brand Bone */}
          <SkeletonBone
            width="40%"
            height={10}
            borderRadius={3}
            style={{ marginBottom: 4 }}
          />

          {/* 36px Title Block (Two lines) */}
          <View style={styles.titleBlock}>
            <SkeletonBone
              width="90%"
              height={14}
              borderRadius={3}
              style={{ marginBottom: 4 }}
            />
            <SkeletonBone
              width="55%"
              height={14}
              borderRadius={3}
            />
          </View>

          {/* Footer Metadata */}
          <View style={styles.footer}>
            <SkeletonBone
              width="65%"
              height={14}
              borderRadius={theme.radii.pill}
            />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
    minHeight: 210,
  },
  content: {
    flex: 1,
    padding: 12,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 24,
  },
  thumbnailContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 8,
  },
  detailsContainer: {
    flex: 1,
    justifyContent: 'space-between',
    marginTop: 2,
  },
  titleBlock: {
    minHeight: 36,
    justifyContent: 'center',
  },
  footer: {
    marginTop: 'auto',
    paddingTop: 6,
  },
});
