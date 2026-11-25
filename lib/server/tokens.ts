// One-time links and codes. Links carry 32 random bytes; codes are 6 digits, bound to the account and
// the phone/email they were sent to, valid for a few minutes and locked after 5 wrong guesses.
import { randomInt } from 'node:crypto';
import { and, desc, eq, gt, isNull, sql as dsql } from 'drizzle-orm';
import { newToken, safeEqual, sha256 } from './crypto';
import { db, schema } from './db';

type Kind = (typeof schema.authTokens.$inferInsert)['kind'];
const MAX_ATTEMPTS = 5;

/** A link token: the raw value goes in the URL, only its hash is stored. Older unused tokens of the same kind are voided. */
export async function issueLink(kind: Kind, userId: string, ttlSec: number, target = ''): Promise<string> {
  const token = newToken();
  await db.update(schema.authTokens).set({ usedAt: new Date() })
    .where(and(eq(schema.authTokens.userId, userId), eq(schema.authTokens.kind, kind), isNull(schema.authTokens.usedAt)));
  await db.insert(schema.authTokens).values({ kind, userId, tokenHash: sha256(token), target, expiresAt: new Date(Date.now() + ttlSec * 1000) });
  return token;
}

/** Marks a link token used and returns its row, or null when unknown, used or expired. */
export async function consumeLink(kind: Kind, token: string) {
  if (!token || token.length > 100) return null;
  const [row] = await db.update(schema.authTokens).set({ usedAt: new Date() })
    .where(and(eq(schema.authTokens.kind, kind), eq(schema.authTokens.tokenHash, sha256(token)), isNull(schema.authTokens.usedAt), gt(schema.authTokens.expiresAt, new Date())))
    .returning();
  return row ?? null;
}

export const otpCode = () => String(randomInt(0, 1_000_000)).padStart(6, '0');

export async function issueCode(kind: Kind, userId: string | null, target: string, ttlSec = 300): Promise<string> {
  const code = otpCode();
  const scope = userId ? eq(schema.authTokens.userId, userId) : eq(schema.authTokens.target, target);
  await db.update(schema.authTokens).set({ usedAt: new Date() }).where(and(scope, eq(schema.authTokens.kind, kind), isNull(schema.authTokens.usedAt)));
  await db.insert(schema.authTokens).values({ kind, userId, target, tokenHash: sha256(`${target}:${code}`), expiresAt: new Date(Date.now() + ttlSec * 1000) });
  return code;
}

/** Checks a code against the newest live one for (kind, target[, user]). Wrong guesses count towards the lock. */
export async function checkCode(kind: Kind, target: string, code: string, userId?: string) {
  const where = [eq(schema.authTokens.kind, kind), eq(schema.authTokens.target, target), isNull(schema.authTokens.usedAt), gt(schema.authTokens.expiresAt, new Date())];
  if (userId) where.push(eq(schema.authTokens.userId, userId));
  const row = (await db.select().from(schema.authTokens).where(and(...where)).orderBy(desc(schema.authTokens.createdAt)).limit(1))[0];
  if (!row) return { ok: false as const, reason: 'expired' as const };
  if (row.attempts >= MAX_ATTEMPTS) return { ok: false as const, reason: 'locked' as const };
  if (!/^\d{6}$/.test(code) || !safeEqual(sha256(`${target}:${code}`), row.tokenHash)) {
    await db.update(schema.authTokens).set({ attempts: dsql`${schema.authTokens.attempts} + 1` }).where(eq(schema.authTokens.id, row.id));
    return { ok: false as const, reason: 'wrong' as const };
  }
  const [used] = await db.update(schema.authTokens).set({ usedAt: new Date() }).where(and(eq(schema.authTokens.id, row.id), isNull(schema.authTokens.usedAt))).returning();
  return used ? { ok: true as const, row: used } : { ok: false as const, reason: 'expired' as const };
}

export const codeError = (reason: 'expired' | 'locked' | 'wrong') =>
  reason === 'wrong' ? 'کد اشتباهه.' : reason === 'locked' ? 'تعداد تلاش‌ها زیاد شد؛ کد جدید بگیر.' : 'کد منقضی شده؛ کد جدید بگیر.';

/** Iranian mobile numbers in any common shape (+98, 0098, 98, 9…, Persian digits) → 09xxxxxxxxx, or null. */
export function normalizePhone(input: string): string | null {
  const latin = input.replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[\s\-()]/g, '');
  const m = latin.match(/^(?:\+98|0098|98|0)?(9\d{9})$/);
  return m ? `0${m[1]}` : null;
}

export async function purgeTokens() {
  await db.delete(schema.authTokens).where(dsql`${schema.authTokens.expiresAt} < now() - interval '2 days'`);
}
