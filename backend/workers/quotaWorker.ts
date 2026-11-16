// workers/quotaWorker.ts
// Runs as its own process (node --import tsx workers/quotaWorker.ts) next to the Next.js app.
// Every 5 minutes: read Simple Queue counters from every router, add the delta to each
// subscription, and disable the WireGuard peer once the quota or the expiry date is reached.
import { audit, pool, withTransaction } from '../lib/db';
import { MikroTikService, parseQueueBytes, queueName, type RouterRecord } from '../lib/mikrotik/MikroTikService';

const POLL_INTERVAL_MS = 5 * 60 * 1000;
const ADVISORY_LOCK_KEY = 0x646f7069; // "dopi": only one worker instance polls at a time
export const GIB = 1024n ** 3n; // 15 GB plan = 15n * GIB = 16_106_127_360 bytes

interface SubscriptionRow {
  id: string;
  user_id: string;
  wg_peer_id: string;
  queue_id: string;
  quota_bytes: string | null; // BIGINT arrives as string from pg
  used_up: string;
  used_down: string;
  last_seen_up: string;
  last_seen_down: string;
  expires_at: Date;
}

/**
 * Counter delta that survives router reboots and manual resets: when the router reports less than
 * we saw last time, the counter restarted from zero, so everything it shows now is new traffic.
 */
export function counterDelta(current: bigint, lastSeen: bigint): bigint {
  return current >= lastSeen ? current - lastSeen : current;
}

async function pollRouter(router: RouterRecord): Promise<{ checked: number; suspended: number }> {
  const mikrotik = new MikroTikService(router);
  let checked = 0;
  let suspended = 0;
  try {
    const queues = await mikrotik.listQueues();
    const byName = new Map(queues.map((q) => [q.name, q]));

    const subs = await pool.query<SubscriptionRow>(
      `SELECT id, user_id, wg_peer_id, queue_id, quota_bytes, used_up, used_down,
              last_seen_up, last_seen_down, expires_at
         FROM subscriptions
        WHERE router_id = $1 AND status = 'active'`,
      [router.id],
    );

    for (const sub of subs.rows) {
      const queue = byName.get(queueName(sub.id));
      if (!queue) {
        await audit({ category: 'mikrotik', level: 'warn', action: 'queue.missing', detail: { subscriptionId: sub.id, router: router.name } });
        continue;
      }
      checked++;
      const now = parseQueueBytes(queue.bytes);
      const usedUp = BigInt(sub.used_up) + counterDelta(now.up, BigInt(sub.last_seen_up));
      const usedDown = BigInt(sub.used_down) + counterDelta(now.down, BigInt(sub.last_seen_down));
      const quota = sub.quota_bytes === null ? null : BigInt(sub.quota_bytes);

      const overQuota = quota !== null && usedUp + usedDown >= quota;
      const expired = sub.expires_at.getTime() <= Date.now();
      const nextStatus = overQuota ? 'quota_exceeded' : expired ? 'expired' : 'active';

      // Router first: if disabling the peer fails we keep status "active" and retry on the next tick,
      // so the database never claims a user is cut off while the tunnel still passes traffic.
      if (nextStatus !== 'active') {
        await mikrotik.setPeerDisabled(sub.wg_peer_id, true);
        suspended++;
      }

      await pool.query(
        `UPDATE subscriptions
            SET used_up = $2, used_down = $3, last_seen_up = $4, last_seen_down = $5,
                status = $6, usage_synced_at = now()
          WHERE id = $1 AND status = 'active'`,
        [sub.id, usedUp.toString(), usedDown.toString(), now.up.toString(), now.down.toString(), nextStatus],
      );

      if (nextStatus !== 'active') {
        await audit({
          category: 'mikrotik',
          level: 'warn',
          action: `peer.disabled.${nextStatus}`,
          actorId: sub.user_id,
          detail: { subscriptionId: sub.id, router: router.name, usedBytes: (usedUp + usedDown).toString(), quotaBytes: sub.quota_bytes },
        });
      }
    }
    await pool.query(`UPDATE routers SET last_sync_at = now(), last_sync_error = NULL WHERE id = $1`, [router.id]);
  } finally {
    mikrotik.close();
  }
  return { checked, suspended };
}

