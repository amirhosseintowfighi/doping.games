import { requireUser } from '@/lib/server/auth';
import { body, handle, json } from '@/lib/server/http';
import { quote } from '@/lib/server/orders';
import { orderInput } from '@/lib/server/validators';

export const POST = handle(async (req) => {
  const user = await requireUser(req);
  const q = await quote(user.id, await body(req, orderInput));
  return json({ title: q.title, subtotal: q.subtotal, discount: q.discountAmount, total: Math.max(0, q.subtotal - q.discountAmount) });
});
