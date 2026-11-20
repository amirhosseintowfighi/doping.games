import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { audit } from '@/lib/server/audit';
import { requireUser } from '@/lib/server/auth';
import { db, schema } from '@/lib/server/db';
import { body, clientIp, fail, handle, json } from '@/lib/server/http';

const Input = z.object({ steamId: z.string().trim().regex(/^7656119\d{10}$/, 'SteamID64 باید ۱۷ رقم باشه و با 7656119 شروع بشه.').nullable() });

export const PUT = handle(async (req) => {
  const user = await requireUser(req);
  const { steamId } = await body(req, Input);
  try {
    await db.update(schema.users).set({ steamId }).where(eq(schema.users.id, user.id));
  } catch {
    fail(409, 'این SteamID به حساب دیگه‌ای وصله.');
  }
  await audit('rcon', 'info', steamId ? `steam linked ${steamId} · VIP sync on next map` : 'steam unlinked', user.username, clientIp(req));
  return json({ ok: true });
});
