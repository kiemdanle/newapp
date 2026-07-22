// apps/mobile/app/(app)/deal/[id].tsx
import { Pressable, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useDeal, useDeleteDeal } from '@/api/deals';
import { useOptimisticDealVote } from '@/features/deals/useOptimisticDealVote';
import { useSessionStore } from '@/auth/session-store';
import { useTheme } from '@/theme/useTheme';
import { Screen } from '@/components/Screen';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
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
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.bg }}>
        <Text style={{ color: theme.colors.textMuted }}>Loading…</Text>
      </View>
    );
  }

  async function handleDelete() {
    await del.mutateAsync(id ?? '');
    navigation.goBack();
  }

  function press(next: -1 | 1) {
    const prev = deal!.myVote ?? null;
    vote.mutate({ next: prev === next ? 0 : next, prev });
  }

  const isOwn = deal.userId === userId;

  return (
    <Screen>
      <Text style={{ fontSize: 24, fontWeight: '700', color: theme.colors.text }}>
        {deal.product?.name ?? 'Product'}
      </Text>
      <Text style={{ fontSize: 20, color: theme.colors.primary, fontWeight: '800', marginTop: 8 }}>
        {deal.currency} {deal.price.toFixed(2)}
      </Text>
      <Text style={{ color: theme.colors.textMuted, marginTop: 4 }}>at {deal.storeName}</Text>

      {deal.expiryDate && (
        <Text style={{ color: theme.colors.textMuted, marginTop: 4 }}>Expires: {deal.expiryDate}</Text>
      )}
      {deal.note ? (
        <Text style={{ color: theme.colors.text, marginTop: 12 }}>{deal.note}</Text>
      ) : null}

      <Card style={{ marginTop: 4 }}>
        <Text style={{ color: theme.colors.text, fontWeight: '600' }}>
          Posted by {deal.author?.firstName ?? 'User'}
        </Text>
        <Text style={{ color: theme.colors.textMuted, marginTop: 2 }}>
          ▲ {deal.upvoteCount} · ▼ {deal.downvoteCount}
        </Text>
      </Card>

      {!isOwn && (
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="upvote"
            onPress={() => press(1)}
            style={{
              padding: 12,
              borderRadius: theme.radii.md,
              backgroundColor: deal.myVote === 1 ? theme.colors.success : theme.colors.bgElevated,
              minHeight: 52,
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: theme.colors.text, fontWeight: '600' }}>
              ▲ Helpful
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="downvote"
            onPress={() => press(-1)}
            style={{
              padding: 12,
              borderRadius: theme.radii.md,
              backgroundColor: deal.myVote === -1 ? theme.colors.danger + '18' : theme.colors.bgElevated,
              minHeight: 52,
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: deal.myVote === -1 ? theme.colors.danger : theme.colors.text, fontWeight: '600' }}>
              ▼ Not helpful
            </Text>
          </Pressable>
        </View>
      )}

      {isOwn && (
        <View style={{ gap: 10 }}>
          <Button label="Edit deal" variant="outline" icon="create-outline" onPress={() => navigation.push('DealNew', { editId: deal.id })} />
          <Button label="Delete deal" variant="danger" icon="trash-outline" onPress={handleDelete} />
        </View>
      )}
    </Screen>
  );
}
