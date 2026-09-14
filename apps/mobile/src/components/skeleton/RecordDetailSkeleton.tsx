import React from 'react';
import { Dimensions, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { useTheme } from '../../theme/useTheme';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { SkeletonBone } from './SkeletonBone';
import { SkeletonShimmer } from './SkeletonShimmer';
export interface RecordDetailSkeletonProps {
  style?: StyleProp<ViewStyle>;
  pointerEvents?: 'box-none' | 'none' | 'box-only' | 'auto';
  testID?: string;
}

const INITIAL_WIDTH = Math.min(Dimensions.get('window').width - 32, 540);

export function RecordDetailSkeleton({
  style,
  pointerEvents,
  testID = 'record-detail-skeleton',
}: RecordDetailSkeletonProps) {
  const theme = useTheme();

  return (
    <View
      testID={testID}
      pointerEvents={pointerEvents}
      style={[
        styles.root,
        { backgroundColor: theme.colors.bg },
        style,
      ]}
    >
      <SkeletonShimmer style={styles.scrollContent}>
        {/* 4:3 Responsive Hero Image Bone with Placeholder Icon */}
        <View style={styles.heroContainer}>
          <View
            style={[
              styles.heroBox,
              {
                height: Math.round(INITIAL_WIDTH * 0.75),
                backgroundColor: theme.colors.neutralLight,
                borderRadius: theme.radii.lg,
              },
            ]}
          >
            <Ionicons
              name="basket-outline"
              size={56}
              color={theme.colors.textMuted}
              style={{ opacity: 0.6 }}
            />
          </View>
        </View>
        {/* Title Block Card */}
        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.colors.bgElevated,
              borderColor: theme.colors.border,
              borderRadius: theme.radii.md,
              padding: 16,
            },
          ]}
        >
          {/* Brand Bone */}
          <SkeletonBone
            width="35%"
            height={12}
            borderRadius={3}
            style={{ marginBottom: 8 }}
          />

          {/* Title Bone */}
          <SkeletonBone
            width="75%"
            height={24}
            borderRadius={4}
            style={{ marginBottom: 10 }}
          />

          {/* Metadata Row */}
          <View style={styles.row}>
            <SkeletonBone
              width="30%"
              height={16}
              borderRadius={3}
            />
            <SkeletonBone
              width="25%"
              height={16}
              borderRadius={3}
            />
          </View>
        </View>

        {/* Expiry Card Bone */}
        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.colors.bgElevated,
              borderColor: theme.colors.border,
              borderRadius: theme.radii.md,
              padding: 16,
            },
          ]}
        >
          <SkeletonBone
            width="45%"
            height={20}
            borderRadius={theme.radii.pill}
            style={{ marginBottom: 10 }}
          />
          <SkeletonBone
            width="60%"
            height={14}
            borderRadius={3}
          />
        </View>

        {/* Details / Location / Store / Notes Card */}
        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.colors.bgElevated,
              borderColor: theme.colors.border,
              borderRadius: theme.radii.md,
              padding: 16,
            },
          ]}
        >
          <SkeletonBone
            testID="record-detail-location-bone"
            width="40%"
            height={16}
            borderRadius={theme.radii.pill}
            style={{ marginBottom: 10 }}
          />
          <SkeletonBone
            testID="record-detail-store-bone"
            width="55%"
            height={14}
            borderRadius={3}
            style={{ marginBottom: 10 }}
          />
          <SkeletonBone
            testID="record-detail-notes-bone"
            width="85%"
            height={14}
            borderRadius={3}
          />
        </View>

        {/* Action Strip Bone */}
        <View style={styles.actionRow}>
          <SkeletonBone
            width="48%"
            height={48}
            borderRadius={theme.radii.md}
          />
          <SkeletonBone
            width="48%"
            height={48}
            borderRadius={theme.radii.md}
          />
        </View>
      </SkeletonShimmer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    width: '100%',
  },
  scrollContent: {
    padding: 16,
    gap: 14,
  },
  heroContainer: {
    width: '100%',
  },
  heroBox: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    borderWidth: 1,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
});
