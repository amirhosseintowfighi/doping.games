// User notifications: an in-panel inbox plus delivery over the channels each user turned on
// (email when verified, Telegram when linked, SMS when the phone is verified). A notification has a
// dedupe key, so the worker can run as often as it likes without sending the same alert twice.
import { and, eq, gt, inArray, sql as dsql } from 'drizzle-orm';
import { fa, faDate } from '@/src/data.js';
import { audit } from './audit';
import { db, schema, withLock } from './db';
import { env } from './env';
import { sendEmail, sendSms, sendTelegram, telegramApi, channels } from './messaging';
import { consumeLink } from './tokens';

type Level = 'info' | 'warn' | 'bad';
export type Note = { title: string; body: string; level?: Level; link?: { path: string; label: string }; channels?: boolean };

const GB = 1024 ** 3;
const DAY = 86_400_000;

/** Stores the notification (once per key) and sends it out. Returns false when it already existed. */
export async function notifyUser(userId: string, key: string, n: Note): Promise<boolean> {
  const [row] = await db.insert(schema.notifications).values({ userId, key: key.slice(0, 120), level: n.level ?? 'info', title: n.title, body: n.body })
    .onConflictDoNothing().returning({ id: schema.notifications.id });
  if (!row) return false;
  if (n.channels === false) return true;
  const u = (await db.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1))[0];
  if (!u || u.disabledAt) return true;
  const url = n.link && env.appUrl ? `${env.appUrl}${n.link.path}` : '';
  const text = `${n.title}\n${n.body}${url ? `\n${url}` : ''}`;
  const jobs: Promise<unknown>[] = [];
  if (u.notify.email && u.emailVerifiedAt) jobs.push(sendEmail(u.email, n.title, n.body, url ? { url, label: n.link!.label } : undefined));
  if (u.notify.telegram && u.telegramChatId) jobs.push(sendTelegram(u.telegramChatId, text));
  if (u.notify.sms && u.phoneVerifiedAt && u.phone) jobs.push(sendSms(u.phone, `دوپینگ: ${n.title}\n${n.body}`));
  // Delivery runs in the background: a slow mail server must not hold up a payment callback or a worker tick.
  void Promise.allSettled(jobs);
  return true;
}

/** Admin announcement to every account (or only those with a live subscription). In-panel only unless `push`. */
export async function broadcast(target: 'all' | 'active', title: string, body: string, push: boolean) {
  const key = `bc:${Date.now()}`;
  const ids = target === 'all'
    ? await db.select({ id: schema.users.id }).from(schema.users).where(dsql`${schema.users.disabledAt} is null`)
    : await db.select({ id: schema.subscriptions.userId }).from(schema.subscriptions).where(eq(schema.subscriptions.status, 'active'));
  let n = 0;
  for (const { id } of ids) if (await notifyUser(id, key, { title, body, channels: push })) n++;
  return n;
}

/* ───────── subscription alerts + auto-renew ───────── */

/**
 * Runs the subscription checks: expiry in 3 days / 1 day, expired, 80% and 100% of quota, and
 * auto-renew from the wallet during the last day. `renew` is injected to avoid an import cycle with orders.
 */
