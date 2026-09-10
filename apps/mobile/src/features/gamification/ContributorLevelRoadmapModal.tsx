import React from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {
  type ContributorLevelTier,
  type ContributorProgression,
} from '@expyrico/shared';
import { useTheme } from '../../theme/useTheme';
import { ContributorBadgeIcon } from './ContributorBadgeIcon';

export interface ContributorLevelRoadmapModalProps {
  visible: boolean;
  onClose: () => void;
  levels: readonly ContributorLevelTier[];
  progression: ContributorProgression;
}

export function ContributorLevelRoadmapModal({
  visible,
  onClose,
  levels,
  progression,
}: ContributorLevelRoadmapModalProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: theme.colors.bgElevated,
              borderColor: theme.colors.border,
              paddingBottom: Math.max(insets.bottom, 16),
            },
          ]}
          testID="contributor-roadmap-modal"
        >
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
            <View style={styles.headerTitleContainer}>
              <Text style={[styles.title, { color: theme.colors.text }]}>
                Contributor Levels
              </Text>
              <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>
                Earn points by adding products, photos, and verified edits.
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              style={[styles.closeButton, { backgroundColor: theme.colors.bgGlass }]}
              hitSlop={8}
              accessibilityLabel="Close roadmap"
            >
              <Ionicons name="close" size={20} color={theme.colors.textMuted} />
            </Pressable>
          </View>

          {/* Current Score Banner */}
          <View
            style={[
              styles.currentScoreBanner,
              { backgroundColor: theme.colors.bgGlass, borderColor: theme.colors.border },
            ]}
          >
            <ContributorBadgeIcon
              badgeKey={progression.badgeKey}
              colorToken={progression.colorToken}
              size={36}
            />
            <View style={styles.currentScoreInfo}>
              <Text style={[styles.currentLevelText, { color: theme.colors.text }]}>
                {progression.currentLevel === 0
                  ? 'Level 0 • New Explorer'
                  : `Level ${progression.currentLevel} • ${progression.title}`}
              </Text>
              <Text style={[styles.currentPointsText, { color: theme.colors.primary }]}>
                {progression.totalPoints} total points earned
              </Text>
            </View>
          </View>

          {/* Tier List */}
          <ScrollView
            style={styles.scrollList}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {levels.map((tier) => {
              const isCurrent = progression.currentLevel === tier.level;
              const isUnlocked =
                progression.totalPoints >= tier.minPoints &&
                progression.activeProductsCount >= tier.productsReq;
              const pointsRemaining = Math.max(0, tier.minPoints - progression.totalPoints);
              const prodsRemaining = Math.max(0, tier.productsReq - progression.activeProductsCount);
              const reqText =
                pointsRemaining > 0 && prodsRemaining > 0
                  ? `${pointsRemaining} pts • ${prodsRemaining} prod`
                  : pointsRemaining > 0
                    ? `${pointsRemaining} pts`
                    : `${prodsRemaining} prod`;

              return (
                <View
                  key={tier.level}
                  style={[
                    styles.tierCard,
                    {
                      backgroundColor: isCurrent
                        ? `${theme.colors.primary}12`
                        : theme.colors.bgGlass,
                      borderColor: isCurrent
                        ? theme.colors.primary
                        : theme.colors.border,
                    },
                  ]}
                  testID={`roadmap-tier-${tier.level}`}
                >
                  <View style={styles.tierHeader}>
                    <ContributorBadgeIcon
                      badgeKey={tier.badgeKey}
                      colorToken={tier.colorToken}
                      size={40}
                    />
                    <View style={styles.tierMainInfo}>
                      <View style={styles.tierTitleRow}>
                        <Text
                          style={[
                            styles.tierTitle,
                            { color: theme.colors.text },
                          ]}
                        >
                          Lv {tier.level} • {tier.title}
                        </Text>
                        {isCurrent && (
                          <View
                            style={[
                              styles.currentPill,
                              { backgroundColor: theme.colors.primary },
                            ]}
                          >
                            <Text style={styles.currentPillText}>CURRENT</Text>
                          </View>
                        )}
                      </View>
                      <Text
                        style={[
                          styles.tierRequirements,
                          { color: theme.colors.textMuted },
                        ]}
                      >
                        {tier.minPoints} pts • {tier.productsReq} {tier.productsReq === 1 ? 'product' : 'products'}
                      </Text>
                    </View>
                    <View style={styles.statusIndicator}>
                      {isUnlocked ? (
                        <Ionicons
                          name="checkmark-circle"
                          size={22}
                          color={theme.colors.primary}
                        />
                      ) : (
                        <View style={styles.lockBadge}>
                          <Ionicons
                            name="lock-closed"
                            size={14}
                            color={theme.colors.textMuted}
                          />
                          <Text
                            style={[
                              styles.pointsRemaining,
                              { color: theme.colors.textMuted },
                            ]}
                          >
                            {reqText}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <View
                    style={[
                      styles.perkContainer,
                      { borderTopColor: theme.colors.border },
                    ]}
                  >
                    <Ionicons
                      name="gift-outline"
                      size={14}
                      color={theme.colors.textMuted}
                      style={styles.perkIcon}
                    />
                    <Text
                      style={[
                        styles.perkText,
                        { color: theme.colors.textMuted },
                      ]}
                    >
                      {tier.perks}
                    </Text>
                  </View>
                </View>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    maxHeight: '86%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  headerTitleContainer: {
    flex: 1,
    marginRight: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  currentScoreBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 6,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
  },
  currentScoreInfo: {
    flex: 1,
  },
  currentLevelText: {
    fontSize: 14,
    fontWeight: '700',
  },
  currentPointsText: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 1,
  },
  scrollList: {
    paddingHorizontal: 16,
  },
  scrollContent: {
    paddingVertical: 10,
    gap: 10,
  },
  tierCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
  },
  tierHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  tierMainInfo: {
    flex: 1,
  },
  tierTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tierTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  currentPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  currentPillText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  tierRequirements: {
    fontSize: 12,
    marginTop: 2,
  },
  statusIndicator: {
    alignItems: 'flex-end',
  },
  lockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pointsRemaining: {
    fontSize: 11,
    fontWeight: '600',
  },
  perkContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  perkIcon: {
    marginRight: 6,
  },
  perkText: {
    fontSize: 11,
    flex: 1,
  },
});
