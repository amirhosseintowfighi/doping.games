// app/api/dns/whitelist/route.ts
// "ثبت آی‌پی فعلی من در فایروال": syncs the caller's public IP into the MikroTik address-list
// that the DNS input chain accepts. Everything else is dropped on UDP/TCP 53.
import { audit, query, withTransaction } from '@/lib/db';
import { MikroTikService } from '@/lib/mikrotik/MikroTikService';
import { loadRouter } from '@/lib/mikrotik/provisioning';
import { dnsWhitelistSchema, publicIPv4 } from '@/lib/schemas';
import { guarded, json } from '@/lib/security/guard';
import { RULES } from '@/lib/security/rateLimit';

export const GET = guarded({ roles: ['USER', 'SUPER_ADMIN'] }, async ({ session, ip }) => {
  const rows = await query(
    `SELECT id, host(ip) AS ip, label, created_at FROM dns_whitelist WHERE user_id = $1 ORDER BY created_at DESC`,
    [session!.userId],
  );
  return json({ detectedIp: ip, entries: rows });
});

export const POST = guarded(
  { roles: ['USER', 'SUPER_ADMIN'], schema: dnsWhitelistSchema, limit: { rule: RULES.dnsWhitelist, by: 'user' } },
  async ({ session, input, ip }) => {
    const userId = session!.userId;
    // No explicit IP = the address this request came from, re-validated as public.
    const target = publicIPv4.safeParse(input.ip ?? ip);
    if (!target.success) return json({ error: 'invalid_ip', message: 'آی‌پی عمومی شما قابل تشخیص نیست.' }, 422);

    const result = await withTransaction(async (tx) => {
      const plan = await tx.query<{ dns_slots: number; dns_router_id: string }>(
        `SELECT p.dns_slots, s.dns_router_id
           FROM subscriptions s JOIN plans p ON p.id = s.plan_id
          WHERE s.user_id = $1 AND s.status = 'active' AND p.dns_slots > 0
          ORDER BY s.expires_at DESC LIMIT 1 FOR UPDATE OF s`,
        [userId],
      );
      const sub = plan.rows[0];
      if (!sub) return { status: 402 as const, body: { error: 'no_dns_plan', message: 'سرویس DNS فعالی ندارید.' } };

      const existing = await tx.query<{ ip: string }>(`SELECT host(ip) AS ip FROM dns_whitelist WHERE user_id = $1`, [userId]);
      if (existing.rows.some((r) => r.ip === target.data)) return { status: 200 as const, body: { ok: true, ip: target.data, already: true } };
      if (existing.rows.length >= sub.dns_slots) {
        return { status: 409 as const, body: { error: 'slots_full', message: `سقف ${sub.dns_slots} آی‌پی پر شده است. یکی را حذف کنید.` } };
      }

      const mikrotik = new MikroTikService(await loadRouter(tx, sub.dns_router_id));
      try {
        const entryId = await mikrotik.whitelistDnsIp(userId, target.data);
        await tx.query(
          `INSERT INTO dns_whitelist (user_id, ip, label, router_entry_id) VALUES ($1, $2, $3, $4)`,
          [userId, target.data, input.label ?? null, entryId],
        );
      } finally {
        mikrotik.close();
      }
      return { status: 201 as const, body: { ok: true, ip: target.data } };
    });

    if (result.status < 300) {
      await audit({ category: 'dns', level: 'info', action: 'whitelist.add', actorId: userId, ip, detail: { address: target.data } });
    }
    return json(result.body, result.status);
  },
);
