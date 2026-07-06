import Redis from 'ioredis';

const globalForRedis = globalThis as unknown as { redis: Redis | undefined };

function createRedisClient(): Redis {
  const client = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
  });

  client.on('error', (err) => {
    console.error('[Redis] Error:', err.message);
  });

  client.on('connect', () => {
    console.log('[Redis] Connected');
  });

  return client;
}

export const redis = globalForRedis.redis ?? createRedisClient();

if (process.env.NODE_ENV !== 'production') globalForRedis.redis = redis;

export async function setEx(key: string, seconds: number, value: string): Promise<void> {
  await redis.setex(key, seconds, value);
}

export async function get(key: string): Promise<string | null> {
  return redis.get(key);
}

export async function del(key: string): Promise<void> {
  await redis.del(key);
}

export async function exists(key: string): Promise<boolean> {
  return (await redis.exists(key)) === 1;
}
