import { and, eq } from 'drizzle-orm';
import { audit } from '@/lib/server/audit';
import { db, schema } from '@/lib/server/db';
import { clientIp, handle } from '@/lib/server/http';
import { consumeLink } from '@/lib/server/tokens';

// The link in the verification email: GET ?token=… → back to the panel with the result.
export const GET = handle(async (req) => {
  const url = new URL(req.url);
  const t = await consumeLink('verify_email', url.searchParams.get('token') ?? '');
  const to = new URL('/panel', url);
  to.searchParams.set('tab', 'account');
  if (t?.userId) {
    // Only if the address is still the one the link was sent to.
    const [u] = await db.update(schema.users).set({ emailVerifiedAt: new Date() }).where(and(eq(schema.users.id, t.userId), eq(schema.users.email, t.target))).returning({ username: schema.users.username });
    if (u) await audit('auth', 'info', `email verified · ${u.username}`, u.username, clientIp(req));
    to.searchParams.set('verified', u ? '1' : '0');
  } else {
    to.searchParams.set('verified', '0');
  }
  return Response.redirect(to, 303);
});
