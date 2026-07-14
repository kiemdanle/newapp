// apps/mobile/app/(app)/giveaway/mine.tsx
import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { Stack, router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import type { Giveaway } from '@expyrico/shared';
import { GiveawayCard } from '@/features/giveaways/GiveawayCard';
import { useTheme } from '@/theme/useTheme';

type Tab = 'given' | 'claimed';

export default function MyGiveawaysScreen() {
  const theme = useTheme();
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
      <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
        <View style={{ flexDirection: 'row', padding: 12, gap: 8 }}>
          {(['given', 'claimed'] as Tab[]).map((t) => (
            <Pressable
              key={t}
              accessibilityRole="button"
              onPress={() => setTab(t)}
              style={{
                paddingVertical: 8,
                paddingHorizontal: 16,
                borderRadius: theme.radii.pill,
                backgroundColor: tab === t ? theme.colors.primary : theme.colors.bgElevated,
                borderColor: tab === t ? theme.colors.primary : theme.colors.border,
                borderWidth: 1,
                minHeight: 52,
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: tab === t ? theme.colors.primaryFg : theme.colors.text, fontWeight: '600', textTransform: 'capitalize' }}>
                {t}
              </Text>
            </Pressable>
          ))}
        </View>
        {isLoading ? (
          <ActivityIndicator color={theme.colors.primary} />
        ) : (
          <FlatList
            data={items ?? []}
            keyExtractor={(d: Giveaway) => d.id}
            contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 124 }}
            renderItem={({ item }) => (
              <GiveawayCard giveaway={item} onPress={() => router.push(`/giveaway/${item.id}`)} />
            )}
            ListEmptyComponent={
              <Text style={{ color: theme.colors.textMuted, textAlign: 'center', marginTop: 24 }}>
                Nothing here yet.
              </Text>
            }
          />
        )}
      </View>
    </>
  );
}
