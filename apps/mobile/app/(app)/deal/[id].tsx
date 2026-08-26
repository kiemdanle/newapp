// apps/mobile/app/(app)/deal/[id].tsx
import React from 'react';
import {
  Alert,
  Image,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useDeal, useDeleteDeal } from '@/api/deals';
import { useOptimisticDealVote } from '@/features/deals/useOptimisticDealVote';
import { useSessionStore } from '@/auth/session-store';
import { useTheme } from '@/theme/useTheme';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/Button';
import { formatCurrency } from '@/utils/country-format';
import type { AppNavigationProp } from '@/navigation/AppNavigator';

export default function DealDetailScreen() {
  const theme = useTheme();
  const navigation = useNavigation<AppNavigationProp>();
  const route = useRoute();
  const { id } = route.params as { id: string };
  const { data: deal, isLoading } = useDeal(id ?? '');
  const del = useDeleteDeal();
  const vote = useOptimisticDealVote(id ?? '');
  const userId = useSessionStore((s) => s.user?.id ?? null);

  if (isLoading || !deal) {
    return (
      <View
        style={[
          styles.center,
          { backgroundColor: theme.colors.bg },
        ]}
      >
        <Text style={{ color: theme.colors.textMuted }}>Loading deal details…</Text>
      </View>
    );
  }

  function confirmDelete() {
    Alert.alert(
      'Delete Deal',
      'Are you sure you want to remove this deal? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await del.mutateAsync(id ?? '');
            navigation.goBack();
          },
        },
      ],
    );
  }

  async function handleShare() {
    try {
      await Share.share({
        title: `${deal!.product?.name ?? 'Deal'} at ${deal!.storeName}`,
        message: `Found a great deal on ${deal!.product?.name ?? 'item'} for ${deal!.currency} ${deal!.price.toFixed(2)} at ${deal!.storeName} on Expyrico!`,
      });
    } catch {
      // ignore
    }
  }

  function press(next: -1 | 1) {
    const prev = deal!.myVote ?? null;
    vote.mutate({ next: prev === next ? 0 : next, prev });
  }

  const isOwn = deal.userId === userId;
  const priceLabel = formatCurrency(deal.price, deal.currency);
  const imageUrl = deal.photoUrl || deal.product?.imageUrl;

  return (
    <Screen>
      {/* Product Hero Card */}
      <View
        style={[
          styles.heroCard,
          {
            backgroundColor: theme.colors.bgElevated,
            borderColor: theme.colors.border,
            borderRadius: theme.radii.lg,
          },
        ]}
      >
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            style={[styles.heroImage, { borderRadius: theme.radii.md }]}
            resizeMode="cover"
          />
        ) : (
          <View
            style={[
              styles.heroPlaceholder,
              { backgroundColor: theme.colors.bgElevated, borderRadius: theme.radii.md },
            ]}
          >
            <Text style={{ fontSize: 36 }}>🏷️</Text>
          </View>
        )}

        <View style={styles.heroContent}>
          <Text style={[styles.productName, { color: theme.colors.text }]}>
            {deal.product?.name ?? 'Product'}
          </Text>
          {deal.product?.brand ? (
            <Text style={[styles.brandText, { color: theme.colors.textMuted }]}>
              {deal.product.brand}
            </Text>
          ) : null}

          {/* Price & Store Banner */}
          <View style={styles.priceRow}>
            <Text style={[styles.priceLarge, { color: theme.colors.primaryDark }]}>
              {priceLabel}
            </Text>
            <View
              style={[
                styles.storeBadge,
                { backgroundColor: theme.colors.bgGlass, borderColor: theme.colors.border, borderWidth: 1, borderRadius: theme.radii.pill },
              ]}
            >
              <Text style={[styles.storeText, { color: theme.colors.text }]}>
                🏪 {deal.storeName}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Expiry Banner if present */}
      {deal.expiryDate && (
        <View
          style={[
            styles.expiryCard,
            {
              backgroundColor: '#FEEFC3', // Soft Butter
              borderColor: '#F5A623', // Honey
              borderRadius: theme.radii.md,
            },
          ]}
        >
          <Text style={{ color: '#B45309', fontWeight: '700', fontSize: 14 }}>
            ⏳ Expiration / Best-By Date: {deal.expiryDate}
          </Text>
        </View>
      )}

      {/* Note Block if present */}
      {deal.note ? (
        <View
          style={[
            styles.noteCard,
            {
              backgroundColor: theme.colors.bgElevated,
              borderColor: theme.colors.border,
              borderRadius: theme.radii.md,
            },
          ]}
        >
          <Text style={{ color: theme.colors.textMuted, fontSize: 11, fontWeight: '700' }}>
            DEAL DETAILS
          </Text>
          <Text style={{ color: theme.colors.text, fontSize: 14, marginTop: 4, lineHeight: 20 }}>
            {deal.note}
          </Text>
        </View>
      ) : null}

      {/* Author & Community Helpfulness Card */}
      <View
        style={[
          styles.authorCard,
          {
            backgroundColor: theme.colors.bgElevated,
            borderColor: theme.colors.border,
            borderRadius: theme.radii.md,
          },
        ]}
      >
        <View style={styles.authorRow}>
          <Text style={{ color: theme.colors.text, fontWeight: '700', fontSize: 15 }}>
            Posted by {deal.author?.firstName ?? 'Neighbor'}
          </Text>
          <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>
            ▲ {deal.upvoteCount} helpful · ▼ {deal.downvoteCount}
          </Text>
        </View>

        {!isOwn && (
          <View style={styles.voteBtnRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="upvote"
              onPress={() => press(1)}
              style={[
                styles.voteActionBtn,
                {
                  backgroundColor:
                    deal.myVote === 1 ? theme.colors.primary : theme.colors.bgGlass,
                  borderRadius: theme.radii.pill,
                },
              ]}
            >
              <Text
                style={{
                  color: deal.myVote === 1 ? theme.colors.primaryFg : theme.colors.text,
                  fontWeight: '700',
                  fontSize: 14,
                }}
              >
                ▲ Helpful ({deal.upvoteCount})
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="downvote"
              onPress={() => press(-1)}
              style={[
                styles.voteActionBtn,
                {
                  backgroundColor:
                    deal.myVote === -1 ? theme.colors.danger + '18' : theme.colors.bgGlass,
                  borderRadius: theme.radii.pill,
                },
              ]}
            >
              <Text
                style={{
                  color: deal.myVote === -1 ? theme.colors.danger : theme.colors.textMuted,
                  fontWeight: '700',
                  fontSize: 14,
                }}
              >
                ▼ Not Helpful ({deal.downvoteCount})
              </Text>
            </Pressable>
          </View>
        )}
      </View>

      {/* Action Buttons */}
      <View style={styles.actionsBlock}>
        <Button
          label="Share this deal"
          variant="outline"
          icon="share-outline"
          onPress={handleShare}
        />

        {!isOwn && (
          <Button
            label="Report deal"
            variant="ghost"
            icon="flag-outline"
            onPress={() =>
              navigation.push('Report', { targetType: 'deal', targetId: deal.id })
            }
          />
        )}

        {isOwn && (
          <>
            <Button
              label="Edit deal"
              variant="outline"
              icon="create-outline"
              onPress={() => navigation.push('DealNew', { editId: deal.id })}
            />
            <Button
              label="Delete deal"
              variant="danger"
              icon="trash-outline"
              onPress={confirmDelete}
            />
          </>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroCard: {
    padding: 16,
    borderWidth: 1,
    gap: 14,
  },
  heroImage: {
    width: '100%',
    height: 180,
  },
  heroPlaceholder: {
    width: '100%',
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroContent: {
    gap: 6,
  },
  productName: {
    fontSize: 22,
    fontWeight: '800',
  },
  brandText: {
    fontSize: 14,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  priceLarge: {
    fontSize: 24,
    fontWeight: '800',
  },
  storeBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  storeText: {
    fontSize: 13,
    fontWeight: '700',
  },
  expiryCard: {
    padding: 12,
    borderWidth: 1,
  },
  noteCard: {
    padding: 14,
    borderWidth: 1,
  },
  authorCard: {
    padding: 14,
    borderWidth: 1,
    gap: 12,
  },
  authorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  voteBtnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  voteActionBtn: {
    flex: 1,
    paddingVertical: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionsBlock: {
    gap: 10,
    marginTop: 8,
  },
});
