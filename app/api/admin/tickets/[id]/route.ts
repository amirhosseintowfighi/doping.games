import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { requireStaff } from '@/lib/server/auth';
import { db, schema } from '@/lib/server/db';
import { body, fail, handle, json } from '@/lib/server/http';

const Input = z.object({ text: z.string().trim().max(4000).optional(), status: z.enum(['open', 'answered', 'closed']).optional() });

export const POST = handle(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const staff = await requireStaff(req);
  const id = Number((await ctx.params).id);
  const b = await body(req, Input);
  const t = (await db.select().from(schema.tickets).where(eq(schema.tickets.id, id)).limit(1))[0];
  if (!t) fail(404, 'تیکت پیدا نشد.');
  if (b.text) await db.insert(schema.ticketMessages).values({ ticketId: id, authorId: staff.id, staff: true, text: b.text });
  await db.update(schema.tickets).set({ status: b.status ?? (b.text ? 'answered' : t!.status), updatedAt: new Date() }).where(eq(schema.tickets.id, id));
  return json({ ok: true });
});
