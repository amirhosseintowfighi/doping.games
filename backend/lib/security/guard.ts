// lib/security/guard.ts
// One wrapper for every route handler: session → RBAC → CSRF → rate limit → Zod → handler.
// Route handlers use the standard Request/Response objects of the Next.js App Router.
import { isIP } from 'node:net';
import type { z } from 'zod';
import { newToken, safeEqual, sha256 } from '../crypto';
import { audit, query } from '../db';
import { rateLimit, tooManyRequests, type RateLimitRule } from './rateLimit';

export type Role = 'USER' | 'SUPER_ADMIN';
export interface Session {
  userId: string;
  role: Role;
  csrfHash: string;
}

export const SESSION_COOKIE = '__Host-dp_session';
export const CSRF_COOKIE = '__Host-dp_csrf';
const SESSION_TTL_SEC = 60 * 60 * 12;

export const json = (body: unknown, status = 200, headers: HeadersInit = {}) =>
  Response.json(body, { status, headers: { 'Cache-Control': 'no-store', ...headers } });

/**
 * The app sits behind exactly one trusted reverse proxy (nginx) which overwrites X-Real-IP.
 * A client-supplied X-Forwarded-For is never trusted: it would let anyone whitelist a foreign IP.
 */
export function clientIp(req: Request): string {
  const ip = req.headers.get('x-real-ip')?.trim() ?? '';
  return isIP(ip) ? ip : '0.0.0.0';
}

function readCookie(req: Request, name: string): string | null {
  for (const part of (req.headers.get('cookie') ?? '').split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}

/** Creates a session row and returns the Set-Cookie headers. Only token digests are stored. */
export async function createSession(userId: string, ip: string): Promise<Headers> {
  const token = newToken();
  const csrf = newToken();
  await query(
    `INSERT INTO sessions (token_hash, csrf_hash, user_id, ip, expires_at)
     VALUES ($1, $2, $3, $4, now() + make_interval(secs => $5))`,
    [sha256(token), sha256(csrf), userId, ip, SESSION_TTL_SEC],
  );
  const base = `Path=/; Secure; SameSite=Strict; Max-Age=${SESSION_TTL_SEC}`;
  const headers = new Headers();
  headers.append('Set-Cookie', `${SESSION_COOKIE}=${token}; HttpOnly; ${base}`);
  // Readable by our own JS so it can be echoed in the X-CSRF-Token header (double submit).
  headers.append('Set-Cookie', `${CSRF_COOKIE}=${csrf}; ${base}`);
  return headers;
}

async function loadSession(req: Request): Promise<Session | null> {
  const token = readCookie(req, SESSION_COOKIE);
  if (!token) return null;
  const rows = await query<{ user_id: string; role: Role; csrf_hash: string }>(
    `SELECT s.user_id, u.role, s.csrf_hash
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = $1 AND s.expires_at > now() AND s.revoked_at IS NULL AND u.disabled_at IS NULL`,
    [sha256(token)],
  );
  const row = rows[0];
  return row ? { userId: row.user_id, role: row.role, csrfHash: row.csrf_hash } : null;
}

/** Double-submit token bound to the session, plus an Origin check for state-changing requests. */
function csrfOk(req: Request, session: Session): boolean {
  const origin = req.headers.get('origin');
  if (origin !== process.env.APP_ORIGIN) return false;
  const header = req.headers.get('x-csrf-token');
  return !!header && safeEqual(sha256(header), session.csrfHash);
}

interface GuardOptions<S extends z.ZodType> {
  /** Roles allowed to call the route. Omit for public routes such as login or payment callbacks. */
  roles?: Role[];
  schema?: S;
  /** Where the validated input comes from. */
  source?: 'json' | 'query';
  limit?: { rule: RateLimitRule; by: 'ip' | 'user' };
}

interface Ctx<S extends z.ZodType> {
  req: Request;
  ip: string;
  session: Session | null;
  input: z.infer<S>;
}

export function guarded<S extends z.ZodType>(
  options: GuardOptions<S>,
  handler: (ctx: Ctx<S>) => Promise<Response>,
): (req: Request) => Promise<Response> {
  return async (req) => {
    const ip = clientIp(req);
    try {
      const session = options.roles ? await loadSession(req) : null;

      if (options.roles) {
        if (!session) return json({ error: 'unauthenticated' }, 401);
        if (!options.roles.includes(session.role)) {
          await audit({ category: 'auth', level: 'critical', action: 'rbac.denied', actorId: session.userId, ip, detail: { path: new URL(req.url).pathname } });
          return json({ error: 'forbidden' }, 403);
        }
        if (req.method !== 'GET' && req.method !== 'HEAD' && !csrfOk(req, session)) {
          await audit({ category: 'auth', level: 'warn', action: 'csrf.rejected', actorId: session.userId, ip });
          return json({ error: 'csrf' }, 403);
        }
      }

      if (options.limit) {
        const subject = options.limit.by === 'user' && session ? session.userId : ip;
        const verdict = await rateLimit(options.limit.rule, subject);
        if (!verdict.allowed) return tooManyRequests(verdict);
      }

      let input = undefined as z.infer<S>;
      if (options.schema) {
        const raw =
          options.source === 'query'
            ? Object.fromEntries(new URL(req.url).searchParams)
            : await req.json().catch(() => null);
        const parsed = options.schema.safeParse(raw);
        if (!parsed.success) {
          return json({ error: 'invalid_input', issues: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })) }, 422);
        }
        input = parsed.data;
      }

      return await handler({ req, ip, session, input });
    } catch (err) {
      // Internal detail stays in the server log; the client gets an opaque error.
      console.error('[api] unhandled', new URL(req.url).pathname, err);
      return json({ error: 'internal' }, 500);
    }
  };
}
