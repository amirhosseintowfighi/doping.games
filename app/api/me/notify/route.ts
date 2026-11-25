import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { requireUser } from '@/lib/server/auth';
import { db, schema } from '@/lib/server/db';
import { body, handle, json } from '@/lib/server/http';

const Input = z.object({ email: z.boolean(), telegram: z.boolean(), sms: z.boolean() });

export const PUT = handle(async (req) => {
  const user = await requireUser(req);
  const notify = await body(req, Input);
  await db.update(schema.users).set({ notify }).where(eq(schema.users.id, user.id));
  return json({ ok: true });
});