export async function runNotifyOnce(renew: (user: { id: string; email: string; username: string }) => Promise<unknown>) {
  await withLock(1685024874, async () => {
    const now = Date.now();
    const rows = await db.select({ s: schema.subscriptions, u: schema.users }).from(schema.subscriptions)
      .innerJoin(schema.users, eq(schema.users.id, schema.subscriptions.userId))
      .where(and(gt(schema.subscriptions.expiresAt, new Date(now - 3 * DAY)), dsql`${schema.users.disabledAt} is null`));
    for (const { s, u } of rows) {
      const exp = s.expiresAt.getTime();
      const left = exp - now;
      const link = { path: '/panel', label: 'رفتن به پنل' };
      if (s.status === 'active' && s.autoRenew && left > 0 && left <= DAY) {
        try {
          await renew(u);
          await notifyUser(u.id, `autorenew:${exp}`, { title: 'اشتراکت خودکار تمدید شد', body: 'تمدید خودکار از کیف پول انجام شد و ۳۰ روز به اشتراکت اضافه شد.', link });
          await audit('payment', 'info', `auto-renew OK · ${u.username}`, 'notify-worker');
          continue;
        } catch (err) {
          await notifyUser(u.id, `renewfail:${exp}`, { level: 'warn', title: 'تمدید خودکار انجام نشد', body: `${(err as Error).message} کیف پولت رو شارژ کن یا دستی تمدید کن تا اتصالت قطع نشه.`, link: { path: '/panel?tab=billing', label: 'شارژ کیف پول' } });
        }
      }
      if (s.status === 'active' && left > DAY && left <= 3 * DAY) {
        await notifyUser(u.id, `exp3:${exp}`, { level: 'warn', title: 'اشتراکت به‌زودی تموم می‌شه', body: `اشتراکت ${faDate(exp)} تموم می‌شه (کمتر از ۳ روز دیگه). برای قطع نشدن، تمدیدش کن${s.autoRenew ? '؛ تمدید خودکار روشنه و اگه موجودی کافی باشه خودش انجام می‌شه.' : '.'}`, link });
      } else if (s.status === 'active' && left > 0 && left <= DAY) {
        await notifyUser(u.id, `exp1:${exp}`, { level: 'warn', title: 'کمتر از یک روز از اشتراکت مونده', body: `اشتراکت ${faDate(exp)} تموم می‌شه. همین حالا تمدیدش کن.`, link });
      }
      if (s.status === 'expired' || (left <= 0 && s.status !== 'disabled')) {
        await notifyUser(u.id, `expired:${exp}`, { level: 'bad', title: 'اشتراکت تموم شد', body: 'اتصال تانل و DNS متوقف شد. با تمدید یک‌کلیکی از پنل، همون لحظه دوباره وصل می‌شی.', link });
      }
      if (s.quotaBytes != null) {
        const used = s.usedUp + s.usedDown;
        if (s.status === 'quota') {
          await notifyUser(u.id, `q100:${s.quotaBytes}:${exp}`, { level: 'bad', title: 'حجم اشتراکت تموم شد', body: 'اتصال تانل متوقف شد. از پنل ترافیک اضافه بخر یا تمدید کن.', link });
        } else if (s.status === 'active' && used >= s.quotaBytes * 0.8) {
          await notifyUser(u.id, `q80:${s.quotaBytes}:${exp}`, { level: 'warn', title: '۸۰٪ حجمت مصرف شده', body: `از ${fa(Math.round(s.quotaBytes / GB))} گیگ، حدود ${fa(Number(Math.max(0, (s.quotaBytes - used) / GB).toFixed(1)))} گیگ مونده.`, link });
        }
      }
    }
  });
}

/* ───────── Telegram bot (long-poll-free: getUpdates on a timer) ───────── */

type TgUpdate = { update_id: number; message?: { chat: { id: number; type: string }; text?: string } };
let lastTgError = '';

