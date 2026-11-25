import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { sendVerification } from '@/lib/server/account';
import { audit } from '@/lib/server/audit';
import { requireUser } from '@/lib/server/auth';
import { verifyPassword } from '@/lib/server/crypto';
import { db, schema } from '@/lib/server/db';
import { baseUrl, body, clientIp, fail, handle, json, limit } from '@/lib/server/http';
import { channels } from '@/lib/server/messaging';
import { email } from '@/lib/server/validators';

/** Sends the verification link again. */
export const POST = handle(async (req) => {
  const user = await requireUser(req);
  await limit(`verify:${user.id}`, 3, 3600);
  if (!channels.email()) fail(503, 'ارسال ایمیل فعلاً روی سرور تنظیم نشده.');
  const u = (await db.select().from(schema.users).where(eq(schema.users.id, user.id)).limit(1))[0]!;
  if (u.emailVerifiedAt) fail(409, 'ایمیلت قبلاً تایید شده.');
  const sent = await sendVerification(u, baseUrl(req));
  if (!sent) fail(502, 'ارسال ایمیل ناموفق بود. چند دقیقه دیگه دوباره امتحان کن.');
  return json({ ok: true });
});

const Change = z.object({ email, password: z.string().min(1, 'رمز رو وارد کن.').max(128) });

/** Changes the email address (needs the password); the new address has to be verified again. */
export const PUT = handle(async (req) => {
  const user = await requireUser(req);
  await limit(`email:${user.id}`, 5, 3600);
  const b = await body(req, Change);
  const u = (await db.select().from(schema.users).where(eq(schema.users.id, user.id)).limit(1))[0]!;
  if (!verifyPassword(b.password, u.passwordHash)) fail(422, 'رمز اشتباهه.', { password: 'رمز اشتباهه.' });
  if (u.email.toLowerCase() === b.email) fail(422, 'این همون ایمیل فعلیته.', { email: 'این همون ایمیل فعلیته.' });
  const taken = await db.select({ id: schema.users.id }).from(schema.users).where(sql`lower(${schema.users.email}) = ${b.email}`).limit(1);
  if (taken.length) fail(409, 'این ایمیل به حساب دیگه‌ای وصله.', { email: 'این ایمیل به حساب دیگه‌ای وصله.' });
  const [next] = await db.update(schema.users).set({ email: b.email, emailVerifiedAt: null }).where(eq(schema.users.id, user.id)).returning();
  await sendVerification(next!, baseUrl(req));
  await audit('auth', 'warn', `email changed ${u.email} → ${b.email}`, user.username, clientIp(req));
  return json({ ok: true });
});
