import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { audit } from '@/lib/server/audit';
import { createSession } from '@/lib/server/auth';
import { db, schema } from '@/lib/server/db';
import { body, clientIp, fail, handle, json, limit } from '@/lib/server/http';
import { checkCode, codeError, normalizePhone } from '@/lib/server/tokens';

const Input = z.object({ phone: z.string().trim().max(20), code: z.string().trim().max(10) });

export const POST = handle(async (req) => {
  const ip = clientIp(req);
  await limit(`otpv:ip:${ip}`, 30, 900);
  const b = await body(req, Input);
  const phone = normalizePhone(b.phone);
  if (!phone) fail(422, 'شماره موبایل معتبر نیست.');
  const r = await checkCode('login_otp', phone!, b.code);
  if (!r.ok) {
    await audit('auth', 'warn', `otp login failed (${r.reason}) · ${phone!.slice(0, 4)}…${phone!.slice(-3)}`, 'anonymous', ip);
    fail(401, codeError(r.reason), { code: codeError(r.reason) });
  }
  const u = r.ok ? (await db.select().from(schema.users).where(eq(schema.users.id, r.row.userId!)).limit(1))[0] : undefined;
  if (!u || u.disabledAt || u.phone !== phone) fail(401, 'این حساب در دسترس نیست.');
  await createSession(u!.id, req);
  await db.update(schema.users).set({ lastLoginAt: new Date() }).where(eq(schema.users.id, u!.id));
  await audit('auth', 'info', `login (sms) ${u!.username}`, u!.username, ip);
  return json({ ok: true, role: u!.role });
});
