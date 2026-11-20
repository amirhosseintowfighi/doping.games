import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { audit } from '@/lib/server/audit';
import { requireAdmin } from '@/lib/server/auth';
import { db, schema } from '@/lib/server/db';
import { body, clientIp, fail, handle, json } from '@/lib/server/http';

export const PATCH = handle(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireAdmin(req);
  const { id } = await ctx.params;
  const { enabled } = await body(req, z.object({ enabled: z.boolean() }));
  if (!enabled) {
    const on = await db.select().from(schema.gateways).where(eq(schema.gateways.enabled, true));
    if (on.length === 1 && on[0]!.id === id) fail(422, 'حداقل یک درگاه باید فعال بمونه.');
  }
  const [g] = await db.update(schema.gateways).set({ enabled }).where(eq(schema.gateways.id, id)).returning();
  if (!g) fail(404, 'درگاه پیدا نشد.');
  await audit('admin', 'warn', `gateway.${enabled ? 'enable' : 'disable'} ${id}`, user.username, clientIp(req));
  return json({ ok: true });
});
