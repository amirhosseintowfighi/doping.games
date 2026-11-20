import { sql } from 'drizzle-orm';
import { z } from 'zod';
import { audit } from '@/lib/server/audit';
import { createSession } from '@/lib/server/auth';
import { hashPassword } from '@/lib/server/crypto';
import { db, schema } from '@/lib/server/db';
import { env } from '@/lib/server/env';
import { body, clientIp, fail, handle, json, limit } from '@/lib/server/http';
import { email, password, username } from '@/lib/server/validators';

const Input = z.object({ email, username, password });

export const POST = handle(async (req) => {
  if (!env.registration) fail(403, 'ثبت‌نام در حال حاضر بسته است.');
  const ip = clientIp(req);
  limit(`register:${ip}`, 20, 3600); // generous: many customers share a carrier (CGNAT) address
  const b = await body(req, Input);
  const taken = await db.select({ email: schema.users.email, username: schema.users.username }).from(schema.users)
    .where(sql`lower(${schema.users.email}) = ${b.email} or lower(${schema.users.username}) = ${b.username.toLowerCase()}`);
  if (taken.some((t) => t.email.toLowerCase() === b.email)) fail(409, 'با این ایمیل قبلاً ثبت‌نام شده.', { email: 'با این ایمیل قبلاً ثبت‌نام شده.' });
  if (taken.length) fail(409, 'این نام کاربری گرفته شده.', { username: 'این نام کاربری گرفته شده.' });
  const [u] = await db.insert(schema.users).values({ email: b.email, username: b.username, passwordHash: hashPassword(b.password) }).returning({ id: schema.users.id });
  await createSession(u!.id, req);
  await audit('auth', 'info', `register ${b.username}`, b.username, ip);
  return json({ ok: true }, 201);
});
