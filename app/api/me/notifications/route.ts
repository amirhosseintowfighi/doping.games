import { z } from 'zod';
import { requireUser } from '@/lib/server/auth';
import { body, handle, json } from '@/lib/server/http';
import { markRead } from '@/lib/server/notify';

const Input = z.object({ ids: z.union([z.literal('all'), z.array(z.number().int()).max(100)]) });

export const POST = handle(async (req) => {
  const user = await requireUser(req);
  const b = await body(req, Input);
  await markRead(user.id, b.ids);
  return json({ ok: true });
});
