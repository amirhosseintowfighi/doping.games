import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { fa } from '@/src/data.js';
import { audit } from '@/lib/server/audit';
import { requireUser } from '@/lib/server/auth';
import { db, schema } from '@/lib/server/db';
import { body, clientIp, fail, handle, json, limit } from '@/lib/server/http';
import { publicIp } from '@/lib/server/validators';
import { unwhitelistIp, whitelistIp } from '@/lib/server/vpn';

const Add = z.object({ ip: publicIp.optional(), label: z.string().trim().max(40).default('') });
const Del = z.object({ id: z.string().uuid() });

/** Without an explicit IP, the address this request came from is registered. */
export const POST = handle(async (req) => {
  const user = await requireUser(req);
  await limit(`dns:${user.id}`, 20, 3600);
  const b = await body(req, Add);
  const ip = b.ip ?? clientIp(req);
  if (!publicIp.safeParse(ip).success) fail(422, 'آی‌پی عمومی تو تشخیص داده نشد؛ دستی واردش کن.');
  const sub = (await db.select().from(schema.subscriptions).where(eq(schema.subscriptions.userId, user.id)).limit(1))[0];
  const slots = sub && sub.status !== 'expired' && sub.expiresAt > new Date() ? sub.dnsSlots : 0;
  if (!slots) fail(403, 'پلن فعالت DNS نداره. از صفحه تعرفه‌ها DNS یا پکیج پرو بخر.');
  const [{ n } = { n: 0 }] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.dnsIps).where(eq(schema.dnsIps.userId, user.id));
  if (n! >= slots) fail(409, `سقف ${fa(slots)} آی‌پی پره. اول یکی رو حذف کن.`);
  const [row] = await db.insert(schema.dnsIps).values({ userId: user.id, ip, label: b.label || (b.ip ? 'ثبت دستی' : 'ثبت خودکار') }).onConflictDoNothing().returning();
  if (!row) fail(409, 'این آی‌پی قبلاً ثبت شده.');
  const errors = await whitelistIp(user.id, row!.id, ip);
  await audit('dns', errors.length ? 'warn' : 'info', `address-list add doping-dns-allowed ${ip}${errors.length ? ` · ${errors.join(' | ')}` : ''}`, user.username, clientIp(req));
  return json({ ok: true, ip, pending: errors.length > 0 });
});

export const DELETE = handle(async (req) => {
  const user = await requireUser(req);
  const b = await body(req, Del);
  const [row] = await db.delete(schema.dnsIps).where(and(eq(schema.dnsIps.id, b.id), eq(schema.dnsIps.userId, user.id))).returning();
  if (!row) fail(404, 'این آی‌پی پیدا نشد.');
  await unwhitelistIp(row!.ip, row!.routerEntries);
  await audit('dns', 'info', `address-list remove ${row!.ip}`, user.username, clientIp(req));
  return json({ ok: true });
});
