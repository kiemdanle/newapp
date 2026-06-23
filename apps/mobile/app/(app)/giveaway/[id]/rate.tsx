// apps/mobile/app/(app)/giveaway/[id]/rate.tsx
import { View } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { TransactionRatingForm } from '@/features/giveaways/TransactionRatingForm';

export default function RateTransactionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <>
      <Stack.Screen options={{ title: 'Rate transaction' }} />
      <View style={{ flex: 1 }}>
        <TransactionRatingForm giveawayId={id ?? ''} onDone={() => router.back()} />
      </View>
    </>
  );
}
