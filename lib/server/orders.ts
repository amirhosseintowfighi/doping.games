// Orders: price quotes, wallet and gateway payments, idempotent verification and fulfilment.
// Prices are always recomputed here from the stored pricing; nothing the browser sends is trusted.
import { and, eq, lt, sql as dsql } from 'drizzle-orm';
import { dnsSlots, durations, fa, pingTiers, priceOf, tierLabel } from '@/src/data.js';
import { audit } from './audit';
import { db, schema, type Tx } from './db';
import { env } from './env';
import { fail } from './http';
import { getSite, type Site } from './site';
import { applyExtra, applyPlan, provision, resetCounters, syncPeerState, type PlanItem } from './vpn';
import { requestPayment, verifyPayment } from './zarinpal';

export type OrderInput =
  | { type: 'plan'; kind: 'ping' | 'dns' | 'pro'; tier?: number | 'inf'; slots?: number; months: number; code?: string }
  | { type: 'renew'; code?: string }
  | { type: 'extra'; gb: number }
  | { type: 'topup'; amount: number };

type Quote = { type: OrderInput['type']; title: string; item: Record<string, unknown>; subtotal: number; discountId: string | null; discountAmount: number; amount: number; code?: string };

const EXTRA_PACKS = [5, 10, 20, 50];

async function discountFor(code: string | undefined, subtotal: number) {
  if (!code?.trim()) return { discountId: null, discountAmount: 0 };
  const c = code.trim().toUpperCase();
  const d = (await db.select().from(schema.discounts).where(eq(schema.discounts.code, c)).limit(1))[0];
  if (!d || !d.active) fail(422, 'این کد تخفیف معتبر نیست.', { code: 'این کد تخفیف معتبر نیست.' });
  if (d!.used >= d!.maxUses) fail(422, 'ظرفیت این کد تموم شده.', { code: 'ظرفیت این کد تموم شده.' });
  return { discountId: d!.id, discountAmount: Math.round((subtotal * d!.percent) / 100) };
}

function planItem(site: Site, i: { kind: PlanItem['kind']; tier?: number | 'inf'; slots?: number; months: number }): { item: PlanItem; title: string; subtotal: number } {
  const P = site.pricing;
  if (!site.kinds[i.kind]) fail(422, 'این پلن در حال حاضر فروخته نمی‌شه.');
  if (!durations(P).some((d: { months: number }) => d.months === i.months)) fail(422, 'مدت انتخاب‌شده معتبر نیست.');
  const tier: number | 'inf' = i.kind === 'dns' ? 'inf' : i.tier ?? pingTiers(P)[0] ?? 'inf';
  if (i.kind !== 'dns' && !pingTiers(P).includes(tier)) fail(422, 'حجم انتخاب‌شده معتبر نیست.');
  const slots = i.kind === 'dns' ? i.slots ?? 0 : 0;
  if (i.kind === 'dns' && !dnsSlots(P).includes(slots)) fail(422, 'تعداد آی‌پی معتبر نیست.');
  const { total } = priceOf(P, { kind: i.kind, tier, slots, months: i.months });
  if (!(total > 0)) fail(422, 'قیمت این پلن تعریف نشده.');
  const what = i.kind === 'dns' ? `${fa(slots)} آی‌پی` : tierLabel(tier);
  return { item: { kind: i.kind, tier, slots, months: i.months }, title: `${site.planNames[i.kind]} · ${what} · ${fa(i.months)} ماهه`, subtotal: total };
}

