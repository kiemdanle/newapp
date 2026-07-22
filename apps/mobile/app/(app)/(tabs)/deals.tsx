// apps/mobile/app/(app)/(tabs)/deals.tsx
import { useNavigation } from '@react-navigation/native';
import { useSessionStore } from '@/auth/session-store';
import { DealFeed } from '@/features/deals/DealFeed';
import type { AppNavigationProp } from '@/navigation/AppNavigator';
import type { Deal } from '@expyrico/shared';

export default function DealsTabScreen() {
  const userId = useSessionStore((s) => s.user?.id ?? null);
  const navigation = useNavigation<AppNavigationProp>();

  return (
    <DealFeed
      currentUserId={userId}
      onOpen={(deal: Deal) => navigation.push('Deal', { id: deal.id })}
      onReport={(deal: Deal) =>
        navigation.push('Report', { targetType: 'deal', targetId: deal.id })
      }
    />
  );
}
