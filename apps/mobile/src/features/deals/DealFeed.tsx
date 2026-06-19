// apps/mobile/src/features/deals/DealFeed.tsx
import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import type { Deal, DealSort } from '@expyrico/shared';
import { useDealFeed } from '../../api/deals';
import { DealCard } from './DealCard';

const SORTS: { id: DealSort; label: string }[] = [
  { id: 'score', label: 'Top' },
  { id: 'new', label: 'Newest' },
];

interface Props {
  currentUserId: string | null;
  onOpen: (deal: Deal) => void;
  onReport: (deal: Deal) => void;
}

export function DealFeed({ currentUserId, onOpen, onReport }: Props) {
  const [sort, setSort] = useState<DealSort>('score');
  const q = useDealFeed(sort);
  const items = q.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: 'row', gap: 8, padding: 12 }}>
        {SORTS.map((s) => {
          const selected = s.id === sort;
          return (
            <Pressable
              key={s.id}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => setSort(s.id)}
              style={{
                paddingVertical: 6,
                paddingHorizontal: 14,
                borderRadius: 999,
                backgroundColor: selected ? '#2563eb' : '#f3f4f6',
              }}
            >
              <Text style={{ color: selected ? '#ffffff' : '#374151', fontWeight: '500' }}>
                {s.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <FlatList
        data={items}
        keyExtractor={(d) => d.id}
        contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 48 }}
        renderItem={({ item }) => (
          <DealCard
            deal={item}
            onReport={onReport}
            onPress={onOpen}
            isOwn={item.userId === currentUserId}
          />
        )}
        onEndReached={() => { if (q.hasNextPage) q.fetchNextPage(); }}
        onEndReachedThreshold={0.4}
        ListEmptyComponent={
          q.isLoading ? (
            <ActivityIndicator />
          ) : (
            <Text style={{ color: '#6b7280', textAlign: 'center', marginTop: 24 }}>
              No deals yet. Share one!
            </Text>
          )
        }
        ListFooterComponent={q.isFetchingNextPage ? <ActivityIndicator /> : null}
      />
    </View>
  );
}