export async function quote(userId: string, input: OrderInput): Promise<Quote> {
  const site = await getSite();
  if (input.type === 'plan') {
    const p = planItem(site, input);
    return { type: 'plan', ...p, ...(await discountFor(input.code, p.subtotal)), amount: 0, code: input.code };
  }
  const sub = (await db.select().from(schema.subscriptions).where(eq(schema.subscriptions.userId, userId)).limit(1))[0];
  if (input.type === 'renew') {
    if (!sub) fail(422, 'اشتراکی برای تمدید نداری؛ از صفحه تعرفه‌ها یک پلن بخر.');
    const tier = sub!.tierGb ?? 'inf';
    const p = planItem(site, { kind: sub!.kind, tier: pingTiers(site.pricing).includes(tier) ? tier : pingTiers(site.pricing)[0], slots: sub!.kind === 'dns' ? (dnsSlots(site.pricing).includes(sub!.dnsSlots) ? sub!.dnsSlots : dnsSlots(site.pricing)[0]) : 0, months: 1 });
    return { type: 'renew', ...p, title: `تمدید ${p.title}`, ...(await discountFor(input.code, p.subtotal)), amount: 0, code: input.code };
  }
  if (input.type === 'extra') {
    if (!sub || sub.quotaBytes == null || sub.kind === 'dns') fail(422, 'خرید حجم اضافه فقط برای پلن‌های حجمی فعاله.');
    if (sub!.expiresAt <= new Date()) fail(422, 'اشتراکت منقضی شده؛ اول تمدیدش کن.');
    if (!EXTRA_PACKS.includes(input.gb)) fail(422, 'بسته حجم نامعتبره.');
    const subtotal = input.gb * site.pricing.extraPerGb;
    return { type: 'extra', title: `ترافیک مازاد · ${fa(input.gb)} گیگ`, item: { gb: input.gb }, subtotal, discountId: null, discountAmount: 0, amount: 0 };
  }
  if (!(input.amount >= 20_000 && input.amount <= 5_000_000)) fail(422, 'مبلغ باید بین ۲۰ هزار تا ۵ میلیون تومان باشه.');
  return { type: 'topup', title: 'شارژ کیف پول', item: { amount: input.amount }, subtotal: input.amount, discountId: null, discountAmount: 0, amount: 0 };
}

const finalAmount = (q: Quote) => Math.max(0, q.subtotal - q.discountAmount);

export async function enabledGateways() {
  return db.select().from(schema.gateways).where(eq(schema.gateways.enabled, true));
}

/** Creates the order and either pays it from the wallet or returns the bank redirect. */
export async function checkout(user: { id: string; email: string; username: string }, input: OrderInput, gateway: string, ip: string, origin: string) {
  const q = await quote(user.id, input);
  const amount = finalAmount(q);
  const gw = (await enabledGateways()).find((g) => g.id === gateway);
  if (!gw) fail(422, 'این درگاه فعال نیست.');
  if (q.type === 'topup' && gateway === 'wallet') fail(422, 'شارژ کیف پول با خود کیف پول ممکن نیست.');
  const zeroTotal = amount === 0; // a 100% code is capped at 90%, but keep the guard
  const [order] = await db.insert(schema.orders).values({
    userId: user.id, type: q.type, title: q.title, item: q.item, subtotal: q.subtotal, discountId: q.discountId,
    discountAmount: q.discountAmount, amount, gateway: zeroTotal ? 'wallet' : gateway,
  }).returning();

  if (gateway === 'wallet' || zeroTotal) {
    const done = await db.transaction(async (tx) => {
      const [u] = await tx.update(schema.users).set({ wallet: dsql`${schema.users.wallet} - ${amount}` })
        .where(and(eq(schema.users.id, user.id), dsql`${schema.users.wallet} >= ${amount}`)).returning({ wallet: schema.users.wallet });
      if (!u) return null;
      if (amount) await tx.insert(schema.walletTx).values({ userId: user.id, orderId: order!.id, amount: -amount, balance: u.wallet, reason: q.title });
      await tx.update(schema.orders).set({ status: 'paid', paidAt: new Date() }).where(eq(schema.orders.id, order!.id));
      return fulfil(tx, { ...order!, status: 'paid' });
    });
    if (!done) {
      // Not a payment attempt worth keeping on the invoice list.
      await db.delete(schema.orders).where(eq(schema.orders.id, order!.id));
      fail(402, 'موجودی کیف پول کافی نیست.');
    }
    await afterFulfil(done!);
    await audit('payment', 'info', `wallet · INV-${order!.number} · ${q.title} · ${amount.toLocaleString('en-US')} T`, user.username, ip);
    return { status: 'paid' as const, orderId: order!.id, number: order!.number };
  }

  try {
    const base = env.appUrl || origin;
    const r = await requestPayment({ amountToman: amount, callbackUrl: `${base}/api/pay/callback`, description: `${q.title} · INV-${order!.number}`, orderId: order!.id, email: user.email });
    await db.update(schema.orders).set({ authority: r.authority }).where(eq(schema.orders.id, order!.id));
    await audit('payment', 'info', `${gateway} request · INV-${order!.number} · ${amount.toLocaleString('en-US')} T · authority ${r.authority.slice(0, 12)}…`, user.username, ip);
    return { status: 'redirect' as const, orderId: order!.id, number: order!.number, redirect: r.redirect };
  } catch (err) {
    await db.update(schema.orders).set({ status: 'failed', error: (err as Error).message.slice(0, 300) }).where(eq(schema.orders.id, order!.id));
    await audit('payment', 'critical', `${gateway} request failed · INV-${order!.number} · ${(err as Error).message}`, user.username, ip);
    fail(502, 'اتصال به درگاه پرداخت برقرار نشد. چند دقیقه دیگه دوباره امتحان کن.');
  }
  throw new Error('unreachable');
}

