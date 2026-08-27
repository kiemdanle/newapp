// apps/mobile/src/features/giveaways/GiveawayCard.tsx
import React, { useRef } from 'react';
import { Animated, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import Ionicons from 'react-native-vector-icons/Ionicons';
import type { Giveaway } from '@expyrico/shared';
import { GiveawayStatusBadge } from './GiveawayStatusBadge';
import { expiryStatus, EXPIRY_STATUS_TOKEN } from '../records/expiryStatus';
import { useSessionStore } from '../../auth/session-store';
import { useTheme } from '../../theme/useTheme';
import { formatDate } from '../../utils/country-format';
export interface GiveawayCardProps {
  giveaway: Giveaway;
  onPress?: (giveaway: Giveaway) => void;
  onEdit?: (giveaway: Giveaway) => void;
  onDelete?: (giveaway: Giveaway) => void;
  onManage?: (giveaway: Giveaway) => void;
  onShare?: (giveaway: Giveaway) => void;
  currentUserId?: string | null;
}

export function GiveawayCard({
  giveaway,
  onPress,
  onEdit,
  onDelete,
  onManage,
  onShare,
  currentUserId,
}: GiveawayCardProps) {
  const theme = useTheme();
  const userCountry = useSessionStore((s) => s.user?.country ?? null);
  const swipeableRef = useRef<Swipeable>(null);
  const loc = giveaway.locationText ?? '';
  const photoList = React.useMemo(() => {
    if (giveaway.photoUrls && Array.isArray(giveaway.photoUrls) && giveaway.photoUrls.length > 0) {
      return giveaway.photoUrls;
    }
    if (giveaway.photoUrl) {
      const raw = giveaway.photoUrl.trim();
      if (raw.startsWith('[') && raw.endsWith(']')) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed.filter((s): s is string => typeof s === 'string' && s.length > 0);
          }
        } catch {
          return [raw];
        }
      }
      return [raw];
    }
    return [];
  }, [giveaway.photoUrls, giveaway.photoUrl]);
  const imageUrl = photoList[0] || null;
  const photoCount = photoList.length;

  const isOwner = Boolean(currentUserId && currentUserId === giveaway.giverUserId);

  const renderRightActions = (
    _progress: Animated.AnimatedInterpolation<number>,
    _dragX: Animated.AnimatedInterpolation<number>,
  ) => {
    return (
      <View style={styles.rightActionsRow}>
        {isOwner ? (
          <>
            {/* Quick Edit */}
            {onEdit && (
              <Pressable
                testID={`giveaway-edit-${giveaway.id}`}
                accessibilityRole="button"
                accessibilityLabel={`Edit ${giveaway.title}`}
                onPress={() => {
                  swipeableRef.current?.close();
                  onEdit(giveaway);
                }}
                style={[styles.actionBtn, { backgroundColor: theme.colors.accent }]}
              >
                <Ionicons name="create-outline" size={20} color="#FFFFFF" />
                <Text style={styles.actionBtnText}>Edit</Text>
              </Pressable>
            )}

            {/* Manage Claims */}
            {onManage && giveaway.status !== 'cancelled' && (
              <Pressable
                testID={`giveaway-manage-${giveaway.id}`}
                accessibilityRole="button"
                accessibilityLabel={`Manage claims for ${giveaway.title}`}
                onPress={() => {
                  swipeableRef.current?.close();
                  onManage(giveaway);
                }}
                style={[styles.actionBtn, { backgroundColor: theme.colors.primary }]}
              >
                <Ionicons name="people-outline" size={20} color="#FFFFFF" />
                <Text style={styles.actionBtnText}>Claims</Text>
              </Pressable>
            )}

            {/* Cancel / Delete */}
            {onDelete && (giveaway.status === 'open' || giveaway.status === 'claimed') && (
              <Pressable
                testID={`giveaway-delete-${giveaway.id}`}
                accessibilityRole="button"
                accessibilityLabel={`Cancel ${giveaway.title}`}
                onPress={() => {
                  swipeableRef.current?.close();
                  onDelete(giveaway);
                }}
                style={[styles.actionBtn, { backgroundColor: theme.colors.danger }]}
              >
                <Ionicons name="trash-outline" size={20} color="#FFFFFF" />
                <Text style={styles.actionBtnText}>Cancel</Text>
              </Pressable>
            )}
          </>
        ) : (
          <>
            {/* Quick Share */}
            {onShare && (
              <Pressable
                testID={`giveaway-share-${giveaway.id}`}
                accessibilityRole="button"
                accessibilityLabel={`Share ${giveaway.title}`}
                onPress={() => {
                  swipeableRef.current?.close();
                  onShare(giveaway);
                }}
                style={[styles.actionBtn, { backgroundColor: theme.colors.primary }]}
              >
                <Ionicons name="share-social-outline" size={20} color="#FFFFFF" />
                <Text style={styles.actionBtnText}>Share</Text>
              </Pressable>
            )}

            {/* Quick View / Claim */}
            {giveaway.status === 'open' && !giveaway.myClaim && (
              <Pressable
                testID={`giveaway-claim-${giveaway.id}`}
                accessibilityRole="button"
                accessibilityLabel={`Claim ${giveaway.title}`}
                onPress={() => {
                  swipeableRef.current?.close();
                  onPress?.(giveaway);
                }}
                style={[styles.actionBtn, { backgroundColor: theme.colors.accent }]}
              >
                <Ionicons name="hand-left-outline" size={20} color="#FFFFFF" />
                <Text style={styles.actionBtnText}>Claim</Text>
              </Pressable>
            )}
          </>
        )}
      </View>
    );
  };

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={renderRightActions}
      overshootRight={false}
      friction={1}
      rightThreshold={35}
      containerStyle={styles.cardContainer}
    >
      <Pressable
        accessibilityLabel={`giveaway-${giveaway.id}`}
        testID={`giveaway-card-${giveaway.id}`}
        onPress={() => onPress?.(giveaway)}
        style={({ pressed }) => [
          styles.card,
          {
            backgroundColor: theme.colors.bgElevated,
            borderColor: theme.colors.border,
            borderRadius: theme.radii.lg,
            opacity: pressed ? 0.9 : 1,
          },
        ]}
      >
        <View style={styles.topRow}>
          {/* Thumbnail with optional multi-image indicator */}
          <View style={styles.thumbnailWrap}>
            {imageUrl ? (
              <Image
                source={{ uri: imageUrl }}
                style={[styles.thumbnail, { borderRadius: theme.radii.md }]}
                resizeMode="cover"
                accessibilityIgnoresInvertColors
              />
            ) : (
              <View
                style={[
                  styles.thumbnailPlaceholder,
                  {
                    backgroundColor: theme.colors.bgGlass,
                    borderColor: theme.colors.border,
                    borderRadius: theme.radii.md,
                  },
                ]}
              >
                <Ionicons name="gift-outline" size={24} color={theme.colors.primary} />
              </View>
            )}

            {photoCount > 1 && (
              <View style={[styles.photoCountBadge, { backgroundColor: 'rgba(0,0,0,0.65)' }]}>
                <Ionicons name="images" size={10} color="#FFFFFF" style={{ marginRight: 2 }} />
                <Text style={styles.photoCountText}>{photoCount}</Text>
              </View>
            )}
          </View>

          <View style={styles.infoCol}>
            <View style={styles.titleRow}>
              <Text style={[styles.titleText, { color: theme.colors.text }]} numberOfLines={2}>
                {giveaway.title}
              </Text>
              <GiveawayStatusBadge status={giveaway.status} />
            </View>

            {giveaway.description ? (
              <Text style={[styles.descText, { color: theme.colors.textMuted }]} numberOfLines={2}>
                {giveaway.description}
              </Text>
            ) : null}
            {giveaway.quantity ? (
              <View style={styles.qtyBadgeRow}>
                <View
                  style={[
                    styles.qtyBadge,
                    {
                      backgroundColor: theme.colors.bgGlass,
                      borderColor: theme.colors.border,
                      borderRadius: theme.radii.sm,
                    },
                  ]}
                >
                  <Text style={[styles.qtyBadgeText, { color: theme.colors.text }]}>
                    📦 {giveaway.quantity} {giveaway.unit || 'pcs'}
                  </Text>
                </View>
              </View>
            ) : null}

            {giveaway.expiryDate ? (
              <View style={styles.itemExpiryRow}>
                <Ionicons
                  name="calendar-outline"
                  size={12}
                  color={theme.colors[EXPIRY_STATUS_TOKEN[expiryStatus(giveaway.expiryDate)]]}
                />
                <Text
                  style={[
                    styles.itemExpiryText,
                    {
                      color:
                        theme.colors[EXPIRY_STATUS_TOKEN[expiryStatus(giveaway.expiryDate)]],
                    },
                  ]}
                  numberOfLines={1}
                >
                  Expires {formatDate(giveaway.expiryDate, giveaway.country || userCountry)}
                </Text>
              </View>
            ) : null}

            <View style={styles.metaRow}>
              <Text style={[styles.locationText, { color: theme.colors.textMuted }]}>
                📍 {loc}
              </Text>
              {giveaway.claimCount ? (
                <Text style={[styles.claimCountText, { color: theme.colors.primaryDark }]}>
                  · {giveaway.claimCount} requested
                </Text>
              ) : null}
            </View>
          </View>
        </View>

        {giveaway.giver && (
          <View style={[styles.footerRow, { borderTopColor: theme.colors.border }]}>
            <View style={styles.giverRow}>
              <Ionicons name="person-circle-outline" size={16} color={theme.colors.textMuted} />
              <Text style={[styles.giverName, { color: theme.colors.textMuted }]}>
                {giveaway.giver.firstName}
              </Text>
              {giveaway.giver.giverRatingAvg != null && (
                <Text style={[styles.ratingText, { color: theme.colors.accent }]}>
                  ★ {giveaway.giver.giverRatingAvg.toFixed(1)}
                </Text>
              )}
            </View>
            <Text style={[styles.actionHint, { color: theme.colors.primaryDark }]}>
              Swipe for actions ‹
            </Text>
          </View>
        )}
      </Pressable>
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    marginVertical: 5,
    overflow: 'hidden',
  },
  card: {
    padding: 14,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  thumbnailWrap: {
    position: 'relative',
    width: 68,
    height: 68,
  },
  thumbnail: {
    width: 68,
    height: 68,
  },
  thumbnailPlaceholder: {
    width: 68,
    height: 68,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoCountBadge: {
    position: 'absolute',
    bottom: 3,
    right: 3,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 6,
  },
  photoCountText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  infoCol: {
    flex: 1,
    gap: 3,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  titleText: {
    fontWeight: '700',
    fontSize: 16,
    flex: 1,
  },
  descText: {
    fontSize: 13,
    lineHeight: 18,
  },
  qtyBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  qtyBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
  },
  qtyBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  itemExpiryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  itemExpiryText: {
    fontSize: 12,
    fontWeight: '700',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  locationText: {
    fontSize: 12,
    flexShrink: 1,
  },
  claimCountText: {
    fontSize: 12,
    fontWeight: '600',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
  },
  giverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  giverName: {
    fontSize: 12,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: '700',
  },
  actionHint: {
    fontSize: 11,
    fontWeight: '700',
  },
  rightActionsRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginLeft: 8,
    marginVertical: 1,
  },
  actionBtn: {
    width: 64,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    marginLeft: 6,
    paddingVertical: 8,
    gap: 3,
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
});
