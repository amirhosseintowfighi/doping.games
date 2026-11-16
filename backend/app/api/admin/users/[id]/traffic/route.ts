// app/api/admin/users/[id]/traffic/route.ts
// Admin quick actions from the users table: +GB, reset queue counters, enable/disable peer.
import { z } from 'zod';
import { audit, withTransaction } from '@/lib/db';
import { MikroTikService } from '@/lib/mikrotik/MikroTikService';
import { loadRouter } from '@/lib/mikrotik/provisioning';
import { adminTrafficSchema } from '@/lib/schemas';
import { guarded, json } from '@/lib/security/guard';
import { RULES } from '@/lib/security/rateLimit';
import { applyCredit, GIB } from '@/workers/quotaWorker';

const idParam = z.string().uuid();

export const POST = guarded(
  { roles: ['SUPER_ADMIN'], schema: adminTrafficSchema, limit: { rule: RULES.adminMutation, by: 'user' } },
  async ({ req, session, input, ip }) => {
    const subscriptionId = idParam.safeParse(new URL(req.url).pathname.split('/').at(-2));
    if (!subscriptionId.success) return json({ error: 'invalid_id' }, 422);

    const found = await withTransaction(async (tx) => {
      const res = await tx.query<{ router_id: string; wg_peer_id: string; queue_id: string }>(
        `SELECT router_id, wg_peer_id, queue_id FROM subscriptions WHERE id = $1 FOR UPDATE`,
        [subscriptionId.data],
      );
      const sub = res.rows[0];
      if (!sub) return false;

      if (input.action === 'add_traffic') {
        await applyCredit(tx, subscriptionId.data, { kind: 'topup', extraBytes: BigInt(input.gigabytes ?? 5) * GIB });
        return true;
      }
      const mikrotik = new MikroTikService(await loadRouter(tx, sub.router_id));
      try {
        if (input.action === 'reset_counters') {
          await mikrotik.resetQueueCounters(sub.queue_id);
          await tx.query(
            `UPDATE subscriptions SET used_up = 0, used_down = 0, last_seen_up = 0, last_seen_down = 0 WHERE id = $1`,
            [subscriptionId.data],
          );
        } else {
          const enabled = input.enabled ?? false;
          await mikrotik.setPeerDisabled(sub.wg_peer_id, !enabled);
          await tx.query(`UPDATE subscriptions SET status = $2 WHERE id = $1`, [subscriptionId.data, enabled ? 'active' : 'disabled']);
        }
      } finally {
        mikrotik.close();
      }
      return true;
    });

    if (!found) return json({ error: 'not_found' }, 404);
    await audit({ category: 'admin', level: 'info', action: `subscription.${input.action}`, actorId: session!.userId, ip, detail: { subscriptionId: subscriptionId.data, ...input } });
    return json({ ok: true });
  },
);
