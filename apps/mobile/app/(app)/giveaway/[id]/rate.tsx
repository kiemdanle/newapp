// apps/mobile/app/(app)/giveaway/[id]/rate.tsx
import { View } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { TransactionRatingForm } from '@/features/giveaways/TransactionRatingForm';
import type { AppNavigationProp } from '@/navigation/AppNavigator';

export default function RateTransactionScreen() {
  const { id } = useRoute().params as { id: string };
  const navigation = useNavigation<AppNavigationProp>();

  return (
    <View style={{ flex: 1 }}>
      <TransactionRatingForm giveawayId={id ?? ''} onDone={() => navigation.goBack()} />
    </View>
  );
}
