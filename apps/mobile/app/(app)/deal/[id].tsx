// apps/mobile/app/(app)/deal/[id].tsx
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useDeal, useDeleteDeal } from '@/api/deals';
import { useOptimisticDealVote } from '@/features/deals/useOptimisticDealVote';
import { useSessionStore } from '@/auth/session-store';

export default function DealDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: deal, isLoading } = useDeal(id ?? '');
  const del = useDeleteDeal();
  const vote = useOptimisticDealVote(id ?? '');
  const userId = useSessionStore((s) => s.user?.id ?? null);

  if (isLoading || !deal) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: '#6b7280' }}>Loading…</Text>
      </View>
    );
  }

  async function handleDelete() {
    await del.mutateAsync(id ?? '');
    router.back();
  }

  function press(next: -1 | 1) {
    const prev = deal!.myVote ?? null;
    vote.mutate({ next: prev === next ? 0 : next, prev });
  }

  const isOwn = deal.userId === userId;

  return (
    <>
      <Stack.Screen options={{ title: deal.product?.name ?? 'Deal' }} />
      <ScrollView style={{ flex: 1, padding: 16 }}>
        <Text style={{ fontSize: 24, fontWeight: '700', color: '#111827' }}>
          {deal.product?.name ?? 'Product'}
        </Text>
        <Text style={{ fontSize: 20, color: '#2563eb', fontWeight: '700', marginTop: 8 }}>
          {deal.currency} {deal.price.toFixed(2)}
        </Text>
        <Text style={{ color: '#6b7280', marginTop: 4 }}>at {deal.storeName}</Text>

        {deal.expiryDate && (
          <Text style={{ color: '#6b7280', marginTop: 4 }}>Expires: {deal.expiryDate}</Text>
        )}
        {deal.note ? (
          <Text style={{ color: '#374151', marginTop: 12 }}>{deal.note}</Text>
        ) : null}

        <View style={{ marginTop: 16, padding: 12, backgroundColor: '#f9fafb', borderRadius: 8 }}>
          <Text style={{ color: '#111827', fontWeight: '600' }}>
            Posted by {deal.author?.firstName ?? 'User'}
          </Text>
          <Text style={{ color: '#6b7280', marginTop: 2 }}>
            ▲ {deal.upvoteCount} · ▼ {deal.downvoteCount}
          </Text>
        </View>

        {!isOwn && (
          <View style={{ flexDirection: 'row', gap: 16, marginTop: 16 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="upvote"
              onPress={() => press(1)}
              style={{
                padding: 12,
                borderRadius: 8,
                backgroundColor: deal.myVote === 1 ? '#16a34a' : '#e5e7eb',
              }}
            >
              <Text style={{ color: deal.myVote === 1 ? '#fff' : '#374151', fontWeight: '600' }}>
                ▲ Helpful
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="downvote"
              onPress={() => press(-1)}
              style={{
                padding: 12,
                borderRadius: 8,
                backgroundColor: deal.myVote === -1 ? '#dc2626' : '#e5e7eb',
              }}
            >
              <Text style={{ color: deal.myVote === -1 ? '#fff' : '#374151', fontWeight: '600' }}>
                ▼ Not helpful
              </Text>
            </Pressable>
          </View>
        )}

        {isOwn && (
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push({ pathname: '/deal/new', params: { editId: deal.id } })}
              style={{ padding: 12, borderRadius: 8, backgroundColor: '#e5e7eb' }}
            >
              <Text style={{ color: '#374151', fontWeight: '600' }}>Edit</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={handleDelete}
              style={{ padding: 12, borderRadius: 8, backgroundColor: '#fecaca' }}
            >
              <Text style={{ color: '#dc2626', fontWeight: '600' }}>Delete</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </>
  );
}
