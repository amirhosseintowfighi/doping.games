import { sql } from 'drizzle-orm';
import { z } from 'zod';
import { audit } from '@/lib/server/audit';
import { db, schema } from '@/lib/server/db';
import { baseUrl, body, clientIp, handle, json, limit } from '@/lib/server/http';
import { sendEmail } from '@/lib/server/messaging';
import { issueLink } from '@/lib/server/tokens';

const Input = z.object({ login: z.string().trim().min(3, 'ایمیل یا نام کاربری رو وارد کن.').max(120) });

/** Always answers the same way, so it can't be used to find out which emails have accounts. */
export const POST = handle(async (req) => {
  const ip = clientIp(req);
  const b = await body(req, Input);
  const id = b.login.toLowerCase();
  await limit(`forgot:ip:${ip}`, 10, 3600);
  await limit(`forgot:id:${id}`, 3, 3600);
  const u = (await db.select().from(schema.users).where(sql`lower(${schema.users.email}) = ${id} or lower(${schema.users.username}) = ${id}`).limit(1))[0];
  if (u && !u.disabledAt) {
    const token = await issueLink('reset', u.id, 3600, u.email);
    // Not awaited: the answer takes the same time whether or not the account exists.
    void sendEmail(u.email, 'بازیابی رمز دوپینگ', `سلام ${u.username}،\nبرای ساختن رمز جدید روی دکمه زیر بزن. این لینک یک ساعت اعتبار داره و فقط یک بار کار می‌کنه.\nاگه خودت درخواست ندادی، این ایمیل رو نادیده بگیر.`, { url: `${baseUrl(req)}/reset?token=${token}`, label: 'ساختن رمز جدید' });
    await audit('auth', 'info', `password reset requested · ${u.username}`, u.username, ip);
  }
  return json({ ok: true });
});
