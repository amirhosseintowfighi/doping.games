import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { audit } from '@/lib/server/audit';
import { createSession } from '@/lib/server/auth';
import { hashPassword, verifyPassword } from '@/lib/server/crypto';
import { db, schema } from '@/lib/server/db';
import { body, clientIp, fail, handle, json, limit } from '@/lib/server/http';

const Input = z.object({ login: z.string().trim().min(3, 'ایمیل یا نام کاربری رو وارد کن.').max(120), password: z.string().min(1, 'رمز رو وارد کن.').max(128) });
// Compared against when the account does not exist, so both paths take the same time.
const DUMMY = hashPassword('not-a-real-password');

export const POST = handle(async (req) => {
  const ip = clientIp(req);
  const b = await body(req, Input);
  const id = b.login.toLowerCase();
  await limit(`login:ip:${ip}`, 20, 900);
  await limit(`login:id:${id}`, 8, 900);
  const u = (await db.select().from(schema.users).where(sql`lower(${schema.users.email}) = ${id} or lower(${schema.users.username}) = ${id}`).limit(1))[0];
  const ok = verifyPassword(b.password, u?.passwordHash ?? DUMMY) && !!u;
  if (!ok || u!.disabledAt) {
    await audit('auth', 'warn', `login failed · ${b.login.slice(0, 40)}`, 'anonymous', ip);
    fail(401, u?.disabledAt ? 'این حساب غیرفعال شده.' : 'ایمیل/نام کاربری یا رمز اشتباهه.');
  }
  await createSession(u!.id, req);
  await db.update(schema.users).set({ lastLoginAt: new Date() }).where(eq(schema.users.id, u!.id));
  await audit('auth', 'info', `login ${u!.username}`, u!.username, ip);
  return json({ ok: true, role: u!.role });
});
