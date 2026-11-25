import { and, eq } from 'drizzle-orm';
import { audit } from '@/lib/server/audit';
import { requireUser } from '@/lib/server/auth';
import { db, schema } from '@/lib/server/db';
import { clientIp, fail, handle, json } from '@/lib/server/http';
import { getSite } from '@/lib/server/site';
import { clientConfig, devOwner, subOwner } from '@/lib/server/vpn';

// The private key is decrypted only for this response and never cached. ?device=<id> for an extra device.
export const GET = handle(async (req) => {
  const user = await requireUser(req);
  const url = new URL(req.url);
  const deviceId = url.searchParams.get('device');
  const sub = (await db.select().from(schema.subscriptions).where(eq(schema.subscriptions.userId, user.id)).limit(1))[0];
  if (!sub?.tunnelIp) fail(404, 'هنوز اشتراک تانل نداری.');
  let owner = subOwner(sub!);
  if (deviceId) {
    if (!/^[0-9a-f-]{36}$/.test(deviceId)) fail(404, 'دستگاه پیدا نشد.');
    const d = (await db.select().from(schema.devices).where(and(eq(schema.devices.id, deviceId), eq(schema.devices.subscriptionId, sub!.id))).limit(1))[0];
    if (!d) fail(404, 'دستگاه پیدا نشد.');
    owner = devOwner(d!);
  }
  const router = sub!.routerId ? (await db.select().from(schema.routers).where(eq(schema.routers.id, sub!.routerId)).limit(1))[0] ?? null : null;
  const conf = clientConfig(owner, router, await getSite());
  if (!conf) fail(404, 'کانفیگ آماده نیست.');
  if (url.searchParams.get('reveal')) await audit('auth', 'info', `wireguard config viewed${deviceId ? ` · device ${deviceId}` : ''}`, user.username, clientIp(req));
  return json(conf, 200, { 'Cache-Control': 'no-store, private' });
});
