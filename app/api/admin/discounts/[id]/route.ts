import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { audit } from '@/lib/server/audit';
import { requireAdmin } from '@/lib/server/auth';
import { db, schema } from '@/lib/server/db';
import { body, clientIp, fail, handle, json } from '@/lib/server/http';

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = handle(async (req, ctx: Ctx) => {
  const user = await requireAdmin(req);
  const { id } = await ctx.params;
  const { active } = await body(req, z.object({ active: z.boolean() }));
  const [d] = await db.update(schema.discounts).set({ active }).where(eq(schema.discounts.id, id)).returning();
  if (!d) fail(404, 'کد پیدا نشد.');
  await audit('admin', 'info', `discount.${active ? 'enable' : 'disable'} ${d!.code}`, user.username, clientIp(req));
  return json({ ok: true });
});

export const DELETE = handle(async (req, ctx: Ctx) => {
  const user = await requireAdmin(req);
  const { id } = await ctx.params;
  const [d] = await db.delete(schema.discounts).where(eq(schema.discounts.id, id)).returning();
  if (!d) fail(404, 'کد پیدا نشد.');
  await audit('admin', 'warn', `discount.delete ${d!.code}`, user.username, clientIp(req));
  return json({ ok: true });
});
