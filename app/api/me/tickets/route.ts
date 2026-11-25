import { z } from 'zod';
import { decodeFiles, filesInput, saveFiles } from '@/lib/server/attachments';
import { requireUser } from '@/lib/server/auth';
import { db, schema } from '@/lib/server/db';
import { body, handle, json, limit } from '@/lib/server/http';

const Input = z.object({
  subject: z.string().trim().min(5, 'موضوع حداقل ۵ حرف.').max(120),
  dept: z.enum(['فنی', 'مالی', 'سرورهای بازی']),
  text: z.string().trim().min(10, 'توضیح حداقل ۱۰ حرف.').max(4000),
  files: filesInput,
});

export const POST = handle(async (req) => {
  const user = await requireUser(req);
  await limit(`ticket:${user.id}`, 10, 3600);
  const b = await body(req, Input);
  const files = decodeFiles(b.files);
  const id = await db.transaction(async (tx) => {
    const [t] = await tx.insert(schema.tickets).values({ userId: user.id, subject: b.subject, dept: b.dept }).returning({ id: schema.tickets.id });
    const [m] = await tx.insert(schema.ticketMessages).values({ ticketId: t!.id, authorId: user.id, text: b.text }).returning({ id: schema.ticketMessages.id });
    await saveFiles(tx, m!.id, files);
    return t!.id;
  });
  return json({ ok: true, id }, 201);
});
