// apps/mobile/app/(app)/giveaway/[id].tsx
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useGiveaway, useCancelGiveaway, useConfirmReceived, useHandOffGiveaway } from '@/api/giveaways';
import { useReputation } from '@/api/reputation';
import { GiveawayStatusBadge } from '@/features/giveaways/GiveawayStatusBadge';
import { ClaimButton } from '@/features/giveaways/ClaimButton';
import { useSessionStore } from '@/auth/session-store';

export default function GiveawayDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: giveaway, isLoading } = useGiveaway(id ?? '');
  const userId = useSessionStore((s) => s.user?.id ?? null);
  const cancel = useCancelGiveaway();
  const handOff = useHandOffGiveaway();
  const confirm = useConfirmReceived();

  if (isLoading || !giveaway) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: '#6b7280' }}>Loading…</Text>
      </View>
    );
  }

  const isGiver = userId === giveaway.giverUserId;
  const isSelectedRecipient = userId === giveaway.selectedRecipientId;

  return (
    <>
      <Stack.Screen options={{ title: giveaway.title }} />
      <ScrollView style={{ flex: 1, padding: 16 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontSize: 24, fontWeight: '700', color: '#111827', flex: 1 }}>
            {giveaway.title}
          </Text>
          <GiveawayStatusBadge status={giveaway.status} />
        </View>

        {giveaway.description ? (
          <Text style={{ color: '#374151', marginTop: 8 }}>{giveaway.description}</Text>
        ) : null}

        <Text style={{ color: '#6b7280', marginTop: 8 }}>📍 {giveaway.locationText}</Text>
        {giveaway.country && <Text style={{ color: '#6b7280' }}>🇺🇳 {giveaway.country}</Text>}

        {giveaway.giver && (
          <View style={{ marginTop: 12, padding: 12, backgroundColor: '#f9fafb', borderRadius: 8 }}>
            <Text style={{ fontWeight: '600', color: '#111827' }}>
              Given by {giveaway.giver.firstName}
            </Text>
            <GiverReputation userId={giveaway.giver.id} />
          </View>
        )}

        <Text style={{ color: '#6b7280', marginTop: 12 }}>
          Claims: {giveaway.claimCount ?? 0}
        </Text>
        {giveaway.claimExpiresAt && (
          <Text style={{ color: '#6b7280', fontSize: 12 }}>
            Claim expires: {new Date(giveaway.claimExpiresAt).toLocaleString()}
          </Text>
        )}

        {/* Actions */}
        <View style={{ marginTop: 16, gap: 12 }}>
          {giveaway.status === 'open' && !isGiver && (
            <ClaimButton
              giveawayId={giveaway.id}
              disabled={!!giveaway.myClaim}
            />
          )}

          {isGiver && giveaway.status === 'open' && (
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push(`/giveaway/${giveaway.id}/manage`)}
              style={{ padding: 12, borderRadius: 8, backgroundColor: '#2563eb', alignItems: 'center' }}
            >
              <Text style={{ color: '#fff', fontWeight: '600' }}>Manage claims</Text>
            </Pressable>
          )}

          {isGiver && giveaway.status === 'claimed' && (
            <Pressable
              accessibilityRole="button"
              disabled={handOff.isPending}
              onPress={() => handOff.mutate(giveaway.id)}
              style={{ padding: 12, borderRadius: 8, backgroundColor: '#d97706', alignItems: 'center' }}
            >
              <Text style={{ color: '#fff', fontWeight: '600' }}>
                {handOff.isPending ? 'Marking…' : 'Mark as handed off'}
              </Text>
            </Pressable>
          )}

          {isSelectedRecipient && giveaway.status === 'handed_off' && (
            <Pressable
              accessibilityRole="button"
              disabled={confirm.isPending}
              onPress={() => confirm.mutate(giveaway.id)}
              style={{ padding: 12, borderRadius: 8, backgroundColor: '#16a34a', alignItems: 'center' }}
            >
              <Text style={{ color: '#fff', fontWeight: '600' }}>
                {confirm.isPending ? 'Confirming…' : 'Confirm received'}
              </Text>
            </Pressable>
          )}

          {giveaway.status === 'completed' && (isGiver || isSelectedRecipient) && (
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push(`/giveaway/${giveaway.id}/rate`)}
              style={{ padding: 12, borderRadius: 8, backgroundColor: '#d97706', alignItems: 'center' }}
            >
              <Text style={{ color: '#fff', fontWeight: '600' }}>Rate this transaction</Text>
            </Pressable>
          )}

          {isGiver && (giveaway.status === 'open' || giveaway.status === 'claimed') && (
            <Pressable
              accessibilityRole="button"
              disabled={cancel.isPending}
              onPress={() => cancel.mutate(giveaway.id)}
              style={{ padding: 12, borderRadius: 8, backgroundColor: '#fecaca', alignItems: 'center' }}
            >
              <Text style={{ color: '#dc2626', fontWeight: '600' }}>
                {cancel.isPending ? 'Cancelling…' : 'Cancel giveaway'}
              </Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </>
  );
}

function GiverReputation({ userId }: { userId: string }) {
  const { data: rep } = useReputation(userId);
  if (!rep) return null;
  return (
    <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
      {rep.giverRatingAvg != null && (
        <Text style={{ color: '#d97706', fontSize: 12 }}>★ {rep.giverRatingAvg.toFixed(1)}</Text>
      )}
      <Text style={{ color: '#6b7280', fontSize: 12 }}>{rep.transactionCount} tx</Text>
    </View>
  );
}
