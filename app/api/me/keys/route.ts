import { and, eq } from 'drizzle-orm';
import { audit } from '@/lib/server/audit';
import { requireUser } from '@/lib/server/auth';
import { db, schema } from '@/lib/server/db';
import { z } from 'zod';
import { body, clientIp, fail, handle, json, limit } from '@/lib/server/http';
import { rotateKeys } from '@/lib/server/vpn';

const Input = z.object({ device: z.string().uuid().optional() }).default({});

/** Key reset: new key pair + preshared key, pushed to the router peer in place. `device` = one extra device only. */
export const POST = handle(async (req) => {
  const user = await requireUser(req);
  await limit(`keys:${user.id}`, 5, 3600);
  const sub = (await db.select().from(schema.subscriptions).where(eq(schema.subscriptions.userId, user.id)).limit(1))[0];
  if (!sub?.tunnelIp) fail(404, 'هنوز اشتراک تانل نداری.');
  const b = req.headers.get('content-length') && req.headers.get('content-length') !== '0' ? await body(req, Input) : {};
  if (b.device) {
    const d = (await db.select({ id: schema.devices.id }).from(schema.devices).where(and(eq(schema.devices.id, b.device), eq(schema.devices.subscriptionId, sub!.id))).limit(1))[0];
    if (!d) fail(404, 'دستگاه پیدا نشد.');
  }
  const r = await rotateKeys(sub!.id, b.device);
  await audit('mikrotik', 'warn', `key reset · ${b.device ? `device ${b.device}` : `peer ${sub!.peerId ?? '(pending)'}`} · ${r.ok ? 'router updated' : 'router pending'}`, user.username, clientIp(req));
  return json({ ok: true, routerUpdated: r.ok });
});
