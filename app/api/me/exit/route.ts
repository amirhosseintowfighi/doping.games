import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { EXITS } from '@/src/data.js';
import { audit } from '@/lib/server/audit';
import { requireUser } from '@/lib/server/auth';
import { db, schema } from '@/lib/server/db';
import { body, clientIp, fail, handle, json, limit } from '@/lib/server/http';
import { provision } from '@/lib/server/vpn';

const Input = z.object({ exit: z.string().refine((x) => EXITS.some((e) => e.id === x), 'خروجی نامعتبره.') });

/** Moves the tunnel to another exit node: the router's address-lists change, the config stays the same. */
export const PUT = handle(async (req) => {
  const user = await requireUser(req);
  await limit(`exit:${user.id}`, 20, 3600);
  const { exit } = await body(req, Input);
  const [sub] = await db.update(schema.subscriptions).set({ exit }).where(eq(schema.subscriptions.userId, user.id)).returning();
  if (!sub?.tunnelIp) fail(404, 'هنوز اشتراک تانل نداری.');
  const r = await provision(sub!.id);
  await audit('mikrotik', 'info', `exit → ${exit} · ${r.ok ? 'router updated' : 'router pending'}`, user.username, clientIp(req));
  return json({ ok: true, routerUpdated: r.ok });
});
