import { eq } from 'drizzle-orm';
import { audit } from '@/lib/server/audit';
import { requireUser } from '@/lib/server/auth';
import { db, schema } from '@/lib/server/db';
import { env } from '@/lib/server/env';
import { clientIp, fail, handle, json, limit } from '@/lib/server/http';
import { channels, sendTelegram } from '@/lib/server/messaging';
import { issueLink } from '@/lib/server/tokens';

/** A deep link to the bot; opening it sends /start <token>, which the bot poller matches to this account. */
export const POST = handle(async (req) => {
  const user = await requireUser(req);
  if (!channels.telegram()) fail(503, 'ربات تلگرام فعلاً روی سرور تنظیم نشده.');
  await limit(`tg:${user.id}`, 10, 3600);
  const token = await issueLink('telegram', user.id, 900);
  return json({ ok: true, url: `https://t.me/${env.telegramUsername}?start=${token}` });
});

export const DELETE = handle(async (req) => {
  const user = await requireUser(req);
  const u = (await db.select({ chat: schema.users.telegramChatId }).from(schema.users).where(eq(schema.users.id, user.id)).limit(1))[0];
  await db.update(schema.users).set({ telegramChatId: null }).where(eq(schema.users.id, user.id));
  if (u?.chat) await sendTelegram(u.chat, 'اتصال این چت به حساب دوپینگ از پنل برداشته شد.');
  await audit('auth', 'info', 'telegram unlinked', user.username, clientIp(req));
  return json({ ok: true });
});
