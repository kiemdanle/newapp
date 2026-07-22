// apps/mobile/src/features/deals/DealCard.tsx
import { Pressable, Text, View } from 'react-native';
import type { Deal } from '@expyrico/shared';
import { useOptimisticDealVote } from './useOptimisticDealVote';
import { useTheme } from '../../theme/useTheme';

interface Props {
  deal: Deal;
  onReport: (deal: Deal) => void;
  onPress?: (deal: Deal) => void;
  isOwn?: boolean;
}

export function DealCard({ deal, onReport, onPress, isOwn }: Props) {
  const theme = useTheme();
  const vote = useOptimisticDealVote(deal.id);

  function press(next: -1 | 1) {
    const prev = deal.myVote ?? null;
    vote.mutate({ next: prev === next ? 0 : next, prev });
  }

  const priceLabel = `${deal.currency} ${deal.price.toFixed(2)}`;

  return (
    <Pressable
      accessibilityLabel={`deal-${deal.id}`}
      onPress={() => onPress?.(deal)}
      onLongPress={() => onReport(deal)}
      style={{
        backgroundColor: theme.colors.bgElevated,
        borderRadius: theme.radii.lg,
        padding: 16,
        marginVertical: 6,
        borderWidth: 1,
        borderColor: theme.colors.border,
        shadowColor: theme.colors.neutralDark,
        shadowOpacity: 0.05,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 3 },
        elevation: 2,
        minHeight: 124,
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ color: theme.colors.text, fontWeight: '700', fontSize: 16, flex: 1 }}>
          {deal.product?.name ?? 'Product'}
        </Text>
        <Text style={{ color: theme.colors.primary, fontWeight: '800' }}>{priceLabel}</Text>
      </View>
      <Text style={{ color: theme.colors.textMuted, marginTop: 2 }}>
        at {deal.storeName}
        {deal.expiryDate ? ` · until ${deal.expiryDate}` : ''}
      </Text>
      {deal.note ? <Text style={{ color: theme.colors.text, marginTop: 6 }}>{deal.note}</Text> : null}
      <View style={{ flexDirection: 'row', marginTop: 12, gap: 16, alignItems: 'center' }}>
        <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>
          {deal.author?.firstName ?? 'User'}
        </Text>
        {!isOwn && (
          <>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="upvote"
              onPress={() => press(1)}
              hitSlop={8}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 52, paddingHorizontal: 4 }}
            >
              <Text style={{ color: deal.myVote === 1 ? theme.colors.success : theme.colors.textMuted }}>▲</Text>
              <Text style={{ color: theme.colors.text }}>{deal.upvoteCount}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="downvote"
              onPress={() => press(-1)}
              hitSlop={8}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 52, paddingHorizontal: 4 }}
            >
              <Text style={{ color: deal.myVote === -1 ? theme.colors.danger : theme.colors.textMuted }}>▼</Text>
              <Text style={{ color: theme.colors.text }}>{deal.downvoteCount}</Text>
            </Pressable>
          </>
        )}
      </View>
    </Pressable>
  );
}
