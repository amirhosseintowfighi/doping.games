import { eq } from 'drizzle-orm';
import { audit } from '@/lib/server/audit';
import { requireAdmin } from '@/lib/server/auth';
import { defaultsFor, gameOf, serverInput } from '@/lib/server/adminInputs';
import { encryptSecret } from '@/lib/server/crypto';
import { db, schema } from '@/lib/server/db';
import { body, clientIp, fail, handle, json } from '@/lib/server/http';

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = handle(async (req, ctx: Ctx) => {
  const user = await requireAdmin(req);
  const { id } = await ctx.params;
  const b = await body(req, serverInput);
  const game = gameOf(b.mode);
  const [r] = await db.update(schema.gameServers).set({
    name: b.name, game, mode: b.mode, map: b.map, max: b.max, host: b.host, port: b.port, vip: b.vip, enabled: b.enabled, sort: b.sort, ...defaultsFor(game),
    ...(b.rcon ? { rconPassEnc: encryptSecret(b.rcon, `server:${id}:rcon`) } : {}),
  }).where(eq(schema.gameServers.id, id)).returning({ id: schema.gameServers.id });
  if (!r) fail(404, 'سرور پیدا نشد.');
  await audit('admin', 'info', `gameserver.update ${b.name}`, user.username, clientIp(req));
  return json({ ok: true });
});

export const DELETE = handle(async (req, ctx: Ctx) => {
  const user = await requireAdmin(req);
  const { id } = await ctx.params;
  const [r] = await db.delete(schema.gameServers).where(eq(schema.gameServers.id, id)).returning();
  if (!r) fail(404, 'سرور پیدا نشد.');
  await audit('admin', 'warn', `gameserver.delete ${r!.name}`, user.username, clientIp(req));
  return json({ ok: true });
});
