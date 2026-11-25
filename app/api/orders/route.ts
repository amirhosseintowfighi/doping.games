import { z } from 'zod';
import { requireUser } from '@/lib/server/auth';
import { body, clientIp, handle, json, limit } from '@/lib/server/http';
import { checkout } from '@/lib/server/orders';
import { orderInput } from '@/lib/server/validators';

const Input = z.object({ order: orderInput, gateway: z.enum(['zarinpal', 'wallet']) });

export const POST = handle(async (req) => {
  const user = await requireUser(req);
  await limit(`order:${user.id}`, 20, 600);
  const b = await body(req, Input);
  const origin = new URL(req.url).origin;
  return json(await checkout(user, b.order, b.gateway, clientIp(req), req.headers.get('origin') ?? origin));
});
