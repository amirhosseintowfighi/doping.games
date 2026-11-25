import { and, eq, ne } from 'drizzle-orm';
import { z } from 'zod';
import { audit } from '@/lib/server/audit';
import { requireUser } from '@/lib/server/auth';
import { db, schema } from '@/lib/server/db';
import { body, clientIp, fail, handle, json, limit } from '@/lib/server/http';
import { channels, sendOtpSms } from '@/lib/server/messaging';
import { checkCode, codeError, issueCode, normalizePhone } from '@/lib/server/tokens';

const Send = z.object({ phone: z.string().trim().max(20) });
const Verify = z.object({ phone: z.string().trim().max(20), code: z.string().trim().max(10) });

const parse = (raw: string) => normalizePhone(raw) ?? fail(422, 'شماره موبایل معتبر نیست؛ مثل 09121234567.', { phone: 'شماره موبایل معتبر نیست؛ مثل 09121234567.' });

async function taken(phone: string, userId: string) {
  const r = await db.select({ id: schema.users.id }).from(schema.users).where(and(eq(schema.users.phone, phone), ne(schema.users.id, userId))).limit(1);
  if (r.length) fail(409, 'این شماره به حساب دیگه‌ای وصله.', { phone: 'این شماره به حساب دیگه‌ای وصله.' });
}

/** Step 1: send a code to the number. */
export const POST = handle(async (req) => {
  const user = await requireUser(req);
  if (!channels.sms()) fail(503, 'ارسال پیامک فعلاً روی سرور تنظیم نشده.');
  const b = await body(req, Send);
  const phone = parse(b.phone);
  await limit(`phone:${user.id}`, 5, 3600);
  await limit(`otp:phone:${phone}`, 3, 600);
  await taken(phone, user.id);
  const ok = await sendOtpSms(phone, await issueCode('phone_verify', user.id, phone));
  if (!ok) fail(502, 'ارسال پیامک ناموفق بود. چند دقیقه دیگه دوباره امتحان کن.');
  return json({ ok: true, phone });
});

/** Step 2: confirm the code; the number becomes the account's verified phone. */
export const PUT = handle(async (req) => {
  const user = await requireUser(req);
  await limit(`phonev:${user.id}`, 20, 3600);
  const b = await body(req, Verify);
  const phone = parse(b.phone);
  const r = await checkCode('phone_verify', phone, b.code, user.id);
  if (!r.ok) fail(422, codeError(r.reason), { code: codeError(r.reason) });
  await taken(phone, user.id);
  await db.update(schema.users).set({ phone, phoneVerifiedAt: new Date() }).where(eq(schema.users.id, user.id));
  await audit('auth', 'info', `phone verified ${phone.slice(0, 4)}…${phone.slice(-3)}`, user.username, clientIp(req));
  return json({ ok: true });
});

export const DELETE = handle(async (req) => {
  const user = await requireUser(req);
  await db.update(schema.users).set({ phone: null, phoneVerifiedAt: null, notify: { ...user.notify, sms: false } }).where(eq(schema.users.id, user.id));
  await audit('auth', 'info', 'phone removed', user.username, clientIp(req));
  return json({ ok: true });
});
