import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { audit } from '@/lib/server/audit';
import { requireAdmin } from '@/lib/server/auth';
import { db, schema } from '@/lib/server/db';
import { body, clientIp, fail, handle, json } from '@/lib/server/http';
import { GB, resetCounters, syncPeerState } from '@/lib/server/vpn';

const Input = z.discriminatedUnion('action', [
  z.object({ action: z.literal('traffic'), gb: z.number().int().min(1).max(1000) }),
  z.object({ action: z.literal('reset') }),
  z.object({ action: z.literal('peer'), on: z.boolean() }),
  z.object({ action: z.literal('days'), days: z.number().int().min(1).max(365) }),
  z.object({ action: z.literal('wallet'), amount: z.number().int().min(-50_000_000).max(50_000_000).refine((n) => n !== 0) }),
  z.object({ action: z.literal('role'), role: z.enum(['user', 'support', 'admin']) }),
  z.object({ action: z.literal('account'), disabled: z.boolean() }),
  z.object({ action: z.literal('verify') }),
  z.object({ action: z.literal('logout') }),
]);

export const POST = handle(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const admin = await requireAdmin(req);
  const { id } = await ctx.params;
  const b = await body(req, Input);
  const u = (await db.select().from(schema.users).where(eq(schema.users.id, id)).limit(1))[0];
  if (!u) fail(404, 'کاربر پیدا نشد.');
  const sub = (await db.select().from(schema.subscriptions).where(eq(schema.subscriptions.userId, id)).limit(1))[0];
  const needSub = () => sub ?? fail(422, 'این کاربر اشتراکی نداره.');
  const ip = clientIp(req);
  let msg = '';
  switch (b.action) {
    case 'traffic': {
      const s = needSub();
      if (s.quotaBytes == null) fail(422, 'این کاربر پلن نامحدود داره.');
      const status = s.status === 'quota' ? 'active' : s.status;
      await db.update(schema.subscriptions).set({ quotaBytes: s.quotaBytes! + b.gb * GB, status }).where(eq(schema.subscriptions.id, s.id));
      await syncPeerState(s.id);
      msg = `quota +${b.gb}GB · ${u!.username}`;
      break;
    }
    case 'reset': {
      const s = needSub();
      await db.update(schema.subscriptions).set({ usedUp: 0, usedDown: 0, status: s.status === 'quota' ? 'active' : s.status }).where(eq(schema.subscriptions.id, s.id));
      await resetCounters(s.id);
      await syncPeerState(s.id);
      msg = `usage reset · POST /rest/queue/simple/reset-counters · ${u!.username}`;
      break;
    }
    case 'peer': {
      const s = needSub();
      if (b.on && s.expiresAt <= new Date()) fail(422, 'اشتراک منقضی شده؛ اول تمدید لازمه.');
      if (b.on && s.quotaBytes != null && s.usedUp + s.usedDown >= s.quotaBytes) fail(422, 'حجم این کاربر تموم شده؛ اول حجم اضافه کن.');
      await db.update(schema.subscriptions).set({ status: b.on ? 'active' : 'disabled' }).where(eq(schema.subscriptions.id, s.id));
      await syncPeerState(s.id);
      msg = `peer ${b.on ? 'enabled' : 'disabled'} · ${u!.username}`;
      break;
    }
    case 'days': {
      const s = needSub();
      const from = s.expiresAt > new Date() ? s.expiresAt : new Date();
      await db.update(schema.subscriptions).set({ expiresAt: new Date(from.getTime() + b.days * 86_400_000), status: s.status === 'expired' ? 'active' : s.status }).where(eq(schema.subscriptions.id, s.id));
      await syncPeerState(s.id);
      msg = `+${b.days} days · ${u!.username}`;
      break;
    }
    case 'wallet': {
      const ok = await db.transaction(async (tx) => {
        const [r] = await tx.update(schema.users).set({ wallet: sql`${schema.users.wallet} + ${b.amount}` })
          .where(sql`${schema.users.id} = ${id} and ${schema.users.wallet} + ${b.amount} >= 0`).returning({ wallet: schema.users.wallet });
        if (!r) return false;
        await tx.insert(schema.walletTx).values({ userId: id, amount: b.amount, balance: r.wallet, reason: `اصلاح دستی توسط ${admin.username}` });
        return true;
      });
      if (!ok) fail(422, 'موجودی منفی نمی‌شه.');
      msg = `wallet ${b.amount > 0 ? '+' : ''}${b.amount} T · ${u!.username}`;
      break;
    }
    case 'role':
      if (id === admin.id) fail(422, 'نقش خودت رو نمی‌تونی عوض کنی.');
      await db.update(schema.users).set({ role: b.role }).where(eq(schema.users.id, id));
      msg = `role ${b.role} · ${u!.username}`;
      break;
    case 'account':
      if (id === admin.id) fail(422, 'حساب خودت رو نمی‌تونی غیرفعال کنی.');
      await db.update(schema.users).set({ disabledAt: b.disabled ? new Date() : null }).where(eq(schema.users.id, id));
      if (b.disabled) await db.delete(schema.sessions).where(eq(schema.sessions.userId, id));
      msg = `account ${b.disabled ? 'disabled' : 'enabled'} · ${u!.username}`;
      break;
    case 'verify':
      await db.update(schema.users).set({ emailVerifiedAt: new Date() }).where(eq(schema.users.id, id));
      msg = `email marked verified · ${u!.username}`;
      break;
    case 'logout':
      await db.delete(schema.sessions).where(eq(schema.sessions.userId, id));
      msg = `all sessions revoked · ${u!.username}`;
      break;
  }
  await audit(['role', 'account', 'wallet', 'verify', 'logout'].includes(b.action) ? 'admin' : 'mikrotik', 'warn', msg, admin.username, ip);
  return json({ ok: true });
});
