// apps/mobile/src/features/deals/useOptimisticDealVote.ts
import { useDealVote, useDeleteDealVote } from '../../api/deals';

type VoteValue = -1 | 1 | 0;

/**
 * Optimistic vote hook that immediately updates the deal card UI while the
 * mutation is in flight. `0` means "remove my vote" (calls DELETE).
 */
export function useOptimisticDealVote(dealId: string) {
  const vote = useDealVote();
  const del = useDeleteDealVote();

  return {
    mutate: ({ next, prev }: { next: VoteValue; prev: VoteValue | null }) => {
      if (next === 0) {
        del.mutate(dealId);
      } else {
        vote.mutate({ dealId, value: next as -1 | 1 });
      }
    },
    isPending: vote.isPending || del.isPending,
  };
}
