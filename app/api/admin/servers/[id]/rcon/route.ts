import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { audit } from '@/lib/server/audit';
import { requireAdmin } from '@/lib/server/auth';
import { decryptSecret } from '@/lib/server/crypto';
import { db, schema } from '@/lib/server/db';
import { checkCommand, rcon } from '@/lib/server/gameq';
import { body, clientIp, fail, handle, json, limit } from '@/lib/server/http';

const Input = z.object({ command: z.string().max(200) });

export const POST = handle(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireAdmin(req);
  limit(`rcon:${user.id}`, 60, 60);
  const { id } = await ctx.params;
  const { command } = await body(req, Input);
  const bad = checkCommand(command);
  if (bad) fail(422, bad);
  const s = (await db.select().from(schema.gameServers).where(eq(schema.gameServers.id, id)).limit(1))[0];
  if (!s) fail(404, 'سرور پیدا نشد.');
  if (!s!.rconPassEnc) fail(422, 'رمز RCON این سرور ثبت نشده؛ از «ویرایش» واردش کن.');
  const ip = clientIp(req);
  try {
    const out = await rcon(s!.host, s!.port, decryptSecret(s!.rconPassEnc!, `server:${id}:rcon`), command.trim());
    const name = command.trim().split(/\s+/)[0]!.toLowerCase();
    if (name === 'changelevel' || name === 'map') await db.update(schema.gameServers).set({ map: command.trim().split(/\s+/)[1] ?? s!.map }).where(eq(schema.gameServers.id, id));
    await audit('rcon', ['kick', 'kickid', 'changelevel', 'map', 'mp_restartgame'].includes(name) ? 'warn' : 'info', `${command.trim()} · ${s!.name}`, user.username, ip);
    return json({ ok: true, output: out || '(بدون خروجی)' });
  } catch (err) {
    await audit('rcon', 'warn', `rcon failed · ${s!.name} · ${(err as Error).message}`, user.username, ip);
    fail(502, `RCON وصل نشد: ${(err as Error).message}`);
  }
  throw new Error('unreachable');
});
