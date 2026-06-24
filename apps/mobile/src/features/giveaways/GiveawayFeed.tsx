// apps/mobile/src/features/giveaways/GiveawayFeed.tsx
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { useGiveawayFeed } from '@/api/giveaways';
import type { Giveaway } from '@expyrico/shared';
import { GiveawayCard } from './GiveawayCard';
import { EmptyState } from '@/components/EmptyState';
import { useTheme } from '@/theme/useTheme';

interface Props {
  onOpen: (id: string) => void;
  onNew: () => void;
}

export function GiveawayFeed({ onOpen, onNew }: Props) {
  const theme = useTheme();
  const q = useGiveawayFeed('open');
  const items = q.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={{ paddingHorizontal: 20, paddingTop: 18, paddingBottom: 10 }}>
        <Text style={{ color: theme.colors.text, fontSize: 28, fontWeight: '700' }}>Giveaways</Text>
        <Text style={{ color: theme.colors.textMuted, fontSize: 14, marginTop: 4 }}>
          Offer items you cannot use in time, or claim food nearby.
        </Text>
      </View>
      <View style={{ paddingHorizontal: 20, paddingBottom: 10, flexDirection: 'row', justifyContent: 'flex-end' }}>
        <Pressable
          accessibilityRole="button"
          onPress={onNew}
          style={{
            minHeight: 44,
            justifyContent: 'center',
            paddingVertical: 8,
            paddingHorizontal: 16,
            borderRadius: 999,
            backgroundColor: theme.colors.accent,
          }}
        >
          <Text style={{ color: theme.colors.text, fontWeight: '700' }}>+ Share item</Text>
        </Pressable>
      </View>
      <FlatList
        data={items}
        keyExtractor={(d: Giveaway) => d.id}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 124 }}
        renderItem={({ item }) => (
          <GiveawayCard giveaway={item} onPress={() => onOpen(item.id)} />
        )}
        onEndReached={() => { if (q.hasNextPage) q.fetchNextPage(); }}
        onEndReachedThreshold={0.4}
        ListEmptyComponent={
          q.isLoading ? (
            <ActivityIndicator color={theme.colors.primary} />
          ) : (
            <EmptyState
              icon="gift"
              title="No giveaways yet"
              body="Share a sealed item before it expires, or check again for nearby offers."
              actionLabel="Share item"
              actionIcon="add"
              onAction={onNew}
            />
          )
        }
        ListFooterComponent={q.isFetchingNextPage ? <ActivityIndicator color={theme.colors.primary} /> : null}
      />
    </View>
  );
}
