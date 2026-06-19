// apps/mobile/app/(app)/(tabs)/deals.tsx
import { router } from 'expo-router';
import { useSessionStore } from '@/auth/session-store';
import { DealFeed } from '@/features/deals/DealFeed';
import type { Deal } from '@expyrico/shared';

export default function DealsTabScreen() {
  const userId = useSessionStore((s) => s.user?.id ?? null);

  return (
    <DealFeed
      currentUserId={userId}
      onOpen={(deal: Deal) => router.push(`/deal/${deal.id}`)}
      onReport={(deal: Deal) =>
        router.push({ pathname: '/report', params: { targetType: 'deal', targetId: deal.id } })
      }
    />
  );
}
