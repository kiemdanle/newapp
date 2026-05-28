import type CircuitBreaker from 'opossum';

const registry = new Map<string, CircuitBreaker>();

export function register(name: string, breaker: CircuitBreaker): void {
  registry.set(name, breaker);
}

export function getBreaker(name: string): CircuitBreaker {
  const b = registry.get(name);
  if (!b) throw new Error(`Breaker not registered: ${name}`);
  return b;
}

export function getAllBreakers(): { name: string; breaker: CircuitBreaker }[] {
  return Array.from(registry.entries()).map(([name, breaker]) => ({ name, breaker }));
}
