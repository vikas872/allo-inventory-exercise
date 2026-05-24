import { Redis } from '@upstash/redis'
import { NextResponse } from 'next/server';

const isRedisConfigured = !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);

export const redis = isRedisConfigured 
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  : null;

export async function withIdempotency(
  key: string,
  operation: () => Promise<NextResponse>,
  ttlSeconds: number = 86400 // default 24 hours
): Promise<NextResponse> {
  if (!redis) {
    return operation();
  }

  const cacheKey = `idempotency:${key}`;
  
  const cached = await redis.get<{ status: number, body: any }>(cacheKey);
  if (cached) {
    return NextResponse.json(cached.body, { status: cached.status });
  }

  const response = await operation();
  
  const cloned = response.clone();
  
  let body;
  try {
    body = await cloned.json();
  } catch {
    body = await cloned.text();
  }

  await redis.set(cacheKey, { status: response.status, body }, { ex: ttlSeconds });
  
  return response;
}
