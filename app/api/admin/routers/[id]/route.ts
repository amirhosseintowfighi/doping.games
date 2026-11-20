import { eq } from 'drizzle-orm';
import { audit } from '@/lib/server/audit';
import { requireAdmin } from '@/lib/server/auth';
import { routerInput } from '@/lib/server/adminInputs';
import { encryptSecret } from '@/lib/server/crypto';
import { db, schema } from '@/lib/server/db';
import { body, clientIp, fail, handle, json } from '@/lib/server/http';
import { adminRouter } from '@/lib/server/panel';

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = handle(async (req, ctx: Ctx) => {
  const user = await requireAdmin(req);
  const { id } = await ctx.params;
  const b = await body(req, routerInput);
  if (b.password && b.password.length < 12) fail(422, 'رمز API حداقل ۱۲ کاراکتر.', { password: 'حداقل ۱۲ کاراکتر.' });
  const old = (await db.select().from(schema.routers).where(eq(schema.routers.id, id)).limit(1))[0];
  if (!old) fail(404, 'روتر پیدا نشد.');
  // A new host means a new certificate: drop the old pin unless the admin pasted one.
  const fingerprint = b.fingerprint || (b.host === old!.host && b.apiPort === old!.apiPort ? old!.tlsFingerprint : null);
  const [r] = await db.update(schema.routers).set({
    name: b.name, role: b.role, city: b.city, host: b.host, apiPort: b.apiPort, apiUser: b.apiUser, wgInterface: b.wg, subnet: b.subnet,
    endpoint: b.endpoint || null, tlsFingerprint: fingerprint, enabled: b.enabled,
    ...(b.password ? { apiPassEnc: encryptSecret(b.password, `router:${id}:api_pass`) } : {}),
  }).where(eq(schema.routers.id, id)).returning();
  await audit('admin', 'info', `router.update ${b.name} · ${b.password ? 'رمز API عوض شد' : 'رمز بدون تغییر'}`, user.username, clientIp(req));
  return json(adminRouter(r!));
});

export const DELETE = handle(async (req, ctx: Ctx) => {
  const user = await requireAdmin(req);
  const { id } = await ctx.params;
  // Its users move to another entry router on their next sync.
  await db.update(schema.subscriptions).set({ peerId: null, queueId: null, provisionedAt: null, routerId: null, lastSeenUp: 0, lastSeenDown: 0 }).where(eq(schema.subscriptions.routerId, id));
  const [r] = await db.delete(schema.routers).where(eq(schema.routers.id, id)).returning();
  if (!r) fail(404, 'روتر پیدا نشد.');
  await audit('admin', 'warn', `router.delete ${r!.name}`, user.username, clientIp(req));
  return json({ ok: true });
});
