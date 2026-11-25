import { eq } from 'drizzle-orm';
import { sha256 } from '@/lib/server/crypto';
import { db, schema } from '@/lib/server/db';
import { clientIp, fail, handle, json, limit } from '@/lib/server/http';
import { adminsSimple, vipEntries } from '@/lib/server/vip';

// Pulled by each game server: Authorization: Bearer <token> (or ?token=). ?format=json for plugins.
export const GET = handle(async (req) => {
  await limit(`vip:${clientIp(req)}`, 120, 3600);
  const url = new URL(req.url);
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || url.searchParams.get('token') || '';
  if (token.length < 20 || token.length > 100) fail(401, 'unauthorized');
  const [s] = await db.update(schema.gameServers).set({ vipFetchedAt: new Date() }).where(eq(schema.gameServers.vipTokenHash, sha256(token))).returning({ id: schema.gameServers.id });
  if (!s) fail(401, 'unauthorized');
  const list = await vipEntries();
  if (url.searchParams.get('format') === 'json') return json({ players: list.map(({ steamId64, steam2, flags }) => ({ steamId64, steam2, flags })) });
  return new Response(adminsSimple(list), { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });
});
