import { and, eq, isNotNull } from 'drizzle-orm';
import { z } from 'zod';
import { db, schema } from '@/lib/server/db';
import { body, clientIp, fail, handle, json, limit } from '@/lib/server/http';
import { channels, sendOtpSms } from '@/lib/server/messaging';
import { issueCode, normalizePhone } from '@/lib/server/tokens';

const Input = z.object({ phone: z.string().trim().max(20) });

/** Sends a login code to a verified phone. Same answer for unknown numbers. */
export const POST = handle(async (req) => {
  if (!channels.sms()) fail(503, 'ورود با پیامک فعلاً فعال نیست.');
  const ip = clientIp(req);
  const b = await body(req, Input);
  const phone = normalizePhone(b.phone);
  if (!phone) fail(422, 'شماره موبایل معتبر نیست.', { phone: 'شماره موبایل معتبر نیست.' });
  await limit(`otp:ip:${ip}`, 10, 3600);
  await limit(`otp:phone:${phone}`, 3, 600);
  const u = (await db.select().from(schema.users).where(and(eq(schema.users.phone, phone!), isNotNull(schema.users.phoneVerifiedAt))).limit(1))[0];
  if (u && !u.disabledAt) await sendOtpSms(phone!, await issueCode('login_otp', u.id, phone!));
  return json({ ok: true, phone });
});
