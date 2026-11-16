// app/api/auth/login/route.ts
import { verifyPassword } from '@/lib/crypto';
import { audit, query } from '@/lib/db';
import { loginSchema } from '@/lib/schemas';
import { createSession, guarded, json } from '@/lib/security/guard';
import { rateLimit, RULES, tooManyRequests } from '@/lib/security/rateLimit';

// Verifying against this hash when the account does not exist keeps response time identical,
// so the endpoint cannot be used to discover which emails are registered.
const DUMMY_HASH = 'scrypt$32768$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

export const POST = guarded(
  { schema: loginSchema, limit: { rule: RULES.login, by: 'ip' } },
  async ({ input, ip }) => {
    // Second bucket per account: a botnet rotating IPs still gets 5 tries per 15 minutes per email.
    const perAccount = await rateLimit(RULES.login, `acct:${input.email}`);
    if (!perAccount.allowed) return tooManyRequests(perAccount);

    const rows = await query<{ id: string; password_hash: string; disabled_at: Date | null }>(
      `SELECT id, password_hash, disabled_at FROM users WHERE email = $1`,
      [input.email],
    );
    const user = rows[0];
    const ok = verifyPassword(input.password, user?.password_hash ?? DUMMY_HASH);

    if (!user || !ok || user.disabled_at) {
      await audit({ category: 'auth', level: 'warn', action: 'login.failed', actorId: user?.id, ip, detail: { email: input.email } });
      return json({ error: 'invalid_credentials', message: 'ایمیل یا رمز عبور اشتباه است.' }, 401);
    }

    const headers = await createSession(user.id, ip);
    await audit({ category: 'auth', level: 'info', action: 'login.success', actorId: user.id, ip });
    return json({ ok: true }, 200, headers);
  },
);
