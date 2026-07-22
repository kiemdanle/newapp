// apps/mobile/app/(app)/(tabs)/giveaways.tsx
import { useNavigation } from '@react-navigation/native';
import type { AppNavigationProp } from '@/navigation/AppNavigator';
import { GiveawayFeed } from '@/features/giveaways/GiveawayFeed';

export default function GiveawaysTabScreen() {
  const navigation = useNavigation<AppNavigationProp>();

  return (
    <GiveawayFeed
      onOpen={(id: string) => navigation.push('Giveaway', { id })}
      onNew={() => navigation.push('GiveawayNew')}
    />
  );
}
