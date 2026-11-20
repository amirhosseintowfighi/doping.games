import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { requireUser } from '@/lib/server/auth';
import { db, schema } from '@/lib/server/db';
import { body, fail, handle, json, limit } from '@/lib/server/http';

const Input = z.object({ text: z.string().trim().min(1, 'پیام خالیه.').max(4000) });

export const POST = handle(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser(req);
  limit(`reply:${user.id}`, 60, 3600);
  const id = Number((await ctx.params).id);
  const b = await body(req, Input);
  const t = (await db.select().from(schema.tickets).where(and(eq(schema.tickets.id, id), eq(schema.tickets.userId, user.id))).limit(1))[0];
  if (!t) fail(404, 'تیکت پیدا نشد.');
  await db.insert(schema.ticketMessages).values({ ticketId: id, authorId: user.id, text: b.text });
  await db.update(schema.tickets).set({ status: 'open', updatedAt: new Date() }).where(eq(schema.tickets.id, id));
  return json({ ok: true });
});
