import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {
  type UserContributionsResponse,
} from '@expyrico/shared';
import { useTheme } from '../../theme/useTheme';
import { ContributorBadgeIcon } from './ContributorBadgeIcon';
import { ContributorLevelRoadmapModal } from './ContributorLevelRoadmapModal';

export interface ContributorHeroCardProps {
  data: UserContributionsResponse | undefined;
  isLoading?: boolean;
}

export function ContributorHeroCard({ data, isLoading }: ContributorHeroCardProps) {
  const theme = useTheme();
  const [roadmapVisible, setRoadmapVisible] = useState(false);

  const targetPercent = data && data.enabled !== false ? data.progression.progressPercent : 0;
  const animatedProgress = useRef(new Animated.Value(targetPercent)).current;

  useEffect(() => {
    const anim = Animated.timing(animatedProgress, {
      toValue: targetPercent,
      duration: 400,
      useNativeDriver: false,
    });
    anim.start();
    return () => {
      anim.stop();
    };
  }, [animatedProgress, targetPercent]);

  // If disabled by Admin toggle or data missing, gracefully do not render gamification card
  if (!data || data.enabled === false) {
    return null;
  }

  const { progression, levels } = data;

  const widthInterpolated = animatedProgress.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
    extrapolate: 'clamp',
  });
  let subtitle = '';
  if (progression.isMaxLevel) {
    subtitle = '🏆 Maximum Level Reached • Expyrico Champion';
  } else if (progression.currentLevel === 0) {
    subtitle = `${progression.pointsToNextLevel} pts • Add your first product to reach Level 1!`;
  } else {
    const nextTierTitle = levels.find((l) => l.level === progression.nextLevel)?.title ?? 'Next Tier';
    const prodCount = progression.productsToNextLevel;
    subtitle = `${prodCount} more ${prodCount === 1 ? 'product' : 'products'} to Level ${progression.nextLevel} ${nextTierTitle}!`;
  }

  // Progress text (e.g. "180 / 300 pts")
  const pointsText = progression.isMaxLevel
    ? `${progression.totalPoints.toLocaleString()} pts`
    : `${progression.totalPoints} / ${progression.nextLevelMinPoints ?? 10} pts`;

  return (
    <>
      <Pressable
        onPress={() => setRoadmapVisible(true)}
        style={({ pressed }) => [
          styles.container,
          {
            backgroundColor: theme.colors.bgElevated,
            borderColor: theme.colors.border,
            opacity: pressed ? 0.92 : 1,
          },
        ]}
        testID="contributor-hero-card"
        accessibilityLabel="Community contributor level details"
        accessibilityRole="button"
      >
        <View style={styles.contentRow}>
          <ContributorBadgeIcon
            badgeKey={progression.badgeKey}
            colorToken={progression.colorToken}
            size={52}
          />

          <View style={styles.infoContainer}>
            {/* Title Row */}
            <View style={styles.titleRow}>
              <View
                style={[
                  styles.levelBadge,
                  { backgroundColor: `${progression.colorHex}22` },
                ]}
              >
                <Text
                  style={[
                    styles.levelBadgeText,
                    { color: progression.colorHex },
                  ]}
                >
                  {progression.currentLevel === 0
                    ? 'NEW'
                    : `LVL ${progression.currentLevel}`}
                </Text>
              </View>

              <Text
                style={[styles.tierTitle, { color: theme.colors.text }]}
                numberOfLines={1}
              >
                {progression.title}
              </Text>

              <Ionicons
                name="chevron-forward"
                size={16}
                color={theme.colors.textMuted}
                style={styles.chevron}
              />
            </View>

            {/* Points & Progress Meter */}
            <View style={styles.meterContainer}>
              <View style={styles.pointsRow}>
                <Text
                  style={[
                    styles.motivationText,
                    { color: theme.colors.textMuted },
                  ]}
                  numberOfLines={1}
                >
                  {subtitle}
                </Text>
                <Text
                  style={[
                    styles.pointsCounter,
                    { color: theme.colors.text },
                  ]}
                >
                  {pointsText}
                </Text>
              </View>

              {/* Progress Bar Track */}
              <View
                style={[
                  styles.progressTrack,
                  { backgroundColor: theme.colors.bgGlass },
                ]}
              >
                <Animated.View
                  style={[
                    styles.progressFill,
                    {
                      width: widthInterpolated,
                      backgroundColor: progression.isMaxLevel
                        ? theme.colors.primary
                        : progression.progressPercent >= 75
                          ? '#F5A623' // Honey
                          : theme.colors.primary, // Fresh Sage
                    },
                  ]}
                  testID="contributor-progress-fill"
                />
              </View>
            </View>
          </View>
        </View>
      </Pressable>

      <ContributorLevelRoadmapModal
        visible={roadmapVisible}
        onClose={() => setRoadmapVisible(false)}
        levels={levels}
        progression={progression}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    marginVertical: 4,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  infoContainer: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  levelBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  levelBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  tierTitle: {
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
  },
  chevron: {
    marginLeft: 2,
  },
  meterContainer: {
    marginTop: 8,
  },
  pointsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  motivationText: {
    fontSize: 11,
    fontWeight: '500',
    flex: 1,
    marginRight: 8,
  },
  pointsCounter: {
    fontSize: 11,
    fontWeight: '700',
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
});
