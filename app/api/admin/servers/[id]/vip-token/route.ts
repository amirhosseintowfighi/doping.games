import { eq } from 'drizzle-orm';
import { audit } from '@/lib/server/audit';
import { requireAdmin } from '@/lib/server/auth';
import { newToken, sha256 } from '@/lib/server/crypto';
import { db, schema } from '@/lib/server/db';
import { baseUrl, clientIp, fail, handle, json } from '@/lib/server/http';

/** New VIP-list token for one server (shown once; the old one stops working). */
export const POST = handle(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireAdmin(req);
  const { id } = await ctx.params;
  const token = newToken();
  const [s] = await db.update(schema.gameServers).set({ vipTokenHash: sha256(token), vipFetchedAt: null }).where(eq(schema.gameServers.id, id)).returning({ name: schema.gameServers.name });
  if (!s) fail(404, 'سرور پیدا نشد.');
  await audit('admin', 'warn', `vip token issued · ${s!.name}`, user.username, clientIp(req));
  const url = `${baseUrl(req)}/api/servers/vip`;
  return json({
    ok: true, token, url,
    cron: `* * * * * curl -fsS -H "Authorization: Bearer ${token}" ${url} -o /home/steam/cs2/game/csgo/addons/sourcemod/configs/admins_simple.ini.tmp && mv /home/steam/cs2/game/csgo/addons/sourcemod/configs/admins_simple.ini.tmp /home/steam/cs2/game/csgo/addons/sourcemod/configs/admins_simple.ini`,
  });
});
