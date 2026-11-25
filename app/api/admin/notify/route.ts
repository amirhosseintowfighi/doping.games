import { z } from 'zod';
import { audit } from '@/lib/server/audit';
import { requireAdmin } from '@/lib/server/auth';
import { body, clientIp, handle, json, limit } from '@/lib/server/http';
import { broadcast } from '@/lib/server/notify';

const Input = z.object({
  title: z.string().trim().min(3, 'عنوان حداقل ۳ حرف.').max(80),
  body: z.string().trim().min(5, 'متن حداقل ۵ حرف.').max(600),
  target: z.enum(['all', 'active']),
  push: z.boolean().default(false),
});

/** Announcement to users' panels (and, with push, over their email/Telegram/SMS). */
export const POST = handle(async (req) => {
  const admin = await requireAdmin(req);
  await limit(`broadcast:${admin.id}`, 5, 3600);
  const b = await body(req, Input);
  const n = await broadcast(b.target, b.title, b.body, b.push);
  await audit('admin', 'warn', `broadcast "${b.title}" · ${b.target} · ${n} users${b.push ? ' · push' : ''}`, admin.username, clientIp(req));
  return json({ ok: true, sent: n });
});
