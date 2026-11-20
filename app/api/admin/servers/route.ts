import { audit } from '@/lib/server/audit';
import { requireAdmin } from '@/lib/server/auth';
import { defaultsFor, gameOf, serverInput } from '@/lib/server/adminInputs';
import { encryptSecret } from '@/lib/server/crypto';
import { db, schema } from '@/lib/server/db';
import { body, clientIp, handle, json } from '@/lib/server/http';

export const POST = handle(async (req) => {
  const user = await requireAdmin(req);
  const b = await body(req, serverInput);
  const id = crypto.randomUUID();
  const game = gameOf(b.mode);
  await db.insert(schema.gameServers).values({
    id, name: b.name, game, mode: b.mode, map: b.map, max: b.max, host: b.host, port: b.port, vip: b.vip, enabled: b.enabled, sort: b.sort,
    rconPassEnc: b.rcon ? encryptSecret(b.rcon, `server:${id}:rcon`) : null, ...defaultsFor(game),
  });
  await audit('admin', 'info', `gameserver.create ${b.name} · ${b.host}:${b.port}`, user.username, clientIp(req));
  return json({ ok: true, id }, 201);
});
