import { eq } from 'drizzle-orm';
import { audit } from '@/lib/server/audit';
import { requireUser } from '@/lib/server/auth';
import { db, schema } from '@/lib/server/db';
import { clientIp, fail, handle, json, limit } from '@/lib/server/http';
import { rotateKeys } from '@/lib/server/vpn';

/** Key reset: new key pair + preshared key, pushed to the router peer in place. */
export const POST = handle(async (req) => {
  const user = await requireUser(req);
  limit(`keys:${user.id}`, 5, 3600);
  const sub = (await db.select().from(schema.subscriptions).where(eq(schema.subscriptions.userId, user.id)).limit(1))[0];
  if (!sub?.tunnelIp) fail(404, 'هنوز اشتراک تانل نداری.');
  const r = await rotateKeys(sub!.id);
  await audit('mikrotik', 'warn', `key reset · peer ${sub!.peerId ?? '(pending)'} · ${r.ok ? 'router updated' : 'router pending'}`, user.username, clientIp(req));
  return json({ ok: true, routerUpdated: r.ok });
});
