import { z } from 'zod';
import { audit } from '@/lib/server/audit';
import { requireAdmin } from '@/lib/server/auth';
import { db, schema } from '@/lib/server/db';
import { body, clientIp, fail, handle, json } from '@/lib/server/http';

const Input = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{4,16}$/, 'کد باید ۴ تا ۱۶ حرف لاتین یا عدد باشه.'),
  percent: z.number().int().min(1, 'درصد بین ۱ تا ۹۰.').max(90, 'درصد بین ۱ تا ۹۰.'),
  max: z.number().int().min(1).max(1_000_000).default(100),
});

export const POST = handle(async (req) => {
  const user = await requireAdmin(req);
  const b = await body(req, Input);
  const [d] = await db.insert(schema.discounts).values({ code: b.code, percent: b.percent, maxUses: b.max }).onConflictDoNothing().returning();
  if (!d) fail(409, 'این کد قبلاً ساخته شده.');
  await audit('admin', 'info', `discount.create ${b.code} ${b.percent}%`, user.username, clientIp(req));
  return json({ ok: true }, 201);
});
