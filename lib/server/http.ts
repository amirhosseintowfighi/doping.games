// Shared plumbing for route handlers: typed errors, JSON responses, client IP, Origin check, body parsing.
import { isIP } from 'node:net';
import type { z } from 'zod';
import { env } from './env';
import { rateLimit } from './rateLimit';

export class HttpError extends Error {
  constructor(readonly status: number, message: string, readonly fields?: Record<string, string>) {
    super(message);
  }
}
export const fail = (status: number, message: string, fields?: Record<string, string>): never => {
  throw new HttpError(status, message, fields);
};

export const json = (body: unknown, status = 200, headers?: HeadersInit) =>
  Response.json(body, { status, headers: { 'Cache-Control': 'no-store', ...headers } });

export function clientIp(req: Request): string {
  if (env.trustProxy) {
    const real = req.headers.get('x-real-ip')?.trim();
    if (real && isIP(real)) return real;
    const fwd = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
    if (fwd && isIP(fwd)) return fwd;
  }
  return '127.0.0.1';
}

/** Rejects cross-site writes: the browser always sends Origin on POST/PUT/PATCH/DELETE. */
export function checkOrigin(req: Request) {
  const origin = req.headers.get('origin');
  const site = req.headers.get('sec-fetch-site');
  if (site && !['same-origin', 'none'].includes(site)) fail(403, 'درخواست از مبدأ دیگری پذیرفته نمی‌شود.');
  if (!origin) return;
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
  let ok = false;
  try {
    const o = new URL(origin);
    ok = o.host === host || (!!env.appUrl && o.origin === new URL(env.appUrl).origin);
  } catch { /* malformed origin */ }
  if (!ok) fail(403, 'درخواست از مبدأ دیگری پذیرفته نمی‌شود.');
}

export async function limit(key: string, max: number, windowSec: number) {
  const r = await rateLimit(key, max, windowSec);
  if (!r.ok) throw new HttpError(429, `تعداد درخواست‌ها زیاده. ${r.retryAfter} ثانیه دیگه دوباره امتحان کن.`);
}

export async function body<T extends z.ZodType>(req: Request, schema: T): Promise<z.infer<T>> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    fail(400, 'بدنه درخواست JSON معتبر نیست.');
  }
  const r = schema.safeParse(raw);
  if (!r.success) {
    const fields: Record<string, string> = {};
    for (const i of r.error.issues) fields[i.path.join('.') || '_'] ??= i.message;
    fail(422, Object.values(fields)[0] ?? 'ورودی نامعتبر است.', fields);
  }
  return r.data as z.infer<T>;
}

/** Wraps a handler so thrown HttpErrors become JSON responses and anything else a logged 500. */
export function handle<A extends unknown[]>(fn: (req: Request, ...args: A) => Promise<Response>) {
  return async (req: Request, ...args: A): Promise<Response> => {
    try {
      if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) checkOrigin(req);
      return await fn(req, ...args);
    } catch (err) {
      if (err instanceof HttpError) return json({ error: err.message, fields: err.fields }, err.status);
      console.error('[api]', req.method, new URL(req.url).pathname, err);
      return json({ error: 'خطای داخلی سرور. دوباره امتحان کن.' }, 500);
    }
  };
}

/** Public origin for links in emails and payment callbacks. */
export const baseUrl = (req: Request) => env.appUrl || new URL(req.url).origin;