export async function pollTelegram() {
  if (!channels.telegram()) return;
  await withLock(1685024875, async () => {
    const kv = (await db.select().from(schema.kv).where(eq(schema.kv.key, 'tg_offset')).limit(1))[0];
    const offset = Number(kv?.value ?? 0);
    let updates: TgUpdate[];
    try {
      updates = await telegramApi<TgUpdate[]>('getUpdates', { offset, timeout: 0, allowed_updates: ['message'] });
      if (lastTgError) console.log('[telegram] reachable again');
      lastTgError = '';
    } catch (err) {
      // Where api.telegram.org is filtered this fails every time: log it once, not every 10 seconds.
      const msg = (err as Error).message;
      if (msg !== lastTgError) {
        console.error('[telegram] getUpdates failed:', msg, '(set TELEGRAM_API_BASE to a reachable relay)');
        await audit('system', 'warn', `telegram getUpdates failed · ${msg}`, 'telegram');
      }
      lastTgError = msg;
      return;
    }
    for (const up of updates) {
      const m = up.message;
      if (!m?.text || m.chat.type !== 'private') continue;
      const chatId = String(m.chat.id);
      const [cmd, arg] = m.text.trim().split(/\s+/);
      if (cmd === '/start' && arg) {
        const t = await consumeLink('telegram', arg);
        if (!t?.userId) { await sendTelegram(chatId, 'این لینک منقضی شده. از پنل دوپینگ (تب حساب کاربری) لینک جدید بگیر.'); continue; }
        await db.update(schema.users).set({ telegramChatId: null }).where(eq(schema.users.telegramChatId, chatId));
        await db.update(schema.users).set({ telegramChatId: chatId }).where(eq(schema.users.id, t.userId));
        await sendTelegram(chatId, 'حساب دوپینگت وصل شد ✅\nاز این به بعد هشدار حجم، انقضا و پاسخ تیکت‌ها رو همین‌جا می‌گیری.\n/status وضعیت اشتراک · /stop قطع اتصال');
      } else if (cmd === '/stop') {
        await db.update(schema.users).set({ telegramChatId: null }).where(eq(schema.users.telegramChatId, chatId));
        await sendTelegram(chatId, 'اتصال این چت به حساب دوپینگ برداشته شد.');
      } else if (cmd === '/status') {
        const row = (await db.select({ s: schema.subscriptions, u: schema.users }).from(schema.users)
          .leftJoin(schema.subscriptions, eq(schema.subscriptions.userId, schema.users.id)).where(eq(schema.users.telegramChatId, chatId)).limit(1))[0];
        if (!row) await sendTelegram(chatId, 'این چت به حسابی وصل نیست. از پنل دوپینگ لینک اتصال بگیر.');
        else if (!row.s) await sendTelegram(chatId, `${row.u.username}: هنوز اشتراکی نداری.`);
        else {
          const used = row.s.usedUp + row.s.usedDown;
          const q = row.s.quotaBytes == null ? 'نامحدود' : `${(Math.max(0, row.s.quotaBytes - used) / GB).toFixed(2)} از ${Math.round(row.s.quotaBytes / GB)} گیگ مونده`;
          await sendTelegram(chatId, `${row.u.username}\nوضعیت: ${row.s.status}\nحجم: ${q}\nپایان: ${faDate(row.s.expiresAt.getTime())}\nموجودی: ${fa(row.u.wallet)} تومان`);
        }
      } else {
        await sendTelegram(chatId, 'سلام! برای وصل کردن حساب، از پنل دوپینگ → حساب کاربری → «اتصال تلگرام» استفاده کن.\n/status وضعیت اشتراک');
      }
    }
    if (updates.length) {
      const next = updates.at(-1)!.update_id + 1;
      await db.insert(schema.kv).values({ key: 'tg_offset', value: next }).onConflictDoUpdate({ target: schema.kv.key, set: { value: next } });
    }
  });
}

/** Unread count + latest notifications for the panel. */
export async function userNotifications(userId: string) {
  const list = await db.select().from(schema.notifications).where(eq(schema.notifications.userId, userId)).orderBy(dsql`${schema.notifications.createdAt} desc`).limit(30);
  return list.map((n) => ({ id: n.id, title: n.title, body: n.body, level: n.level, at: n.createdAt.getTime(), read: !!n.readAt }));
}

export async function markRead(userId: string, ids: number[] | 'all') {
  const where = ids === 'all' ? eq(schema.notifications.userId, userId) : and(eq(schema.notifications.userId, userId), inArray(schema.notifications.id, ids.length ? ids : [-1]));
  await db.update(schema.notifications).set({ readAt: new Date() }).where(and(where, dsql`${schema.notifications.readAt} is null`));
}