type Order = typeof schema.orders.$inferSelect;
type Fulfilment = { order: Order; subId: string | null; fresh: boolean };

/** Applies a paid order. Runs in the same transaction that marks it paid, so it happens exactly once. */
async function fulfil(tx: Tx, order: Order): Promise<Fulfilment> {
  if (order.discountId) {
    await tx.update(schema.discounts).set({ used: dsql`${schema.discounts.used} + 1` }).where(eq(schema.discounts.id, order.discountId));
  }
  if (order.type === 'topup') {
    const [u] = await tx.update(schema.users).set({ wallet: dsql`${schema.users.wallet} + ${order.amount}` }).where(eq(schema.users.id, order.userId)).returning({ wallet: schema.users.wallet });
    await tx.insert(schema.walletTx).values({ userId: order.userId, orderId: order.id, amount: order.amount, balance: u!.wallet, reason: order.title });
    return { order, subId: null, fresh: false };
  }
  if (order.type === 'extra') {
    const subId = await applyExtra(tx, order.userId, Number(order.item.gb));
    return { order, subId, fresh: false };
  }
  const subId = await applyPlan(tx, order.userId, order.item as unknown as PlanItem);
  return { order, subId, fresh: true };
}

async function afterFulfil(f: Fulfilment) {
  if (!f.subId) return;
  if (f.fresh) {
    await resetCounters(f.subId);
    await provision(f.subId);
  } else {
    await syncPeerState(f.subId);
  }
}

/** Bank callback. Safe to call any number of times for the same authority. */
export async function settle(authority: string, status: string, ip: string): Promise<{ order: Order | null; ok: boolean; message?: string }> {
  const order = (await db.select().from(schema.orders).where(and(eq(schema.orders.gateway, 'zarinpal'), eq(schema.orders.authority, authority))).limit(1))[0];
  if (!order) return { order: null, ok: false, message: 'سفارشی با این شناسه پیدا نشد.' };
  if (order.status === 'paid') return { order, ok: true };
  if (order.status !== 'pending') return { order, ok: false, message: 'این پرداخت قبلاً ناموفق ثبت شده.' };
  if (status !== 'OK') {
    await db.update(schema.orders).set({ status: 'canceled', error: 'canceled by user' }).where(and(eq(schema.orders.id, order.id), eq(schema.orders.status, 'pending')));
    await audit('payment', 'warn', `zarinpal canceled · INV-${order.number}`, 'gateway', ip);
    return { order, ok: false, message: 'پرداخت لغو شد. مبلغی از حسابت کم نشده.' };
  }
  const result = await db.transaction(async (tx) => {
    const locked = (await tx.select().from(schema.orders).where(eq(schema.orders.id, order.id)).for('update'))[0]!;
    if (locked.status !== 'pending') return { f: null, ok: locked.status === 'paid', order: locked };
    const v = await verifyPayment({ amountToman: locked.amount, authority });
    if (!v.ok) {
      await tx.update(schema.orders).set({ status: 'failed', error: `${v.code} ${v.message}` }).where(eq(schema.orders.id, locked.id));
      return { f: null, ok: false, order: locked, message: 'بانک پرداخت رو تایید نکرد. اگه مبلغی کم شده تا ۷۲ ساعت برمی‌گرده.' };
    }
    const [paid] = await tx.update(schema.orders).set({ status: 'paid', paidAt: new Date(), refId: v.refId, cardPan: v.cardPan ?? null }).where(eq(schema.orders.id, locked.id)).returning();
    return { f: await fulfil(tx, paid!), ok: true, order: paid! };
  });
  if (result.f) {
    await afterFulfil(result.f);
    await audit('payment', 'info', `zarinpal verify OK · INV-${order.number} · ref ${result.order.refId} · ${order.amount.toLocaleString('en-US')} T`, 'gateway', ip);
  } else if (!result.ok) {
    await audit('payment', 'critical', `zarinpal verify failed · INV-${order.number}`, 'gateway', ip);
  }
  return { order: result.order, ok: result.ok, message: 'message' in result ? result.message : undefined };
}

/** Pending gateway orders older than an hour can no longer be paid. */
export async function expireStaleOrders() {
  await db.update(schema.orders).set({ status: 'canceled', error: 'expired' })
    .where(and(eq(schema.orders.status, 'pending'), lt(schema.orders.createdAt, new Date(Date.now() - 3_600_000))));
}
