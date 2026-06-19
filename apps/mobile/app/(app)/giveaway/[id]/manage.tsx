// apps/mobile/app/(app)/giveaway/[id]/manage.tsx
import { ActivityIndicator, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useGiveaway, useGiveawayClaims, useSelectClaim } from '@/api/giveaways';
import type { Claim } from '@expyrico/shared';
import { ClaimList } from '@/features/giveaways/ClaimList';

export default function ManageGiveawayScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: giveaway } = useGiveaway(id ?? '');
  const { data: claims, isLoading } = useGiveawayClaims(id ?? '');
  const select = useSelectClaim();

  async function handleSelect(claim: Claim) {
    await select.mutateAsync({ giveawayId: id ?? '', claimId: claim.id });
  }

  if (isLoading || !giveaway) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Manage claims' }} />
      <View style={{ flex: 1, padding: 16 }}>
        <ClaimList
          claims={claims ?? []}
          isGiver
          selectedRecipientId={giveaway.selectedRecipientId}
          onSelect={handleSelect}
          selecting={select.isPending}
        />
      </View>
    </>
  );
}
