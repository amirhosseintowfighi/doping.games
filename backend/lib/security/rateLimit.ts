// lib/security/rateLimit.ts
// Sliding-window rate limiter on Redis sorted sets. One Lua script = one atomic decision,
// so parallel requests cannot slip past the limit between a read and a write.
import Redis from 'ioredis';
import { randomUUID } from 'node:crypto';

const redis = new Redis(process.env.REDIS_URL ?? 'redis://127.0.0.1:6379', { maxRetriesPerRequest: 2 });

// KEYS[1] = bucket   ARGV = now(ms), window(ms), limit, member
const SLIDING_WINDOW = `
local key, now, window, limit = KEYS[1], tonumber(ARGV[1]), tonumber(ARGV[2]), tonumber(ARGV[3])
redis.call('ZREMRANGEBYSCORE', key, 0, now - window)
local count = redis.call('ZCARD', key)
if count >= limit then
  local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
  return {0, count, tonumber(oldest[2]) + window - now}
end
redis.call('ZADD', key, now, ARGV[4])
redis.call('PEXPIRE', key, window)
return {1, count + 1, 0}
`;

export interface RateLimitRule {
  name: string;
  limit: number;
  windowMs: number;
}

export const RULES = {
  login: { name: 'login', limit: 5, windowMs: 15 * 60_000 }, // per IP and per account
  dnsWhitelist: { name: 'dns-whitelist', limit: 6, windowMs: 60 * 60_000 }, // per user
  paymentCallback: { name: 'pay-callback', limit: 30, windowMs: 60_000 }, // per IP
  adminMutation: { name: 'admin-mutation', limit: 120, windowMs: 60_000 }, // per admin
} satisfies Record<string, RateLimitRule>;

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
}

export async function rateLimit(rule: RateLimitRule, subject: string): Promise<RateLimitResult> {
  const key = `rl:${rule.name}:${subject}`;
  try {
    const [allowed, count, retryMs] = (await redis.eval(
      SLIDING_WINDOW, 1, key, Date.now(), rule.windowMs, rule.limit, randomUUID(),
    )) as [number, number, number];
    return {
      allowed: allowed === 1,
      remaining: Math.max(0, rule.limit - count),
      retryAfterSec: Math.ceil(retryMs / 1000),
    };
  } catch (err) {
    // Fail closed: if Redis is down, login and payment endpoints refuse rather than run unlimited.
    console.error('[rateLimit] redis unavailable', err);
    return { allowed: false, remaining: 0, retryAfterSec: 30 };
  }
}

export function tooManyRequests(result: RateLimitResult): Response {
  return Response.json(
    { error: 'rate_limited', message: 'تعداد درخواست‌ها بیش از حد مجاز است. کمی بعد دوباره تلاش کنید.' },
    { status: 429, headers: { 'Retry-After': String(result.retryAfterSec) } },
  );
}
