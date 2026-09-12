import React, { useCallback, useEffect, useRef } from 'react';
import {
  Animated,
  Modal,
  PanResponder,
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
  const translateY = useRef(new Animated.Value(600)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const isClosingRef = useRef(false);

  useEffect(() => {
    if (visible) {
      isClosingRef.current = false;
      translateY.setValue(600);
      backdropOpacity.setValue(0);
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          bounciness: 3,
          speed: 16,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 160,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, translateY, backdropOpacity]);

  const handleDismiss = useCallback(() => {
    if (isClosingRef.current) return;
    isClosingRef.current = true;
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 600,
        duration: 130,
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 130,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose();
      isClosingRef.current = false;
    });
  }, [onClose, translateY, backdropOpacity]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_evt, gestureState) => {
        return gestureState.dy > 4 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
      },
      onMoveShouldSetPanResponderCapture: (_evt, gestureState) => {
        return gestureState.dy > 4 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
      },
      onPanResponderMove: (_evt, gestureState) => {
        if (gestureState.dy > 0) {
          translateY.setValue(gestureState.dy);
        } else {
          translateY.setValue(gestureState.dy * 0.15);
        }
      },
      onPanResponderRelease: (_evt, gestureState) => {
        if (gestureState.dy > 45 || gestureState.vy > 0.3) {
          handleDismiss();
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            bounciness: 4,
            speed: 16,
            useNativeDriver: true,
          }).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(translateY, {
          toValue: 0,
          bounciness: 4,
          speed: 14,
          useNativeDriver: true,
        }).start();
      },
    }),
  ).current;

  return (
    <Modal
      visible={visible}
      animationType="none"
      transparent
      onRequestClose={handleDismiss}
    >
      <Animated.View style={[styles.overlay, { opacity: backdropOpacity }]}>
        <Pressable style={styles.backdrop} onPress={handleDismiss} />
        <Animated.View
          style={[
            styles.sheet,
            {
              backgroundColor: theme.colors.bgElevated,
              borderColor: theme.colors.border,
              paddingBottom: Math.max(insets.bottom, 16),
              transform: [{ translateY }],
            },
          ]}
          testID="contributor-roadmap-modal"
        >
          {/* Drag Handle & Header Area with PanResponder */}
          <View {...panResponder.panHandlers} collapsable={false}>
            <View style={styles.handleBar}>
              <View
                style={[
                  styles.handlePill,
                  {
                    backgroundColor:
                      theme.scheme === 'dark'
                        ? 'rgba(255, 255, 255, 0.22)'
                        : 'rgba(44, 44, 40, 0.20)',
                  },
                ]}
              />
            </View>
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
                onPress={handleDismiss}
                style={[styles.closeButton, { backgroundColor: theme.colors.bgGlass }]}
                hitSlop={8}
                accessibilityLabel="Close roadmap"
              >
                <Ionicons name="close" size={20} color={theme.colors.textMuted} />
              </Pressable>
            </View>
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
                    isCurrent ? styles.currentTierCard : styles.regularTierCard,
                    {
                      backgroundColor: isCurrent
                        ? theme.scheme === 'dark'
                          ? '#15241C'
                          : '#F0F9F5'
                        : theme.scheme === 'dark'
                        ? 'rgba(255, 255, 255, 0.03)'
                        : 'rgba(0, 0, 0, 0.02)',
                      borderColor: isCurrent
                        ? theme.scheme === 'dark'
                          ? '#4BAE8A'
                          : '#3A8F6F'
                        : theme.colors.border,
                    },
                    isCurrent && (theme.scheme === 'dark' ? styles.currentCardGlowDark : styles.currentCardGlowLight),
                  ]}
                  testID={`roadmap-tier-${tier.level}`}
                >
                  {isCurrent && (
                    <View
                      style={[
                        styles.currentTierBanner,
                        {
                          backgroundColor: theme.scheme === 'dark' ? '#4BAE8A' : '#3A8F6F',
                        },
                      ]}
                    >
                      <Ionicons name="sparkles" size={11} color="#FFFFFF" style={{ marginRight: 4 }} />
                      <Text style={styles.currentTierBannerText}>ACTIVE LEVEL • YOU ARE HERE</Text>
                    </View>
                  )}

                  <View style={styles.tierHeader}>
                    {isCurrent ? (
                      <View
                        style={[
                          styles.currentBadgeHalo,
                          {
                            backgroundColor:
                              theme.scheme === 'dark' ? 'rgba(75, 174, 138, 0.22)' : 'rgba(75, 174, 138, 0.16)',
                            borderColor:
                              theme.scheme === 'dark' ? 'rgba(75, 174, 138, 0.5)' : 'rgba(75, 174, 138, 0.35)',
                          },
                        ]}
                      >
                        <ContributorBadgeIcon
                          badgeKey={tier.badgeKey}
                          colorToken={tier.colorToken}
                          size={44}
                        />
                      </View>
                    ) : (
                      <ContributorBadgeIcon
                        badgeKey={tier.badgeKey}
                        colorToken={tier.colorToken}
                        size={38}
                      />
                    )}

                    <View style={styles.tierMainInfo}>
                      <View style={styles.tierTitleRow}>
                        <Text
                          style={[
                            isCurrent ? styles.currentTierTitle : styles.tierTitle,
                            { color: theme.colors.text },
                          ]}
                        >
                          Lv {tier.level} • {tier.title}
                        </Text>
                      </View>
                      <Text
                        style={[
                          isCurrent ? styles.currentTierRequirements : styles.tierRequirements,
                          {
                            color: isCurrent
                              ? theme.scheme === 'dark'
                                ? '#D6F0E6'
                                : '#2A6F54'
                              : theme.colors.textMuted,
                          },
                        ]}
                      >
                        {tier.minPoints} pts • {tier.productsReq} {tier.productsReq === 1 ? 'product' : 'products'}
                      </Text>
                    </View>
                    <View style={styles.statusIndicator}>
                      {isCurrent ? (
                        <View
                          style={[
                            styles.currentStatusBadge,
                            {
                              backgroundColor:
                                theme.scheme === 'dark' ? 'rgba(75, 174, 138, 0.2)' : 'rgba(75, 174, 138, 0.15)',
                              borderColor: theme.scheme === 'dark' ? '#4BAE8A' : '#3A8F6F',
                            },
                          ]}
                        >
                          <Ionicons
                            name="checkmark-circle"
                            size={14}
                            color={theme.scheme === 'dark' ? '#4BAE8A' : '#3A8F6F'}
                          />
                          <Text
                            style={[
                              styles.currentStatusBadgeText,
                              { color: theme.scheme === 'dark' ? '#4BAE8A' : '#2A6F54' },
                            ]}
                          >
                            ACTIVE
                          </Text>
                        </View>
                      ) : isUnlocked ? (
                        <Ionicons
                          name="checkmark-circle"
                          size={22}
                          color={theme.scheme === 'dark' ? 'rgba(75, 174, 138, 0.6)' : 'rgba(58, 143, 111, 0.6)'}
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
                      isCurrent ? styles.currentPerkContainer : styles.perkContainer,
                      {
                        backgroundColor: isCurrent
                          ? theme.scheme === 'dark'
                            ? 'rgba(75, 174, 138, 0.14)'
                            : 'rgba(75, 174, 138, 0.10)'
                          : 'transparent',
                        borderColor: isCurrent
                          ? theme.scheme === 'dark'
                            ? 'rgba(75, 174, 138, 0.25)'
                            : 'rgba(75, 174, 138, 0.18)'
                          : theme.colors.border,
                        borderTopColor: isCurrent ? undefined : theme.colors.border,
                      },
                    ]}
                  >
                    <Ionicons
                      name="gift"
                      size={15}
                      color={isCurrent ? (theme.scheme === 'dark' ? '#4BAE8A' : '#3A8F6F') : theme.colors.textMuted}
                      style={styles.perkIcon}
                    />
                    <Text
                      style={[
                        isCurrent ? styles.currentPerkText : styles.perkText,
                        {
                          color: isCurrent
                            ? theme.scheme === 'dark'
                              ? '#E6EDE8'
                              : '#2C2C28'
                            : theme.colors.textMuted,
                        },
                      ]}
                    >
                      {isCurrent ? <Text style={{ fontWeight: '800' }}>Active Perk: </Text> : null}
                      {tier.perks}
                    </Text>
                  </View>
                </View>
              );
            })}
          </ScrollView>
        </Animated.View>
      </Animated.View>
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
  handleBar: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 2,
  },
  handlePill: {
    width: 38,
    height: 4,
    borderRadius: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
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
    overflow: 'hidden',
  },
  currentTierCard: {
    borderRadius: 16,
    borderWidth: 2,
    padding: 16,
  },
  regularTierCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
  },
  currentCardGlowDark: {
    shadowColor: '#4BAE8A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 8,
  },
  currentCardGlowLight: {
    shadowColor: '#3A8F6F',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 5,
  },
  currentTierBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 10,
  },
  currentTierBannerText: {
    color: '#FFFFFF',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  currentBadgeHalo: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  currentTierTitle: {
    fontSize: 15.5,
    fontWeight: '800',
    letterSpacing: 0.1,
  },
  currentTierRequirements: {
    fontSize: 12.5,
    fontWeight: '600',
    marginTop: 2,
  },
  currentStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  currentStatusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  currentPerkContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  currentPerkText: {
    fontSize: 12,
    flex: 1,
    lineHeight: 16,
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
