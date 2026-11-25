import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { decodeFiles, filesInput, saveFiles } from '@/lib/server/attachments';
import { requireStaff } from '@/lib/server/auth';
import { notifyUser } from '@/lib/server/notify';
import { db, schema } from '@/lib/server/db';
import { body, fail, handle, json } from '@/lib/server/http';

const Input = z.object({ text: z.string().trim().max(4000).optional(), status: z.enum(['open', 'answered', 'closed']).optional(), files: filesInput });

export const POST = handle(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const staff = await requireStaff(req);
  const id = Number((await ctx.params).id);
  const b = await body(req, Input);
  const t = (await db.select().from(schema.tickets).where(eq(schema.tickets.id, id)).limit(1))[0];
  if (!t) fail(404, 'تیکت پیدا نشد.');
  const files = decodeFiles(b.files);
  const reply = !!b.text || files.length > 0;
  let msgId = 0;
  if (reply) {
    await db.transaction(async (tx) => {
      const [m] = await tx.insert(schema.ticketMessages).values({ ticketId: id, authorId: staff.id, staff: true, text: b.text ?? '' }).returning({ id: schema.ticketMessages.id });
      msgId = m!.id;
      await saveFiles(tx, m!.id, files);
    });
  }
  await db.update(schema.tickets).set({ status: b.status ?? (reply ? 'answered' : t!.status), updatedAt: new Date() }).where(eq(schema.tickets.id, id));
  if (reply) {
    await notifyUser(t!.userId, `ticket:${id}:${msgId}`, { title: `پاسخ تیکت T-${id}`, body: `پشتیبانی به «${t!.subject}» جواب داد.`, link: { path: '/panel?tab=support', label: 'دیدن پاسخ' } });
  }
  return json({ ok: true });
});
