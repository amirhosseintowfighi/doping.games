import { eq } from 'drizzle-orm';
import { audit } from '@/lib/server/audit';
import { requireUser } from '@/lib/server/auth';
import { db, schema } from '@/lib/server/db';
import { clientIp, fail, handle, json } from '@/lib/server/http';
import { getSite } from '@/lib/server/site';
import { clientConfig } from '@/lib/server/vpn';

// The private key is decrypted only for this response and never cached.
export const GET = handle(async (req) => {
  const user = await requireUser(req);
  const sub = (await db.select().from(schema.subscriptions).where(eq(schema.subscriptions.userId, user.id)).limit(1))[0];
  if (!sub?.tunnelIp) fail(404, 'هنوز اشتراک تانل نداری.');
  const router = sub!.routerId ? (await db.select().from(schema.routers).where(eq(schema.routers.id, sub!.routerId)).limit(1))[0] ?? null : null;
  const conf = clientConfig(sub!, router, await getSite());
  if (!conf) fail(404, 'کانفیگ آماده نیست.');
  if (new URL(req.url).searchParams.get('reveal')) await audit('auth', 'info', 'wireguard config viewed', user.username, clientIp(req));
  return json(conf, 200, { 'Cache-Control': 'no-store, private' });
});
