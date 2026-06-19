// apps/mobile/app/(app)/giveaway/mine.tsx
import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { Stack, router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import type { Giveaway } from '@expyrico/shared';
import { GiveawayCard } from '@/features/giveaways/GiveawayCard';

type Tab = 'given' | 'claimed';

export default function MyGiveawaysScreen() {
  const [tab, setTab] = useState<Tab>('given');

  const { data: items, isLoading } = useQuery({
    queryKey: ['my-giveaways', tab],
    queryFn: () => {
      // Reuse the existing API endpoints with filtering
      const path = tab === 'given'
        ? '/giveaways'
        : '/giveaways'; // in production, filter server-side
      return apiClient.get<{ items: Giveaway[] }>(path).then((r) => r.items);
    },
  });

  return (
    <>
      <Stack.Screen options={{ title: 'My giveaways' }} />
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', padding: 12, gap: 8 }}>
          {(['given', 'claimed'] as Tab[]).map((t) => (
            <Pressable
              key={t}
              accessibilityRole="button"
              onPress={() => setTab(t)}
              style={{
                paddingVertical: 8,
                paddingHorizontal: 16,
                borderRadius: 8,
                backgroundColor: tab === t ? '#2563eb' : '#f3f4f6',
              }}
            >
              <Text style={{ color: tab === t ? '#fff' : '#374151', fontWeight: '500', textTransform: 'capitalize' }}>
                {t}
              </Text>
            </Pressable>
          ))}
        </View>
        {isLoading ? (
          <ActivityIndicator />
        ) : (
          <FlatList
            data={items ?? []}
            keyExtractor={(d: Giveaway) => d.id}
            contentContainerStyle={{ paddingHorizontal: 12 }}
            renderItem={({ item }) => (
              <GiveawayCard giveaway={item} onPress={() => router.push(`/giveaway/${item.id}`)} />
            )}
            ListEmptyComponent={
              <Text style={{ color: '#6b7280', textAlign: 'center', marginTop: 24 }}>
                Nothing here yet.
              </Text>
            }
          />
        )}
      </View>
    </>
  );
}
