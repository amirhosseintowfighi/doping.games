import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { requireUser } from '@/lib/server/auth';
import { db, schema } from '@/lib/server/db';
import { body, fail, handle, json } from '@/lib/server/http';

const Input = z.object({ on: z.boolean() });

/** With auto-renew on, the worker renews the same plan from the wallet during the last day. */
export const PUT = handle(async (req) => {
  const user = await requireUser(req);
  const { on } = await body(req, Input);
  const [r] = await db.update(schema.subscriptions).set({ autoRenew: on }).where(eq(schema.subscriptions.userId, user.id)).returning({ id: schema.subscriptions.id });
  if (!r) fail(404, 'اشتراکی نداری.');
  return json({ ok: true });
});
