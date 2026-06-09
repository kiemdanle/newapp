import { getBreaker } from '../../services/external/breakers.js';

const NAMES = ['off', 'upcitemdb', 'expo-push'] as const;

export function snapshotBreakers() {
  return NAMES.map((name) => {
    try {
      const b = getBreaker(name);
      const stats = b.stats as { fires?: number; failures?: number; successes?: number };
      return {
        name,
        state: (b.opened ? 'open' : b.halfOpen ? 'halfOpen' : 'closed') as 'open' | 'halfOpen' | 'closed',
        fires: stats.fires ?? 0,
        failures: stats.failures ?? 0,
        successes: stats.successes ?? 0,
        lastFailureAt: null as string | null,
      };
    } catch {
      return {
        name,
        state: 'closed' as const,
        fires: 0,
        failures: 0,
        successes: 0,
        lastFailureAt: null as string | null,
      };
    }
  });
}
