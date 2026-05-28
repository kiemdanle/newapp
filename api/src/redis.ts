import { Redis } from 'ioredis';
import { getConfig } from './config.js';

let _redis: Redis | undefined;

export function getRedis(): Redis {
  if (!_redis) {
    _redis = new Redis(getConfig().redisUrl, { maxRetriesPerRequest: null, lazyConnect: false });
  }
  return _redis;
}

export async function disconnectRedis(): Promise<void> {
  if (_redis) {
    await _redis.quit();
    _redis = undefined;
  }
}
