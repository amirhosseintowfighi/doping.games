import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { audit } from '@/lib/server/audit';
import { hashPassword } from '@/lib/server/crypto';
import { db, schema } from '@/lib/server/db';
import { body, clientIp, fail, handle, json, limit } from '@/lib/server/http';
import { consumeLink } from '@/lib/server/tokens';
import { password } from '@/lib/server/validators';

const Input = z.object({ token: z.string().min(10).max(100), password });

/** Sets the new password, signs every device out and marks the email verified (the link proved the inbox). */
export const POST = handle(async (req) => {
  const ip = clientIp(req);
  await limit(`reset:${ip}`, 20, 3600);
  const b = await body(req, Input);
  const t = await consumeLink('reset', b.token);
  if (!t?.userId) fail(410, 'این لینک منقضی شده یا قبلاً استفاده شده. دوباره «فراموشی رمز» رو بزن.');
  const [u] = await db.update(schema.users).set({ passwordHash: hashPassword(b.password), emailVerifiedAt: new Date() })
    .where(eq(schema.users.id, t!.userId!)).returning({ username: schema.users.username });
  await db.delete(schema.sessions).where(eq(schema.sessions.userId, t!.userId!));
  await audit('auth', 'warn', `password reset · all sessions revoked · ${u?.username}`, u?.username ?? 'anonymous', ip);
  return json({ ok: true });
});
