// Fixed-window rate limiter kept in PostgreSQL, so every app instance behind a load balancer shares
// the same counters. One upsert per check; stale rows are swept by the background job.
import { lt, sql as dsql } from 'drizzle-orm';
import { db, schema, sql } from './db';

export async function rateLimit(key: string, limit: number, windowSec: number): Promise<{ ok: boolean; retryAfter: number }> {
  const [row] = await sql<{ hits: number; window_start: Date }[]>`
    insert into rate_limits (key, hits, window_start) values (${key}, 1, now())
    on conflict (key) do update set
      hits = case when rate_limits.window_start < now() - make_interval(secs => ${windowSec}) then 1 else rate_limits.hits + 1 end,
      window_start = case when rate_limits.window_start < now() - make_interval(secs => ${windowSec}) then now() else rate_limits.window_start end
    returning hits, window_start`;
  if (row!.hits <= limit) return { ok: true, retryAfter: 0 };
  const retryAfter = Math.max(1, Math.ceil((new Date(row!.window_start).getTime() + windowSec * 1000 - Date.now()) / 1000));
  return { ok: false, retryAfter };
}

/** Rows whose window ended more than a day ago (no limit here is longer than a day). */
export async function sweepRateLimits() {
  await db.delete(schema.rateLimits).where(lt(schema.rateLimits.windowStart, dsql`now() - interval '1 day'`));
}
