import CircuitBreaker from 'opossum';
import { logger } from '../logger.js';

export interface BreakerOpts {
  name: string;
  timeout: number;
  errorThresholdPercentage: number;
  resetTimeout: number;
  volumeThreshold: number;
}

export function makeBreaker<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  opts: BreakerOpts,
): CircuitBreaker<TArgs, TResult> {
  const breaker = new CircuitBreaker(fn, {
    timeout: opts.timeout,
    errorThresholdPercentage: opts.errorThresholdPercentage,
    resetTimeout: opts.resetTimeout,
    volumeThreshold: opts.volumeThreshold,
    name: opts.name,
  });
  breaker.on('open', () => logger.warn({ breaker: opts.name }, 'circuit opened'));
  breaker.on('halfOpen', () => logger.info({ breaker: opts.name }, 'circuit half-open'));
  breaker.on('close', () => logger.info({ breaker: opts.name }, 'circuit closed'));
  return breaker;
}
