import { redis } from '@/lib/redis';
import { NextRequest } from 'next/server';

interface RateLimitOptions {
  windowMs: number;
  max: number;
  keyPrefix?: string;
}

export async function rateLimit(
  req: NextRequest,
  options: RateLimitOptions
): Promise<{ success: boolean; remaining: number; reset: number }> {
  const { windowMs, max, keyPrefix = 'rl' } = options;

  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    req.headers.get('x-real-ip') ||
    'unknown';

  const key = `${keyPrefix}:${ip}`;
  const windowSecs = Math.ceil(windowMs / 1000);

  try {
    const current = await redis.incr(key);
    if (current === 1) {
      await redis.expire(key, windowSecs);
    }

    const ttl = await redis.ttl(key);
    const reset = Date.now() + ttl * 1000;

    if (current > max) {
      return { success: false, remaining: 0, reset };
    }

    return { success: true, remaining: max - current, reset };
  } catch {
    return { success: true, remaining: max, reset: Date.now() + windowMs };
  }
}
