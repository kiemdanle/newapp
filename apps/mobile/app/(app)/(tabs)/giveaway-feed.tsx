// apps/mobile/app/(app)/(tabs)/giveaway-feed.tsx
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { useGiveawayFeed } from '@/api/giveaways';
import type { Giveaway } from '@expyrico/shared';
import { GiveawayCard } from '@/features/giveaways/GiveawayCard';

interface Props {
  onOpen: (id: string) => void;
  onNew: () => void;
}

export function GiveawayFeed({ onOpen, onNew }: Props) {
  const q = useGiveawayFeed('open');
  const items = q.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <View style={{ flex: 1 }}>
      <View style={{ padding: 12, flexDirection: 'row', justifyContent: 'flex-end' }}>
        <Pressable
          accessibilityRole="button"
          onPress={onNew}
          style={{
            paddingVertical: 8,
            paddingHorizontal: 16,
            borderRadius: 8,
            backgroundColor: '#2563eb',
          }}
        >
          <Text style={{ color: '#fff', fontWeight: '600' }}>+ New</Text>
        </Pressable>
      </View>
      <FlatList
        data={items}
        keyExtractor={(d: Giveaway) => d.id}
        contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 48 }}
        renderItem={({ item }) => (
          <GiveawayCard giveaway={item} onPress={() => onOpen(item.id)} />
        )}
        onEndReached={() => { if (q.hasNextPage) q.fetchNextPage(); }}
        onEndReachedThreshold={0.4}
        ListEmptyComponent={
          q.isLoading ? (
            <ActivityIndicator />
          ) : (
            <Text style={{ color: '#6b7280', textAlign: 'center', marginTop: 24 }}>
              No giveaways yet. Share one!
            </Text>
          )
        }
        ListFooterComponent={q.isFetchingNextPage ? <ActivityIndicator /> : null}
      />
    </View>
  );
}
