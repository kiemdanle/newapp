import React from 'react';
import { ActivityIndicator, Dimensions, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { useTheme } from '../../theme/useTheme';
import { SkeletonBone } from './SkeletonBone';
import { SkeletonShimmer } from './SkeletonShimmer';
export interface ProductDetailSkeletonProps {
  style?: StyleProp<ViewStyle>;
  pointerEvents?: 'box-none' | 'none' | 'box-only' | 'auto';
  testID?: string;
}

const INITIAL_WIDTH = Math.min(Dimensions.get('window').width - 32, 540);

export function ProductDetailSkeleton({
  style,
  pointerEvents,
  testID = 'product-detail-skeleton',
}: ProductDetailSkeletonProps) {
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
        {/* 4:3 Edge-to-Edge Hero Image Bone with Placeholder Icon */}
        <View style={styles.heroContainer}>
          <View
            style={[
              styles.heroBox,
              {
                height: Math.min(540, Math.round(INITIAL_WIDTH * 0.75)),
                backgroundColor: theme.colors.neutralLight,
              },
            ]}
          >
            <View
              style={[
                styles.spinnerBadge,
                { backgroundColor: theme.colors.bgGlass },
              ]}
            >
              <ActivityIndicator size="large" color={theme.colors.primary} />
            </View>
          </View>
        </View>

        {/* Content Body */}
        <View style={[styles.body, { gap: theme.spacing.md }]}>
          {/* Brand Bone */}
          <SkeletonBone
            width="35%"
            height={14}
            borderRadius={3}
          />

          {/* Title Bone */}
          <SkeletonBone
            width="80%"
            height={26}
            borderRadius={4}
          />

          {/* Barcode / Category Row */}
          <View style={styles.row}>
            <SkeletonBone
              width="40%"
              height={18}
              borderRadius={theme.radii.pill}
            />
            <SkeletonBone
              width="30%"
              height={18}
              borderRadius={theme.radii.pill}
            />
          </View>

          {/* Details / Nutrition Card */}
          <View
            style={[
              styles.card,
              {
                backgroundColor: theme.colors.bgElevated,
                borderColor: theme.colors.border,
                borderRadius: theme.radii.md,
                padding: 16,
                marginTop: 8,
              },
            ]}
          >
            <SkeletonBone
              width="45%"
              height={18}
              borderRadius={3}
              style={{ marginBottom: 12 }}
            />
            <SkeletonBone
              width="100%"
              height={14}
              borderRadius={3}
              style={{ marginBottom: 8 }}
            />
            <SkeletonBone
              width="70%"
              height={14}
              borderRadius={3}
            />
          </View>

          {/* Community Reviews Breakdown Card */}
          <View
            style={[
              styles.card,
              {
                backgroundColor: theme.colors.bgElevated,
                borderColor: theme.colors.border,
                borderRadius: theme.radii.md,
                padding: 16,
                marginTop: 8,
              },
            ]}
          >
            <SkeletonBone
              testID="product-detail-review-bone"
              width="50%"
              height={20}
              borderRadius={4}
              style={{ marginBottom: 12 }}
            />
            <View style={styles.row}>
              <SkeletonBone width="25%" height={32} borderRadius={theme.radii.sm} />
              <SkeletonBone width="65%" height={32} borderRadius={theme.radii.sm} />
            </View>
          </View>

          {/* Action Buttons Row */}
          <View style={styles.actionRow}>
            <SkeletonBone
              width="100%"
              height={48}
              borderRadius={theme.radii.md}
            />
          </View>
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
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 24,
    gap: 0,
  },
  heroContainer: {
    width: '100%',
  },
  heroBox: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spinnerBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
  body: {
    width: '100%',
    padding: 16,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  card: {
    borderWidth: 1,
  },
  actionRow: {
    marginTop: 12,
  },
});
