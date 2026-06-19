// apps/mobile/app/(app)/(tabs)/giveaways.tsx
import { router } from 'expo-router';
import { GiveawayFeed } from './giveaway-feed';

export default function GiveawaysTabScreen() {
  return (
    <GiveawayFeed
      onOpen={(id: string) => router.push(`/giveaway/${id}`)}
      onNew={() => router.push('/giveaway/new')}
    />
  );
}
