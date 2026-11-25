// Sessions: an opaque random token in an HttpOnly cookie, only its SHA-256 stored in the database.
// CSRF: each session has its own token, readable by our JS from a second cookie and echoed in the
// X-CSRF-Token header on every write (double submit, checked against the session row server-side).
import { and, eq, gt, lt } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { cache } from 'react';
import { newToken, safeEqual, sha256 } from './crypto';
import { db, schema } from './db';
import { env } from './env';
import { clientIp, fail } from './http';

export type Role = 'user' | 'support' | 'admin';
export const SESSION_COOKIE = env.cookieSecure ? '__Host-dp_sid' : 'dp_sid';
export const CSRF_COOKIE = env.cookieSecure ? '__Host-dp_csrf' : 'dp_csrf';
const TTL_SEC = 60 * 60 * 24 * 30;

export type SessionUser = {
  id: string; email: string; username: string; role: Role; wallet: number; steamId: string | null;
  perks: { slot: boolean; tag: boolean; skins: boolean }; csrf: string; tokenHash: string;
  notify: { email: boolean; telegram: boolean; sms: boolean };
};

const cookieOpts = (maxAge: number, httpOnly: boolean) => ({
  path: '/', secure: env.cookieSecure, sameSite: 'lax' as const, httpOnly, maxAge,
});

export async function createSession(userId: string, req: Request) {
  const token = newToken();
  const csrf = newToken();
  await db.insert(schema.sessions).values({
    tokenHash: sha256(token), csrf, userId, ip: clientIp(req), userAgent: req.headers.get('user-agent')?.slice(0, 300) ?? null,
    expiresAt: new Date(Date.now() + TTL_SEC * 1000),
  });
  // Old sessions of this account are cleaned up opportunistically.
  await db.delete(schema.sessions).where(and(eq(schema.sessions.userId, userId), lt(schema.sessions.expiresAt, new Date())));
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, cookieOpts(TTL_SEC, true));
  jar.set(CSRF_COOKIE, csrf, cookieOpts(TTL_SEC, false));
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.delete(schema.sessions).where(eq(schema.sessions.tokenHash, sha256(token)));
  jar.delete(SESSION_COOKIE);
  jar.delete(CSRF_COOKIE);
}

/** The signed-in user for this request, or null. Cached for the duration of one request. */
export const currentUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token || token.length > 100) return null;
  const tokenHash = sha256(token);
  const rows = await db
    .select({ s: schema.sessions, u: schema.users })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId))
    .where(and(eq(schema.sessions.tokenHash, tokenHash), gt(schema.sessions.expiresAt, new Date())))
    .limit(1);
  const row = rows[0];
  if (!row || row.u.disabledAt) return null;
  const { u, s } = row;
  return { id: u.id, email: u.email, username: u.username, role: u.role, wallet: u.wallet, steamId: u.steamId, perks: u.perks, csrf: s.csrf, tokenHash, notify: u.notify };
});

const isWrite = (req: Request) => !['GET', 'HEAD', 'OPTIONS'].includes(req.method);

/** For API routes: the signed-in user, with the CSRF token verified on writes. */
export async function requireUser(req: Request, roles?: Role[]): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) fail(401, 'اول وارد حساب کاربری شو.');
  if (isWrite(req) && !safeEqual(req.headers.get('x-csrf-token') ?? '', user!.csrf)) fail(403, 'نشست منقضی شده. صفحه رو یک‌بار تازه کن.');
  if (roles && !roles.includes(user!.role)) fail(403, 'دسترسی این بخش رو نداری.');
  return user!;
}

export const requireAdmin = (req: Request) => requireUser(req, ['admin']);
export const requireStaff = (req: Request) => requireUser(req, ['admin', 'support']);
