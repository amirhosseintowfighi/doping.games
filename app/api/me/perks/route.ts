import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { scheduleVipReload } from '@/lib/server/vip';
import { requireUser } from '@/lib/server/auth';
import { db, schema } from '@/lib/server/db';
import { body, fail, handle, json } from '@/lib/server/http';

const Input = z.object({ slot: z.boolean(), tag: z.boolean(), skins: z.boolean() });

export const PUT = handle(async (req) => {
  const user = await requireUser(req);
  const perks = await body(req, Input);
  const sub = (await db.select().from(schema.subscriptions).where(eq(schema.subscriptions.userId, user.id)).limit(1))[0];
  if (sub?.kind !== 'pro' || sub.status !== 'active') fail(403, 'این امتیاز فقط با پکیج پرو فعاله.');
  if (!user.steamId) fail(422, 'اول اکانت Steam رو وصل کن.');
  await db.update(schema.users).set({ perks }).where(eq(schema.users.id, user.id));
  scheduleVipReload();
  return json({ ok: true });
});
