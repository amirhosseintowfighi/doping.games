// Sliding-window rate limiter kept in process memory. One app instance is the normal deployment;
// with several instances behind a load balancer each enforces its own window, which is still a hard cap per node.
const hits = new Map<string, number[]>();
let sweep = 0;

export function rateLimit(key: string, limit: number, windowSec: number): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  const from = now - windowSec * 1000;
  const list = (hits.get(key) ?? []).filter((t) => t > from);
  if (list.length >= limit) {
    hits.set(key, list);
    return { ok: false, retryAfter: Math.ceil((list[0]! + windowSec * 1000 - now) / 1000) };
  }
  list.push(now);
  hits.set(key, list);
  if (++sweep % 500 === 0) for (const [k, v] of hits) if (!v.some((t) => t > from)) hits.delete(k);
  return { ok: true, retryAfter: 0 };
}

export const resetRateLimits = () => hits.clear();
