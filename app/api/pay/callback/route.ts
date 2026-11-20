import { clientIp, handle } from '@/lib/server/http';
import { settle } from '@/lib/server/orders';

// Zarinpal sends the buyer back here: GET ?Authority=...&Status=OK|NOK
export const GET = handle(async (req) => {
  const url = new URL(req.url);
  const authority = url.searchParams.get('Authority') ?? '';
  const status = url.searchParams.get('Status') ?? '';
  const to = new URL('/pay/result', url);
  if (!/^[A-Za-z0-9]{8,64}$/.test(authority)) {
    to.searchParams.set('ok', '0');
    return Response.redirect(to, 303);
  }
  const r = await settle(authority, status, clientIp(req));
  to.searchParams.set('ok', r.ok ? '1' : '0');
  if (r.order) to.searchParams.set('order', r.order.id);
  if (r.message) to.searchParams.set('msg', r.message);
  return Response.redirect(to, 303);
});
