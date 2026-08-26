// apps/mobile/app/(app)/giveaway/mine.tsx
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import type { Giveaway } from '@expyrico/shared';
import { GiveawayCard } from '@/features/giveaways/GiveawayCard';
import { GiveawayQuickEditModal } from '@/features/giveaways/GiveawayQuickEditModal';
import { useUpdateGiveaway, useCancelGiveaway } from '@/api/giveaways';
import { useSessionStore } from '@/auth/session-store';
import { useTheme } from '@/theme/useTheme';
import type { AppNavigationProp } from '@/navigation/AppNavigator';

type Tab = 'given' | 'claimed';

export default function MyGiveawaysScreen() {
  const theme = useTheme();
  const navigation = useNavigation<AppNavigationProp>();
  const currentUserId = useSessionStore((s) => s.user?.id ?? null);
  const [tab, setTab] = useState<Tab>('given');
  const [editingGiveaway, setEditingGiveaway] = useState<Giveaway | null>(null);

  const updateGiveaway = useUpdateGiveaway();
  const cancelGiveaway = useCancelGiveaway();

  const { data: items, isLoading, refetch } = useQuery({
    queryKey: ['my-giveaways', tab],
    queryFn: () => {
      const path = '/giveaways';
      return apiClient.get<{ items: Giveaway[] }>(path).then((r) => {
        const all = r.items ?? [];
        if (tab === 'given') {
          return currentUserId ? all.filter((g) => g.giverUserId === currentUserId) : all;
        }
        return all.filter((g) => Boolean(g.myClaim));
      });
    },
  });

  const handleEdit = useCallback((giveaway: Giveaway) => {
    setEditingGiveaway(giveaway);
  }, []);

  const handleSaveEdit = useCallback(
    async (patch: {
      title: string;
      locationText: string;
      description?: string;
      photoUrl?: string | null;
      photoUrls?: string[];
    }) => {
      if (!editingGiveaway) return;
      await updateGiveaway.mutateAsync({
        id: editingGiveaway.id,
        patch,
      });
      void refetch();
    },
    [editingGiveaway, updateGiveaway, refetch],
  );

  const handleDelete = useCallback(
    (giveaway: Giveaway) => {
      Alert.alert(
        'Cancel Giveaway',
        `Are you sure you want to cancel "${giveaway.title}"?`,
        [
          { text: 'Keep item', style: 'cancel' },
          {
            text: 'Cancel Giveaway',
            style: 'destructive',
            onPress: async () => {
              await cancelGiveaway.mutateAsync(giveaway.id);
              void refetch();
            },
          },
        ],
      );
    },
    [cancelGiveaway, refetch],
  );

  const handleManage = useCallback(
    (giveaway: Giveaway) => {
      navigation.push('GiveawayManage', { id: giveaway.id });
    },
    [navigation],
  );

  const handleShare = useCallback((giveaway: Giveaway) => {
    void Share.share({
      message: `Check out this giveaway on Expyrico: ${giveaway.title} in ${giveaway.locationText}`,
      title: giveaway.title,
    });
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.bg }]}>
      <View style={styles.tabsRow}>
        {(['given', 'claimed'] as Tab[]).map((t) => (
          <Pressable
            key={t}
            accessibilityRole="button"
            onPress={() => setTab(t)}
            style={[
              styles.tabBtn,
              {
                backgroundColor: tab === t ? theme.colors.primary : theme.colors.bgElevated,
                borderColor: tab === t ? theme.colors.primary : theme.colors.border,
                borderRadius: theme.radii.pill,
              },
            ]}
          >
            <Text
              style={[
                styles.tabText,
                {
                  color: tab === t ? theme.colors.primaryFg : theme.colors.text,
                  fontWeight: tab === t ? '700' : '500',
                },
              ]}
            >
              {t === 'given' ? '🎁 Items Shared' : '📥 Claimed Items'}
            </Text>
          </Pressable>
        ))}
      </View>

      {isLoading ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : (
        <FlatList
          data={items ?? []}
          keyExtractor={(d: Giveaway) => d.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <GiveawayCard
              giveaway={item}
              currentUserId={currentUserId}
              onPress={() => navigation.push('Giveaway', { id: item.id })}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onManage={handleManage}
              onShare={handleShare}
            />
          )}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={[styles.emptyText, { color: theme.colors.textMuted }]}>
                {tab === 'given'
                  ? 'You haven’t shared any giveaway items yet.'
                  : 'You haven’t claimed any giveaway items yet.'}
              </Text>
            </View>
          }
        />
      )}

      {/* Quick Edit Modal */}
      <GiveawayQuickEditModal
        visible={Boolean(editingGiveaway)}
        giveaway={editingGiveaway}
        onClose={() => setEditingGiveaway(null)}
        onSave={handleSaveEdit}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tabsRow: {
    flexDirection: 'row',
    padding: 14,
    gap: 10,
  },
  tabBtn: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderWidth: 1,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabText: {
    fontSize: 14,
    textTransform: 'capitalize',
  },
  loaderWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 40,
  },
  listContent: {
    paddingHorizontal: 14,
    paddingBottom: 124,
  },
  emptyWrap: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});
