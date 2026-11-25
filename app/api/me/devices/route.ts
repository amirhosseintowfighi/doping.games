import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { fa } from '@/src/data.js';
import { audit } from '@/lib/server/audit';
import { requireUser } from '@/lib/server/auth';
import { db, schema } from '@/lib/server/db';
import { body, clientIp, fail, handle, json, limit } from '@/lib/server/http';
import { getSite } from '@/lib/server/site';
import { addDevice, deviceLimit, removeDevice } from '@/lib/server/vpn';

const Add = z.object({ name: z.string().trim().min(2, 'اسم دستگاه حداقل ۲ حرف.').max(30, 'اسم دستگاه حداکثر ۳۰ حرف.') });
const Del = z.object({ id: z.string().uuid() });

async function tunnelSub(userId: string) {
  const sub = (await db.select().from(schema.subscriptions).where(eq(schema.subscriptions.userId, userId)).limit(1))[0];
  if (!sub?.tunnelIp) fail(404, 'برای دستگاه اضافه، پلن کاهش پینگ یا پکیج پرو لازمه.');
  return sub!;
}

export const POST = handle(async (req) => {
  const user = await requireUser(req);
  await limit(`device:${user.id}`, 10, 3600);
  const b = await body(req, Add);
  const sub = await tunnelSub(user.id);
  if (sub.status === 'expired' || sub.expiresAt <= new Date()) fail(422, 'اشتراکت منقضی شده؛ اول تمدیدش کن.');
  const max = deviceLimit(await getSite(), sub.kind);
  const [{ n } = { n: 0 }] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.devices).where(eq(schema.devices.subscriptionId, sub.id));
  if (n + 1 >= max) fail(409, `پلنت حداکثر ${fa(max)} دستگاه همزمان داره.`);
  const d = await addDevice(sub, b.name);
  await audit('mikrotik', 'info', `device added · ${b.name} · ${d.tunnelIp}`, user.username, clientIp(req));
  return json({ ok: true, id: d.id }, 201);
});

export const DELETE = handle(async (req) => {
  const user = await requireUser(req);
  const b = await body(req, Del);
  const sub = await tunnelSub(user.id);
  if (!(await removeDevice(sub, b.id))) fail(404, 'دستگاه پیدا نشد.');
  await audit('mikrotik', 'info', `device removed · ${b.id}`, user.username, clientIp(req));
  return json({ ok: true });
});