/**
 * Renewal / top-up: called from the payment flow inside its transaction.
 * A renewal starts a fresh period (usage back to zero, router counters reset);
 * a traffic top-up only raises the quota. Both re-enable the peer.
 */
export async function applyCredit(
  tx: import('pg').PoolClient,
  subscriptionId: string,
  credit: { kind: 'renewal'; quotaBytes: bigint | null; days: number } | { kind: 'topup'; extraBytes: bigint },
): Promise<void> {
  const res = await tx.query<{ router_id: string; wg_peer_id: string; queue_id: string }>(
    `SELECT router_id, wg_peer_id, queue_id FROM subscriptions WHERE id = $1 FOR UPDATE`,
    [subscriptionId],
  );
  const sub = res.rows[0];
  if (!sub) throw new Error(`Subscription ${subscriptionId} not found`);
  const { loadRouter } = await import('../lib/mikrotik/provisioning');
  const mikrotik = new MikroTikService(await loadRouter(tx, sub.router_id));
  try {
    if (credit.kind === 'renewal') {
      await mikrotik.resetQueueCounters(sub.queue_id);
      await tx.query(
        `UPDATE subscriptions
            SET quota_bytes = $2, used_up = 0, used_down = 0, last_seen_up = 0, last_seen_down = 0,
                expires_at = GREATEST(expires_at, now()) + make_interval(days => $3), status = 'active'
          WHERE id = $1`,
        [subscriptionId, credit.quotaBytes?.toString() ?? null, credit.days],
      );
    } else {
      await tx.query(
        `UPDATE subscriptions
            SET quota_bytes = quota_bytes + $2,
                status = CASE WHEN expires_at > now() THEN 'active' ELSE status END
          WHERE id = $1 AND quota_bytes IS NOT NULL`,
        [subscriptionId, credit.extraBytes.toString()],
      );
    }
    const state = await tx.query<{ status: string }>(`SELECT status FROM subscriptions WHERE id = $1`, [subscriptionId]);
    if (state.rows[0]?.status === 'active') await mikrotik.setPeerDisabled(sub.wg_peer_id, false);
  } finally {
    mikrotik.close();
  }
}

export async function runOnce(): Promise<void> {
  await withTransaction(async (tx) => {
    const lock = await tx.query<{ locked: boolean }>('SELECT pg_try_advisory_xact_lock($1) AS locked', [ADVISORY_LOCK_KEY]);
    if (!lock.rows[0]?.locked) return; // another instance is already polling

    const routers = await tx.query<RouterRecord>(
      `SELECT id, name, host, api_port AS "apiPort", api_user AS "apiUser", api_pass_enc AS "apiPassEnc",
              tls_cert_pem AS "tlsCertPem", tls_fingerprint256 AS "tlsFingerprint256",
              wg_interface AS "wgInterface", dns_address_list AS "dnsAddressList"
         FROM routers WHERE role = 'entry' AND enabled`,
    );
    // Routers are independent: one unreachable node must not block accounting on the others.
    const results = await Promise.allSettled(routers.rows.map(pollRouter));
    for (const [i, result] of results.entries()) {
      const router = routers.rows[i]!;
      if (result.status === 'rejected') {
        const message = result.reason instanceof Error ? result.reason.message : String(result.reason);
        await pool.query(`UPDATE routers SET last_sync_error = $2 WHERE id = $1`, [router.id, message]);
        await audit({ category: 'mikrotik', level: 'critical', action: 'poll.failed', detail: { router: router.name, message } });
      } else {
        console.log(`[quota] ${router.name}: ${result.value.checked} queues checked, ${result.value.suspended} peers suspended`);
      }
    }
  });
}

if (process.argv[1]?.endsWith('quotaWorker.ts') || process.argv[1]?.endsWith('quotaWorker.js')) {
  let running = false;
  const tick = async () => {
    if (running) return; // a slow poll must never overlap the next one
    running = true;
    try {
      await runOnce();
    } catch (err) {
      console.error('[quota] tick failed', err);
    } finally {
      running = false;
    }
  };
  void tick();
  const timer = setInterval(tick, POLL_INTERVAL_MS);
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.on(signal, async () => {
      clearInterval(timer);
      await pool.end();
      process.exit(0);
    });
  }
}
