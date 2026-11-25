// Account helpers shared by sign-up, the panel and the admin.
import { randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db, schema } from './db';
import { sendEmail } from './messaging';
import { issueLink } from './tokens';

/** 8 characters from an alphabet without look-alikes (0/O, 1/I). */
export function newRefCode() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return [...randomBytes(8)].map((b) => A[b % A.length]).join('');
}

export async function sendVerification(user: { id: string; email: string; username: string }, base: string) {
  const token = await issueLink('verify_email', user.id, 3 * 86_400, user.email);
  return sendEmail(user.email, 'تایید ایمیل دوپینگ', `سلام ${user.username}،\nبا تایید ایمیل، هشدار اتمام حجم و انقضا، رسید پرداخت و لینک بازیابی رمز به همین آدرس فرستاده می‌شه.`, { url: `${base}/api/auth/verify-email?token=${token}`, label: 'تایید ایمیل' });
}

export async function referrerOf(code: string | undefined) {
  if (!code || !/^[A-Z0-9]{6,12}$/i.test(code)) return null;
  return (await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.refCode, code.toUpperCase())).limit(1))[0]?.id ?? null;
}
