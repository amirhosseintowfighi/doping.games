import { desc, eq, sql } from 'drizzle-orm';
import { requireAdmin } from '@/lib/server/auth';
import { db, sql as pg, schema } from '@/lib/server/db';
import { env } from '@/lib/server/env';
import { handle, json } from '@/lib/server/http';

export const GET = handle(async (req) => {
  await requireAdmin(req);
  const [discounts, gateways, orders, totals, daily, byType, referrals] = await Promise.all([
    db.select().from(schema.discounts).orderBy(desc(schema.discounts.createdAt)),
    db.select().from(schema.gateways),
    db.select({ o: schema.orders, username: schema.users.username }).from(schema.orders).innerJoin(schema.users, eq(schema.users.id, schema.orders.userId)).orderBy(desc(schema.orders.createdAt)).limit(100),
    db.select({
      paid: sql<number>`coalesce(sum(amount) filter (where status = 'paid' and type <> 'topup'), 0)::bigint`,
      topups: sql<number>`coalesce(sum(amount) filter (where status = 'paid' and type = 'topup'), 0)::bigint`,
      ok: sql<number>`count(*) filter (where status = 'paid')::int`,
      bad: sql<number>`count(*) filter (where status in ('failed', 'canceled'))::int`,
      month: sql<number>`coalesce(sum(amount) filter (where status = 'paid' and type <> 'topup' and paid_at > now() - interval '30 days'), 0)::bigint`,
    }).from(schema.orders),
    // Paid sales per Tehran calendar day for the last 30 days (top-ups shown apart: they are prepayments).
    pg<{ day: string; sales: string; topups: string; n: number }[]>`
      select to_char((paid_at at time zone 'Asia/Tehran')::date, 'YYYY-MM-DD') as day,
             coalesce(sum(amount) filter (where type <> 'topup'), 0) as sales,
             coalesce(sum(amount) filter (where type = 'topup'), 0) as topups,
             count(*)::int as n
      from orders where status = 'paid' and paid_at > now() - interval '30 days'
      group by 1 order by 1`,
    db.select({ type: schema.orders.type, n: sql<number>`count(*)::int`, sum: sql<string>`coalesce(sum(amount),0)` }).from(schema.orders)
      .where(sql`status = 'paid' and paid_at > now() - interval '30 days'`).groupBy(schema.orders.type),
    db.select({ n: sql<number>`count(*) filter (where referral_rewarded_at is not null)::int`, signups: sql<number>`count(*) filter (where referred_by is not null)::int` }).from(schema.users),
  ]);
  return json({
    discounts: discounts.map((d) => ({ id: d.id, code: d.code, percent: d.percent, used: d.used, max: d.maxUses, active: d.active })),
    gateways: gateways.map((g) => ({ id: g.id, name: g.name, kind: g.kind, enabled: g.enabled, mode: g.id === 'zarinpal' ? env.paymentMode : null })),
    orders: orders.map(({ o, username }) => ({ id: o.id, number: `INV-${o.number}`, username, title: o.title, amount: o.amount, gateway: o.gateway, status: o.status, at: o.createdAt.getTime(), refId: o.refId })),
    daily: daily.map((d) => ({ day: d.day, sales: Number(d.sales), topups: Number(d.topups), n: d.n })),
    byType: byType.map((t) => ({ type: t.type, n: t.n, sum: Number(t.sum) })),
    referrals: { signups: referrals[0]?.signups ?? 0, converted: referrals[0]?.n ?? 0 },
    totals: { paid: Number(totals[0]!.paid), topups: Number(totals[0]!.topups), ok: totals[0]!.ok, bad: totals[0]!.bad, month: Number(totals[0]!.month) },
  });
});
