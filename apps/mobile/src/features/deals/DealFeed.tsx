// apps/mobile/src/features/deals/DealFeed.tsx
import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import type { Deal, DealSort } from '@expyrico/shared';
import { useDealFeed } from '../../api/deals';
import { DealCard } from './DealCard';
import { EmptyState } from '../../components/EmptyState';
import { useTheme } from '../../theme/useTheme';

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
  const theme = useTheme();
  const [sort, setSort] = useState<DealSort>('score');
  const q = useDealFeed(sort);
  const items = q.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={{ paddingHorizontal: 20, paddingTop: 18, paddingBottom: 8 }}>
        <Text style={{ color: theme.colors.text, fontSize: 28, fontWeight: '700' }}>Deals</Text>
        <Text style={{ color: theme.colors.textMuted, fontSize: 14, marginTop: 4 }}>
          Vote up useful local finds and save money before products expire.
        </Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingVertical: 10 }}>
        {SORTS.map((s) => {
          const selected = s.id === sort;
          return (
            <Pressable
              key={s.id}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => setSort(s.id)}
              style={{
                minHeight: 44,
                justifyContent: 'center',
                paddingVertical: 8,
                paddingHorizontal: 14,
                borderRadius: 999,
                backgroundColor: selected ? theme.colors.primary : theme.colors.bgElevated,
                borderColor: selected ? theme.colors.primary : theme.colors.border,
                borderWidth: 1,
              }}
            >
              <Text style={{ color: selected ? theme.colors.primaryFg : theme.colors.text, fontWeight: '600' }}>
                {s.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <FlatList
        data={items}
        keyExtractor={(d) => d.id}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 124 }}
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
            <ActivityIndicator color={theme.colors.primary} />
          ) : (
            <EmptyState
              icon="pricetag"
              title="No deals yet"
              body="Share a useful price drop or check back when the community posts one."
            />
          )
        }
        ListFooterComponent={q.isFetchingNextPage ? <ActivityIndicator color={theme.colors.primary} /> : null}
      />
    </View>
  );
}
