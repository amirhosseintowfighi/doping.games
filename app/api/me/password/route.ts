import { and, eq, ne } from 'drizzle-orm';
import { z } from 'zod';
import { audit } from '@/lib/server/audit';
import { requireUser } from '@/lib/server/auth';
import { hashPassword, verifyPassword } from '@/lib/server/crypto';
import { db, schema } from '@/lib/server/db';
import { body, clientIp, fail, handle, json, limit } from '@/lib/server/http';
import { password } from '@/lib/server/validators';

const Input = z.object({ current: z.string().min(1, 'رمز فعلی رو وارد کن.').max(128), next: password });

/** Changes the password and signs out every other device. */
export const PUT = handle(async (req) => {
  const user = await requireUser(req);
  await limit(`pw:${user.id}`, 10, 3600);
  const b = await body(req, Input);
  const u = (await db.select().from(schema.users).where(eq(schema.users.id, user.id)).limit(1))[0]!;
  if (!verifyPassword(b.current, u.passwordHash)) fail(422, 'رمز فعلی اشتباهه.', { current: 'رمز فعلی اشتباهه.' });
  await db.update(schema.users).set({ passwordHash: hashPassword(b.next) }).where(eq(schema.users.id, user.id));
  await db.delete(schema.sessions).where(and(eq(schema.sessions.userId, user.id), ne(schema.sessions.tokenHash, user.tokenHash)));
  await audit('auth', 'warn', 'password changed · other sessions revoked', user.username, clientIp(req));
  return json({ ok: true });
});
