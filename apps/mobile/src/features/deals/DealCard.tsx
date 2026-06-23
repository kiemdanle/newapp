// apps/mobile/src/features/deals/DealCard.tsx
import { Pressable, Text, View } from 'react-native';
import type { Deal } from '@expyrico/shared';
import { useOptimisticDealVote } from './useOptimisticDealVote';

interface Props {
  deal: Deal;
  onReport: (deal: Deal) => void;
  onPress?: (deal: Deal) => void;
  isOwn?: boolean;
}

export function DealCard({ deal, onReport, onPress, isOwn }: Props) {
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
        backgroundColor: '#ffffff',
        borderRadius: 12,
        padding: 16,
        marginVertical: 6,
        borderWidth: 1,
        borderColor: '#e5e7eb',
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ fontWeight: '700', fontSize: 16, flex: 1 }}>
          {deal.product?.name ?? 'Product'}
        </Text>
        <Text style={{ color: '#2563eb', fontWeight: '700' }}>{priceLabel}</Text>
      </View>
      <Text style={{ color: '#6b7280', marginTop: 2 }}>
        at {deal.storeName}
        {deal.expiryDate ? ` · until ${deal.expiryDate}` : ''}
      </Text>
      {deal.note ? <Text style={{ marginTop: 6 }}>{deal.note}</Text> : null}
      <View style={{ flexDirection: 'row', marginTop: 12, gap: 16, alignItems: 'center' }}>
        <Text style={{ color: '#6b7280', fontSize: 12 }}>
          {deal.author?.firstName ?? 'User'}
        </Text>
        {!isOwn && (
          <>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="upvote"
              onPress={() => press(1)}
              hitSlop={8}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
            >
              <Text style={{ color: deal.myVote === 1 ? '#16a34a' : '#6b7280' }}>▲</Text>
              <Text>{deal.upvoteCount}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="downvote"
              onPress={() => press(-1)}
              hitSlop={8}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
            >
              <Text style={{ color: deal.myVote === -1 ? '#dc2626' : '#6b7280' }}>▼</Text>
              <Text>{deal.downvoteCount}</Text>
            </Pressable>
          </>
        )}
      </View>
    </Pressable>
  );
}
