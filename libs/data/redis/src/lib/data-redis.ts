import Redis from 'ioredis';

import type { ReplayStore } from 'security-replay';

export class RedisReplayStore implements ReplayStore {
  constructor(private readonly client: Redis) {}

  async has(key: string): Promise<boolean> {
    return (await this.client.exists(key)) === 1;
  }

  async set(key: string, ttlSeconds: number): Promise<void> {
    await this.client.set(key, '1', 'EX', ttlSeconds);
  }
}

export function createRedisClient(redisUrl?: string): Redis | undefined {
  if (!redisUrl) {
    return undefined;
  }

  return new Redis(redisUrl, { lazyConnect: true, maxRetriesPerRequest: 1 });
}
