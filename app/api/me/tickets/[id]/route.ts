import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { decodeFiles, filesInput, saveFiles } from '@/lib/server/attachments';
import { requireUser } from '@/lib/server/auth';
import { db, schema } from '@/lib/server/db';
import { body, fail, handle, json, limit } from '@/lib/server/http';

const Input = z.object({ text: z.string().trim().max(4000).default(''), files: filesInput }).refine((b) => b.text || b.files.length, 'پیام خالیه.');

export const POST = handle(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser(req);
  await limit(`reply:${user.id}`, 60, 3600);
  const id = Number((await ctx.params).id);
  const b = await body(req, Input);
  const t = (await db.select().from(schema.tickets).where(and(eq(schema.tickets.id, id), eq(schema.tickets.userId, user.id))).limit(1))[0];
  if (!t) fail(404, 'تیکت پیدا نشد.');
  const files = decodeFiles(b.files);
  await db.transaction(async (tx) => {
    const [m] = await tx.insert(schema.ticketMessages).values({ ticketId: id, authorId: user.id, text: b.text }).returning({ id: schema.ticketMessages.id });
    await saveFiles(tx, m!.id, files);
  });
  await db.update(schema.tickets).set({ status: 'open', updatedAt: new Date() }).where(eq(schema.tickets.id, id));
  return json({ ok: true });
});
