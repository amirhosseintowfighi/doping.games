import { and, eq, ne } from 'drizzle-orm';
import { z } from 'zod';
import { audit } from '@/lib/server/audit';
import { requireUser } from '@/lib/server/auth';
import { db, schema } from '@/lib/server/db';
import { body, clientIp, handle, json } from '@/lib/server/http';

const Input = z.object({ id: z.string().max(80).optional() });

/** Signs out one other device (by its short id) or, without an id, every device except this one. */
export const DELETE = handle(async (req) => {
  const user = await requireUser(req);
  const b = await body(req, Input);
  const where = [eq(schema.sessions.userId, user.id), ne(schema.sessions.tokenHash, user.tokenHash)];
  const rows = await db.select({ tokenHash: schema.sessions.tokenHash }).from(schema.sessions).where(and(...where));
  const targets = b.id ? rows.filter((r) => r.tokenHash.slice(0, 12) === b.id) : rows;
  for (const r of targets) await db.delete(schema.sessions).where(eq(schema.sessions.tokenHash, r.tokenHash));
  await audit('auth', 'warn', `sessions revoked · ${targets.length}`, user.username, clientIp(req));
  return json({ ok: true, revoked: targets.length });
});
