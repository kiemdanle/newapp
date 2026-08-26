// apps/mobile/src/features/giveaways/GiveawayFeed.tsx
import React from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
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
  const insets = useSafeAreaInsets();
  const fabBottom = 84 + Math.max(insets.bottom, 0);

  const q = useGiveawayFeed('open');
  const items = q.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.bg }]}>
      {/* Top Header */}
      <View style={styles.headerRow}>
        <Text style={[styles.heading, { color: theme.colors.text }]}>Giveaways</Text>
        <Text style={[styles.subheading, { color: theme.colors.textMuted }]}>
          Offer items you cannot use in time, or claim food nearby.
        </Text>
      </View>

      <FlatList
        data={items}
        keyExtractor={(d: Giveaway) => d.id}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: 150 + insets.bottom },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={q.isRefetching}
            onRefresh={() => q.refetch()}
            tintColor={theme.colors.primary}
            colors={[theme.colors.primary]}
          />
        }
        renderItem={({ item }) => (
          <GiveawayCard giveaway={item} onPress={() => onOpen(item.id)} />
        )}
        onEndReached={() => {
          if (q.hasNextPage && !q.isFetchingNextPage) {
            q.fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.4}
        ListEmptyComponent={
          q.isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
            </View>
          ) : (
            <View style={{ marginTop: 24 }}>
              <EmptyState
                icon="gift"
                title="No giveaways yet"
                body="Share a sealed item before it expires, or check again for nearby offers."
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Share the first item"
                onPress={onNew}
                style={({ pressed }) => [
                  styles.emptyStateAction,
                  {
                    backgroundColor: pressed ? theme.colors.primaryDark : theme.colors.primary,
                    borderRadius: theme.radii.pill,
                  },
                ]}
              >
                <Text style={[styles.emptyStateActionText, { color: theme.colors.primaryFg }]}>
                  + Share the first item
                </Text>
              </Pressable>
            </View>
          )
        }
        ListFooterComponent={
          q.isFetchingNextPage ? (
            <View style={styles.footerLoader}>
              <ActivityIndicator color={theme.colors.primary} />
            </View>
          ) : null
        }
      />

      {/* Floating Action Button (FAB) positioned cleanly above floating tab bar */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Share item"
        onPress={onNew}
        style={({ pressed }) => [
          styles.fab,
          {
            bottom: fabBottom,
            backgroundColor: pressed ? theme.colors.primaryDark : theme.colors.primary,
            shadowColor: '#000',
          },
        ]}
      >
        <Ionicons name="add" size={22} color={theme.colors.primaryFg} style={{ marginRight: 4 }} />
        <Text style={[styles.fabText, { color: theme.colors.primaryFg }]}>Share Item</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerRow: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 10,
  },
  heading: {
    fontSize: 26,
    fontWeight: '800',
  },
  subheading: {
    fontSize: 13,
    marginTop: 2,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 6,
  },
  loadingContainer: {
    paddingVertical: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerLoader: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  emptyStateAction: {
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginTop: 16,
    minHeight: 46,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyStateActionText: {
    fontWeight: '700',
    fontSize: 14,
  },
  fab: {
    position: 'absolute',
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 28,
    minHeight: 50,
    elevation: 6,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
  },
  fabText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
