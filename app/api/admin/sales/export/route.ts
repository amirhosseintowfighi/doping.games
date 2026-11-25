import { and, desc, eq, gte } from 'drizzle-orm';
import { requireAdmin } from '@/lib/server/auth';
import { db, schema } from '@/lib/server/db';
import { handle } from '@/lib/server/http';

const cell = (v: unknown) => {
  const s = v == null ? '' : String(v);
  // Quote everything; a leading = + - @ is neutralised so spreadsheets don't run it as a formula.
  return `"${(/^[=+\-@]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`;
};

/** Paid orders as CSV (UTF-8 with BOM so Excel shows Persian). ?days=30 (1–366). */
export const GET = handle(async (req) => {
  await requireAdmin(req);
  const days = Math.min(366, Math.max(1, Number(new URL(req.url).searchParams.get('days')) || 30));
  const rows = await db.select({ o: schema.orders, username: schema.users.username, email: schema.users.email }).from(schema.orders)
    .innerJoin(schema.users, eq(schema.users.id, schema.orders.userId))
    .where(and(eq(schema.orders.status, 'paid'), gte(schema.orders.paidAt, new Date(Date.now() - days * 86_400_000))))
    .orderBy(desc(schema.orders.paidAt));
  const head = ['invoice', 'paid_at', 'username', 'email', 'type', 'title', 'subtotal', 'discount', 'amount_toman', 'gateway', 'ref_id', 'card'];
  const lines = rows.map(({ o, username, email }) => [
    `INV-${o.number}`, o.paidAt?.toISOString(), username, email, o.type, o.title, o.subtotal, o.discountAmount, o.amount, o.gateway, o.refId, o.cardPan,
  ].map(cell).join(','));
  const csv = '﻿' + [head.join(','), ...lines].join('\r\n') + '\r\n';
  return new Response(csv, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="doping-sales-${days}d.csv"`, 'Cache-Control': 'no-store' } });
});
