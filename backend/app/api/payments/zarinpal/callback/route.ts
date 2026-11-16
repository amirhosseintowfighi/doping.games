// app/api/payments/zarinpal/callback/route.ts
// Zarinpal redirects the buyer here. The query string is untrusted: the only source of truth is
// Zarinpal's own verify endpoint, and the credit is applied exactly once per authority.
import { audit, withTransaction } from '@/lib/db';
import { zarinpalCallbackSchema } from '@/lib/schemas';
import { guarded } from '@/lib/security/guard';
import { RULES } from '@/lib/security/rateLimit';
import { applyCredit, GIB } from '@/workers/quotaWorker';

interface PaymentRow {
  id: string;
  user_id: string;
  subscription_id: string;
  amount_rial: string;
  status: 'pending' | 'paid' | 'failed';
  kind: 'renewal' | 'topup';
  quota_gb: number | null;
  days: number;
}

interface VerifyResponse {
  data?: { code: number; ref_id: number; card_pan?: string };
  errors?: { code: number; message: string } | [];
}

async function verifyWithZarinpal(authority: string, amountRial: string): Promise<{ ok: boolean; refId?: string; code: number }> {
  const res = await fetch('https://payment.zarinpal.com/pg/v4/payment/verify.json', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ merchant_id: process.env.ZARINPAL_MERCHANT_ID, amount: Number(amountRial), authority }),
    signal: AbortSignal.timeout(10_000),
  });
  const body = (await res.json()) as VerifyResponse;
  const code = body.data?.code ?? (Array.isArray(body.errors) ? 0 : (body.errors?.code ?? 0));
  // 100 = verified now, 101 = this authority was already verified earlier.
  return { ok: code === 100 || code === 101, refId: body.data?.ref_id ? String(body.data.ref_id) : undefined, code };
}

const redirect = (state: 'success' | 'failed' | 'already', paymentId?: string) =>
  Response.redirect(`${process.env.APP_ORIGIN}/panel/billing?payment=${state}${paymentId ? `&id=${paymentId}` : ''}`, 303);

export const GET = guarded(
  { schema: zarinpalCallbackSchema, source: 'query', limit: { rule: RULES.paymentCallback, by: 'ip' } },
  async ({ input, ip }) => {
    const outcome = await withTransaction(async (tx) => {
      // The row lock is the idempotency gate: a second callback (double click, replay, retry)
      // waits here, then sees status = 'paid' and leaves without crediting again.
      const res = await tx.query<PaymentRow>(
        `SELECT id, user_id, subscription_id, amount_rial, status, kind, quota_gb, days
           FROM payments WHERE gateway = 'zarinpal' AND authority = $1 FOR UPDATE`,
        [input.Authority],
      );
      const payment = res.rows[0];
      if (!payment) return { state: 'failed' as const };
      if (payment.status === 'paid') return { state: 'already' as const, payment };

      if (input.Status !== 'OK') {
        await tx.query(`UPDATE payments SET status = 'failed', settled_at = now() WHERE id = $1`, [payment.id]);
        return { state: 'failed' as const, payment };
      }

      // Amount comes from our own row, never from the callback: a tampered amount cannot verify.
      const verdict = await verifyWithZarinpal(input.Authority, payment.amount_rial);
      if (!verdict.ok || !verdict.refId) {
        await tx.query(`UPDATE payments SET status = 'failed', gateway_code = $2, settled_at = now() WHERE id = $1`, [payment.id, verdict.code]);
        return { state: 'failed' as const, payment, code: verdict.code };
      }

      // UNIQUE(gateway, ref_id) is the second lock: one bank transaction can settle one invoice only.
      await tx.query(
        `UPDATE payments SET status = 'paid', ref_id = $2, gateway_code = $3, settled_at = now() WHERE id = $1`,
        [payment.id, verdict.refId, verdict.code],
      );
      await applyCredit(
        tx,
        payment.subscription_id,
        payment.kind === 'renewal'
          ? { kind: 'renewal', quotaBytes: payment.quota_gb === null ? null : BigInt(payment.quota_gb) * GIB, days: payment.days }
          : { kind: 'topup', extraBytes: BigInt(payment.quota_gb ?? 0) * GIB },
      );
      return { state: 'success' as const, payment, refId: verdict.refId };
    });

    await audit({
      category: 'payment',
      level: outcome.state === 'failed' ? 'warn' : 'info',
      action: `zarinpal.${outcome.state}`,
      actorId: outcome.payment?.user_id,
      ip,
      detail: { paymentId: outcome.payment?.id, authority: input.Authority },
    });
    return redirect(outcome.state, outcome.payment?.id);
  },
);
